/**
 * 把 assets/ 里的网页资源同步成 Capacitor 的 www/。
 *
 * 为什么不在仓库里再放一份 www/：
 *   assets/index.html 有 6MB+，Live2D/Samples 加起来 50MB+，再拷一份进 git 会让仓库翻倍。
 *   www/ 走 .gitignore，构建时现生成。
 *
 * 这个脚本做四件事：
 *   1. 拷贝 assets/ → www/（跳过旧版备份、public/ 里的重复副本、只给原生层用的配置）；
 *   2. 把 index.html 里依赖 CDN 的库（marked / localforage / papaparse / html2canvas /
 *      mammoth / mathjax）换成本地 vendor 文件，离线也能用（WebView 里没网时 CDN 加载
 *      失败会让存储层、Markdown、CSV 导入导出全部降级甚至报错）；
 *   3. 给所有 html 注入 native-shell.js（原生壳：导出落盘、边缘滑动返回、返回键逐层收起）；
 *   4. 删掉右上角的红色 DEBUG 按钮（只在浏览器调试时用，APK 里不留）。
 *
 * 用法：
 *   node scripts/prepare-www.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets');
const WWW = path.join(ROOT, 'www');
const VENDOR_DIR = path.join(WWW, 'vendor');

/** 不打包进 APK 的东西 */
const SKIP_NAMES = new Set([
  'public', // 旧版整页副本，和根目录资源重复，进包会白白大一倍
  'capacitor.config.json', // 原生层读的是 android/app/src/main/assets 下由 cap 生成的那份
  'capacitor.plugins.json',
  '.DS_Store',
  'Thumbs.db',
]);
const SKIP_EXT = /\.(backup|bak|orig)$/i;

/**
 * 需要落地到 vendor/ 的 CDN 库
 *   url   页面里原来的 CDN 地址（用来做替换）
 *   file  落地到 www/vendor 下的文件名
 *   local 优先从 node_modules 里拷的候选路径（构建更稳，不依赖 CDN 当下是否可达）
 */
const VENDOR_JS = [
  {
    url: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    file: 'marked.min.js',
    local: ['marked/marked.min.js', 'marked/lib/marked.umd.js', 'marked/lib/marked.js'],
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
    file: 'localforage.min.js',
    local: ['localforage/dist/localforage.min.js'],
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
    file: 'papaparse.min.js',
    local: ['papaparse/papaparse.min.js'],
  },
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    file: 'html2canvas.min.js',
    local: ['html2canvas/dist/html2canvas.min.js'],
  },
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    file: 'mammoth.browser.min.js',
    local: ['mammoth/mammoth.browser.min.js'],
  },
  {
    // character-editor.html 用（Live2D 模型预览）
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js',
    file: 'pixi.min.js',
    local: ['pixi.js/dist/pixi.min.js'],
  },
];

const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
const MATHJAX_LOCAL = 'vendor/mathjax/es5/tex-mml-chtml.js';

const SHELL_TAG =
  '<script src="js/native-shell.js" onerror="console.error(\'native-shell.js 加载失败\')"></script>';

const log = (...args) => console.log('[prepare-www]', ...args);
const warn = (...args) => console.warn('[prepare-www] ⚠', ...args);

let vendorFailures = [];

/* ------------------------------------------------------------------ */
/* 1. 拷贝 assets → www                                                */
/* ------------------------------------------------------------------ */

function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

function copyAssets() {
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  fs.cpSync(SRC, WWW, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const base = path.basename(src);
      if (SKIP_NAMES.has(base)) return false;
      if (SKIP_EXT.test(base)) return false;
      return true;
    },
  });

  log(`已复制 assets/ → www/（${countFiles(WWW)} 个文件，${mb(dirSize(WWW))}）`);
}

/* ------------------------------------------------------------------ */
/* 2. 依赖库本地化                                                      */
/* ------------------------------------------------------------------ */

