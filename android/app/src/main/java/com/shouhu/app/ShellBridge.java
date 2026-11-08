package com.shouhu.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * 注入给网页的原生桥（window.AndroidShell）。
 *
 * 存在的原因：Android WebView 不支持 <a download>，而应用的导出（存档 / 图片 / 主题）
 * 全部是「createObjectURL + a.download + a.click()」，在 WebView 里点了完全没反应。
 * 这里把数据分块接过来，直接写进系统「下载」目录：
 *   - API 29+ 走 MediaStore（Download/佳景/xxx），不需要任何权限；
 *   - API < 29 先试公共下载目录，没权限就落到应用专属目录（路径会 toast 出来）。
 *
 * 分块是因为 JavascriptInterface 传超大字符串（几十 MB 的 base64）会卡死甚至 OOM。
 */
public class ShellBridge {

    private static final String TAG = "ShouhuShell";
    private static final String FOLDER = "佳景";
    private static final int BUF = 64 * 1024;

    private final MainActivity activity;
    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());

    private OutputStream out;
    private Uri pendingUri;
    private File pendingFile;
    private String pendingName = "";
    private long written = 0L;

    ShellBridge(MainActivity activity) {
        this.activity = activity;
        this.ctx = activity.getApplicationContext();
    }

    // ---------------- 状态 / 调试 ----------------

    @JavascriptInterface
    public void ready() {
        Log.i(TAG, "web shell ready");
    }

    @JavascriptInterface
    public void log(String msg) {
        Log.i(TAG, msg == null ? "" : msg);
    }

    @JavascriptInterface
    public void toast(final String msg) {
        if (msg == null) return;
        main.post(() -> Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show());
    }

    // ---------------- 权限 / 唤起前台 ----------------
    // 网页里一直在调用这两个方法（初始化时的 checkPerm、AI 来电/视频通话前的 wakeUp），
    // 但壳里之前没有实现 → 调用时抛 "window.AndroidShell.checkPerm is not a function"，
    // 而这句在初始化流程里，会直接中断后续的 SQLite 初始化、导致数据全部走兜底分支。

    /**
     * 网页启动流程里的「检查并请求权限」。
     * 真正的权限申请由 MainActivity 在启动时统一做过，这里只补一次：
     * 仍缺的运行时权限再要一遍；已经全给过就什么都不做（不弹悬浮窗设置页，避免一进应用就跳走）。
     */
    @JavascriptInterface
    public void checkPerm() {
        main.post(() -> {
            try {
                activity.requestStartupPermissions();
            } catch (Throwable t) {
                Log.w(TAG, "checkPerm failed", t);
            }
        });
    }

    /**
     * 把应用拉回前台（AI 主动来电 / 视频通话前调用）。
     * Android 10+ 对后台启动 Activity 有限制，被系统拦下就只记日志，不影响网页后续逻辑。
     */
    @JavascriptInterface
    public void wakeUp() {
        main.post(() -> {
            try {
                Intent intent = new Intent(ctx, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                ctx.startActivity(intent);
            } catch (Throwable t) {
                Log.w(TAG, "wakeUp failed", t);
            }
        });
    }

    /**
     * 网页把「当前页面底部的真实底色」报上来（CSS 颜色串）。
     *
     * 用途：键盘弹出时 WebView 会让出键盘高度，留下的一条缝显示的是窗口背景。
     * 那条缝必须跟页面底色一致，否则就是用户看到的那条黑边。
     */
    @JavascriptInterface
    public void setPageBackground(final String cssColor) {
        final int color = parseCssColor(cssColor);
        if (color == 0) return;
        main.post(() -> activity.applyPageBackground(color));
    }

    /** 把 CSS 颜色串（#rgb / #rrggbb / #rrggbbaa / rgb() / rgba()）解析成 ARGB；失败返回 0 */
    static int parseCssColor(String raw) {
        if (raw == null) return 0;
        String s = raw.trim();
        // evaluateJavascript 回传的是 JSON 字符串：外面带引号，内部可能带转义
        if (s.length() >= 2 && s.charAt(0) == '"' && s.charAt(s.length() - 1) == '"') {
            s = s.substring(1, s.length() - 1);
        }
        s = s.replace("\\\"", "").replace("\\", "").trim().toLowerCase(Locale.US);
        if (s.isEmpty() || "transparent".equals(s) || "none".equals(s)) return 0;
        try {
            if (s.startsWith("#")) {
                String h = s.substring(1);
                if (h.length() == 3) {
                    h = "" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
                } else if (h.length() == 8) {
                    h = h.substring(0, 6); // #rrggbbaa：忽略透明度
                }
                if (h.length() != 6) return 0;
                return 0xFF000000 | Integer.parseInt(h, 16);
            }
            if (s.startsWith("rgb")) {
                int open = s.indexOf('(');
                int close = s.lastIndexOf(')');
                if (open < 0 || close <= open) return 0;
                // 兼容 rgb(255, 0, 0) / rgb(255 0 0) / rgba(255,0,0,.5) / rgb(255 0 0 / 50%)
                String[] parts = s.substring(open + 1, close).trim().split("[,/\\s]+");
                if (parts.length < 3) return 0;
                int red = Math.round(Float.parseFloat(parts[0].trim()));
                int green = Math.round(Float.parseFloat(parts[1].trim()));
                int blue = Math.round(Float.parseFloat(parts[2].trim()));
                if (parts.length >= 4) {
                    // alpha 可能是 0.5、.5 或 50%
                    String a = parts[3].trim();
                    boolean percent = a.endsWith("%");
                    float alpha = Float.parseFloat(percent ? a.substring(0, a.length() - 1) : a);
                    if (percent) alpha /= 100f;
                    if (alpha <= 0f) return 0;
                }
                return 0xFF000000 | (clamp255(red) << 16) | (clamp255(green) << 8) | clamp255(blue);
            }
        } catch (Exception e) {
            return 0;
        }
        return 0;
    }

    private static int clamp255(int v) {
        if (v < 0) return 0;
        if (v > 255) return 255;
        return v;
    }

    // ---------------- 文件保存（分块） ----------------

    /** 开始一个文件的写入；返回 false 表示没法创建目标文件 */
    @JavascriptInterface
    public boolean saveStart(String name, String mime) {
        discardPending();
        pendingName = sanitize(name);
        String type = (mime == null || mime.trim().isEmpty()) ? "application/octet-stream" : mime.trim();
        written = 0L;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = ctx.getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, pendingName);
                cv.put(MediaStore.Downloads.MIME_TYPE, type);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) {
                    Log.e(TAG, "MediaStore insert returned null");
                    return false;
                }
                OutputStream os = cr.openOutputStream(uri);
                if (os == null) {
                    cr.delete(uri, null, null);
                    return false;
                }
                pendingUri = uri;
                out = new BufferedOutputStream(os, BUF);
                return true;
            }

            // API 23-28：先公共下载目录，写不了退回应用专属目录
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
            try {
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdirs failed: " + dir);
                File f = new File(dir, pendingName);
                pendingFile = f;
                out = new BufferedOutputStream(new FileOutputStream(f), BUF);
                return true;
            } catch (Exception e) {
                Log.w(TAG, "public downloads not writable, falling back to app dir", e);
                pendingFile = null;
                dir = new File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), FOLDER);
                if (!dir.exists() && !dir.mkdirs()) return false;
                File f = new File(dir, pendingName);
                pendingFile = f;
                out = new BufferedOutputStream(new FileOutputStream(f), BUF);
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "saveStart failed", e);
            discardPending();
            return false;
        }
    }

    /** 接收一段 base64 数据（512KB 二进制 ≈ 683KB 字符串） */
    @JavascriptInterface
    public void saveChunk(String b64) {
        if (out == null || b64 == null || b64.isEmpty()) return;
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            out.write(bytes);
            written += bytes.length;
        } catch (Exception e) {
            Log.e(TAG, "saveChunk failed at " + written + " bytes", e);
            discardPending();
        }
    }

    /** 写完收尾；返回 true 表示文件已经落地 */
    @JavascriptInterface
    public boolean saveFinish() {
        if (out == null) {
            discardPending();
            return false;
        }
        try {
            out.flush();
            out.close();
        } catch (Exception e) {
            Log.e(TAG, "close failed", e);
            discardPending();
            return false;
        }
        out = null;

        if (pendingUri != null) {
            try {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.IS_PENDING, 0);
                ctx.getContentResolver().update(pendingUri, cv, null, null);
            } catch (Exception e) {
                Log.w(TAG, "failed to clear IS_PENDING", e);
            }
            final String shown = "Download/" + FOLDER + "/" + pendingName;
            Log.i(TAG, "saved " + written + " bytes -> " + shown);
            main.post(() -> Toast.makeText(ctx, "已保存到 " + shown, Toast.LENGTH_LONG).show());
            pendingUri = null;
        } else if (pendingFile != null) {
            final String path = pendingFile.getAbsolutePath();
            Log.i(TAG, "saved " + written + " bytes -> " + path);
            main.post(() -> Toast.makeText(ctx, "已保存到 " + path, Toast.LENGTH_LONG).show());
            pendingFile = null;
        }

        pendingName = "";
        written = 0L;
        return true;
    }

    /** 中途放弃（网页侧出错时调用） */
    @JavascriptInterface
    public void saveAbort() {
        Log.w(TAG, "saveAbort after " + written + " bytes");
        discardPending();
    }

    private void discardPending() {
        if (out != null) {
            try {
                out.close();
            } catch (Exception ignored) {
                // 反正要丢掉
            }
            out = null;
        }
        if (pendingUri != null) {
            try {
                ctx.getContentResolver().delete(pendingUri, null, null);
            } catch (Exception ignored) {
                // 忽略
            }
            pendingUri = null;
        }
        if (pendingFile != null) {
            try {
                if (pendingFile.exists() && pendingFile.length() == 0) pendingFile.delete();
            } catch (Exception ignored) {
                // 忽略
            }
            pendingFile = null;
        }
        pendingName = "";
        written = 0L;
    }

    /** 去掉路径分隔符和文件系统非法字符，避免网页传过来的名字把文件写到别处 */
    private static String sanitize(String name) {
        String n = (name == null) ? "" : name.trim();
        n = n.replace('\\', '_').replace('/', '_').replace(':', '_');
        n = n.replaceAll("[\\p{Cntrl}\"*?<>|]", "_");
        if (n.isEmpty() || n.equals(".") || n.equals("..")) {
            n = "shouhu-" + System.currentTimeMillis();
        }
        if (n.length() > 120) {
            String ext = "";
            int dot = n.lastIndexOf('.');
            if (dot > 0 && n.length() - dot <= 10) ext = n.substring(dot);
            n = n.substring(0, 120 - ext.length()) + ext;
        }
        return n;
    }
}
