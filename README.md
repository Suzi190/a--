# 守护 · Android APK 打包工程

网页本体在 `assets/`（`index.html` 是主文件），外面套一层 [Capacitor](https://capacitorjs.com/) 7 的 Android 壳，
用 GitHub Actions 自动构建出可直接安装的 APK。

## 怎么拿到 APK

1. 打开仓库的 **Actions → Build Android APK**，等最近一次构建跑完（约 8–12 分钟）；
2. 打开 **Releases → 守护 APK (latest)**，点 `shouhu-debug.apk` 下载安装；
3. Actions 构建页底部的 Artifacts 里也有一份（保留 30 天）。

每次推 `main` 都会自动重新打包，`latest-apk` 这个 Release 会被覆盖成最新版。
APK 用仓库里固定的 `android/app/debug.keystore` 签名，**覆盖安装不会丢数据**。

## 目录结构

```
assets/                     网页本体（index.html + js/ + Live2D 资源…），可以直接浏览器打开
assets/js/native-shell.js   只在 APK 里生效的原生壳脚本（导出落盘 / 返回 / 侧滑）
scripts/prepare-www.mjs     构建时把 assets/ 同步成 www/（依赖库本地化、删 DEBUG、注入壳脚本）
capacitor.config.json       Capacitor 配置（appId / 全屏 / 键盘 / 插件参数）
android/                    Android 原生工程（MainActivity、ShellBridge、manifest、签名配置）
.github/workflows/          自动打包 workflow
```

`www/` 是构建产物，不进 git（`assets/index.html` 6MB + 资源 50MB，再拷一份会让仓库翻倍）。

## 本地构建

需要 JDK 21 + Android SDK（platform 35 / build-tools 35.0.0），然后：

```bash
npm ci
npm run www          # assets/ → www/，依赖库落地、删 DEBUG
npx cap copy android
cd android && ./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

Windows 上 `npm run apk` 一步到位（用 `gradlew.bat`）。

## 需求对应实现

| 需求 | 实现 |
| --- | --- |
| 全屏、不留状态栏，内容铺满刘海/挖孔区 | `MainActivity.onCreate` 里 `setDecorFitsSystemWindows(false)` + `hideSystemBars()` + `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`；`styles.xml` 里状态栏/导航栏透明、`windowLayoutInDisplayCutoutMode=shortEdges`；`capacitor.config.json` 的 `adjustMarginsForEdgeToEdge: "disable"` 关掉 Capacitor 自动加的安全区留白 |
| 数据导入导出正常 | `ShellBridge.java` 把导出数据分块写进系统「下载/守护」（API 29+ 走 MediaStore，无需权限）；`native-shell.js` 劫持应用原有的 `createObjectURL + a.download + a.click()`；导入用 Capacitor 的 `WebChromeClient` 系统文件选择器 + `@capawesome/capacitor-file-picker` |
| 左右滑动/返回键退回上一页而不是退出 | 返回键走 `MainActivity.handleBack()` → 先收键盘 → 再调网页的 `window.__appBack()`（按 z-index 找最上层 `*Page / *Modal / *Overlay…`，点它自带的关闭按钮或调对应 `closeXxx()`）→ 还有 WebView 历史就 `goBack()` → 都没有才「再按一次退出」；`native-shell.js` 另外补了左右边缘滑动返回 |
| 开放所需权限 | `AndroidManifest.xml`：网络、录音、相机、定位（含后台）、通知、振动、唤醒锁、精确闹钟、媒体读取、旧版存储写入等 |
| APK 里不留红色 DEBUG | `scripts/prepare-www.mjs` 打包时整块删掉 `#mainDebugBtn`（div + 内联脚本），并做自检；`index.html` 里也加了 `isNativePlatform()` 判断作为第二道保险 |
| 离线可用 | `prepare-www.mjs` 把 marked / localforage / papaparse / html2canvas / mammoth / MathJax 从 CDN 换成本地 `vendor/` 文件 |