async function download(url, dest, attempts = 2) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 512) throw new Error('文件过小，可能是错误页');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return true;
    } catch (err) {
      warn(`下载失败(${i}/${attempts}) ${url} — ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  return false;
}

/** 从 node_modules 里拷（首选），返回命中的相对路径 */
function copyFromNodeModules(lib, dest) {
  for (const rel of lib.local) {
    const src = path.join(ROOT, 'node_modules', rel);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      return rel;
    }
  }
  return null;
}

async function vendorLibraries() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const failed = [];
  for (const lib of VENDOR_JS) {
    const dest = path.join(VENDOR_DIR, lib.file);
    const hit = copyFromNodeModules(lib, dest);
    if (hit) {
      log(`vendor ${lib.file}  ${mb(fs.statSync(dest).size)}  ← node_modules/${hit}`);
      continue;
    }
    if (await download(lib.url, dest)) {
      log(`vendor ${lib.file}  ${mb(fs.statSync(dest).size)}  ← CDN`);
    } else {
      failed.push(lib.url);
    }
  }
  return failed;
}

/** 递归拷目录（不用 fs.cpSync：Node 22 在 Windows 上拷 mathjax/es5 会 0xC0000409 崩掉） */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name);
    const to = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(from, to);
    else if (e.isSymbolicLink()) fs.copyFileSync(fs.realpathSync(from), to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * MathJax 不是单文件：tex-mml-chtml.js 运行时还要按相对路径加载
 * output/chtml/fonts/woff-v2 里的字体、以及 input/tex/extensions 里的扩展，
 * 所以直接从 npm 包（devDependency mathjax）整目录拷 es5，相对路径原样保留。
 */
function vendorMathJax() {
  const src = path.join(ROOT, 'node_modules', 'mathjax', 'es5');
  if (!fs.existsSync(src)) {
    warn('node_modules/mathjax/es5 不存在，MathJax 仍走 CDN（离线时公式不渲染）');
    return false;
  }
  const dest = path.join(VENDOR_DIR, 'mathjax', 'es5');
  copyDir(src, dest);
  log(`vendor mathjax/es5  ${mb(dirSize(dest))}`);
  return true;
}

/* ------------------------------------------------------------------ */
/* 3. HTML 处理                                                       */
/* ------------------------------------------------------------------ */

/** 删掉 mainDebugBtn 那一整块（div + 控制显示、弹窗的 inline script） */
function stripDebugButton(html, file) {
  const divIdx = html.indexOf('<div id="mainDebugBtn"');
  if (divIdx === -1) return html;

  const fnIdx = html.indexOf('function showMainDebugDialog', divIdx);
  const endIdx = fnIdx === -1 ? -1 : html.indexOf('</script>', fnIdx);
  if (endIdx === -1) {
    warn(`${file}: 找到 DEBUG 按钮但找不到结束标签，未删除`);
    return html;
  }
  const cut = html.slice(divIdx, endIdx + '</script>'.length);
  if (!/showMainDebugDialog/.test(cut)) {
    warn(`${file}: DEBUG 按钮结构与预期不同，未删除`);
    return html;
  }
  log(`${file}: 已移除 DEBUG 按钮（${cut.length} 字节）`);
  return (
    html.slice(0, divIdx) +
    '<!-- DEBUG 按钮已在打包时移除 -->' +
    html.slice(endIdx + '</script>'.length)
  );
}

/** 所有 html 都注入原生壳脚本，保证子页面（音乐、塔罗、记账…）也能导出文件和返回 */
function injectShell(html) {
  if (html.includes('js/native-shell.js')) return html;
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + '\n' + SHELL_TAG + '\n';
  return html.slice(0, idx) + SHELL_TAG + '\n' + html.slice(idx);
}

function rewriteCdn(html, mathjaxLocal) {
  for (const lib of VENDOR_JS) {
    if (vendorFailures.includes(lib.url)) continue; // 拿不到就保留 CDN 地址（有网时仍可用）
    html = html.split(lib.url).join('vendor/' + lib.file);
  }
  if (mathjaxLocal) html = html.split(MATHJAX_URL).join(MATHJAX_LOCAL);
  return html;
}

function processHtmlFiles(mathjaxLocal) {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.html?$/i.test(e.name)) files.push(p);
    }
  })(WWW);

  for (const file of files) {
    const rel = path.relative(WWW, file).replace(/\\/g, '/');
    let html = fs.readFileSync(file, 'utf8');
    const before = html.length;
    html = stripDebugButton(html, rel);
    html = rewriteCdn(html, mathjaxLocal);
    html = injectShell(html);
    fs.writeFileSync(file, html, 'utf8');
    log(`${rel}: ${mb(before)} → ${mb(html.length)}`);
  }
  return files;
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  copyAssets();

  vendorFailures = await vendorLibraries();
  const mathjaxLocal = vendorMathJax();

  const htmlFiles = processHtmlFiles(mathjaxLocal);

  /* ---------------------------------------------------------------- */
  /* 4. 自检                                                           */
  /* ---------------------------------------------------------------- */

  const indexHtml = path.join(WWW, 'index.html');
  if (!fs.existsSync(indexHtml)) throw new Error('www/index.html 没生成出来');
  const html = fs.readFileSync(indexHtml, 'utf8');

  const problems = [];
  if (/mainDebugBtn/.test(html)) problems.push('index.html 里仍有 mainDebugBtn');
  if (!/js\/native-shell\.js/.test(html)) problems.push('index.html 没注入 native-shell.js');
  if (!fs.existsSync(path.join(WWW, 'js', 'native-shell.js'))) problems.push('www/js/native-shell.js 不存在');
  for (const lib of VENDOR_JS) {
    if (html.includes(lib.url)) problems.push(`${lib.file} 仍走 CDN（离线时相关功能会失效）`);
  }
  if (html.includes(MATHJAX_URL)) problems.push('MathJax 仍走 CDN（离线时公式不渲染）');

  if (problems.length) {
    warn('自检有问题：\n  - ' + problems.join('\n  - '));
    if (problems.some((p) => p.includes('mainDebugBtn') || p.includes('native-shell'))) {
      throw new Error('打包自检失败：' + problems.join('; '));
    }
  } else {
    log('自检通过：无 DEBUG 按钮、原生壳已注入、依赖库已本地化');
  }

  log(`完成：www/ 共 ${countFiles(WWW)} 个文件，${mb(dirSize(WWW))}，html ${htmlFiles.length} 个`);
}

main().catch((err) => {
  console.error('[prepare-www] 失败：', err);
  process.exit(1);
});
