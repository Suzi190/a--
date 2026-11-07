/**
 * 守护 · 原生壳脚本（Android APK 内生效，浏览器打开时基本什么都不做）
 * ------------------------------------------------------------------
 * 解决三件事：
 *   1. 导出：WebView 不支持 <a download>，应用的存档 / 图片导出全是
 *      「URL.createObjectURL(blob) + a.download + a.click()」，在 APK 里点了没反应。
 *      这里把数据分块交给原生层，直接写进系统「下载/守护」（见 ShellBridge.java）。
 *   2. 导入：<input type="file"> 由 Capacitor 的 WebChromeClient 接管系统文件选择器，
 *      这里不用管；只保证导出后的文件能被文件管理器看到、再选回来。
 *   3. 返回：Android 返回键 / 左右边缘滑动 → 先把最上层弹层、子页面逐层收起，
 *      真的没得收了才交给原生做「再按一次退出」。
 *
 * 页面里的应用代码一行都不用改。
 */
(function () {
  'use strict';

  var API = window.AndroidShell || null;
  var isNative = !!(API && typeof API.saveStart === 'function');

  window.__nativeShell = { version: '1.0.0', isNative: isNative };

  function toast(msg) {
    try { API.toast(String(msg)); } catch (e) { /* 浏览器里没有原生层 */ }
  }

  function nativeLog(msg) {
    try { API.log(String(msg)); } catch (e) { /* ignore */ }
  }

  /* ================================================================
   * 一、导出：blob: / data: → 系统「下载/守护」
   * ================================================================ */

  var CHUNK = 512 * 1024; // 单次跨桥字节数：base64 后约 683KB，避免超大字符串卡死主线程

  function u8ToB64(u8) {
    var out = '';
    var step = 0x8000;
    for (var i = 0; i < u8.length; i += step) {
      out += String.fromCharCode.apply(null, u8.subarray(i, i + step));
    }
    return btoa(out);
  }

  function dataUrlToBytes(dataUrl) {
    var m = String(dataUrl || '').match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
    if (!m) return null;
    var mime = m[1] || 'application/octet-stream';
    if (m[2]) {
      var bin = atob(m[3]);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { mime: mime, bytes: u8 };
    }
    var text = decodeURIComponent(m[3]);
    return { mime: mime, bytes: new TextEncoder().encode(text) };
  }

  function guessExt(mime) {
    if (/json/i.test(mime)) return '.json';
    if (/csv/i.test(mime)) return '.csv';
    if (/gzip/i.test(mime)) return '.json.gz';
    if (/png/i.test(mime)) return '.png';
    if (/jpe?g/i.test(mime)) return '.jpg';
    if (/webp/i.test(mime)) return '.webp';
    if (/zip/i.test(mime)) return '.zip';
    if (/text\/plain/i.test(mime)) return '.txt';
    return '.bin';
  }

  function guessName(mime) {
    return '守护-' + Date.now() + guessExt(mime || '');
  }

  /** 分块写进原生层；返回 true 表示已保存 */
  function writeNative(name, mime, bytes) {
    var ok = false;
    try {
      ok = !!API.saveStart(String(name || 'download'), String(mime || 'application/octet-stream'));
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      toast('保存失败：无法创建文件');
      return false;
    }
    try {
      for (var off = 0; off < bytes.length; off += CHUNK) {
        API.saveChunk(u8ToB64(bytes.subarray(off, off + CHUNK)));
      }
      return !!API.saveFinish();
    } catch (err) {
      try { API.saveAbort(); } catch (e) { /* ignore */ }
      toast('保存失败：' + (err && err.message ? err.message : '未知错误'));
      return false;
    }
  }

  /**
   * 处理一个带 download 属性的 <a>。
   * 返回 true 表示「这个链接交给原生层了」，调用方应阻止默认行为。
   */
  function saveAnchor(a) {
    var href = a.getAttribute('href') || '';
    var name = a.getAttribute('download') || '';

    if (/^blob:/i.test(href)) {
      // 应用通常几秒后会 revoke 这个 blob，所以立刻 fetch
      fetch(href)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          return blob.arrayBuffer().then(function (buf) {
            writeNative(name || guessName(blob.type), blob.type, new Uint8Array(buf));
          });
        })
        .catch(function (err) {
          toast('保存失败：' + ((err && err.message) || '读取数据出错'));
        });
      return true;
    }

    if (/^data:/i.test(href)) {
      var parsed = dataUrlToBytes(href);
      if (!parsed) return false;
      writeNative(name || guessName(parsed.mime), parsed.mime, parsed.bytes);
      return true;
    }

    // http(s) 下载交给原生 DownloadListener
    return false;
  }

  /* ================================================================
   * 二、返回：逐层收起弹层 / 子页面，收无可收才让原生决定退出
   * ================================================================ */

  /** 应用里整页/弹层的 id 命名约定：settingsPage / addFriendModal / blackRoomOverlay … */
  var LAYER_ID = /(modal|page|overlay|popup|panel|sheet|dialog|viewer|drawer|mask)$/i;
  /** 这些 id 是应用骨架，不能当弹层关掉 */
  var IGNORE_IDS = { screensContainer: 1, app: 1, appContainer: 1 };

  function css(el) {
    return window.getComputedStyle ? window.getComputedStyle(el) : el.currentStyle;
  }

  function isShown(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el === document.body || el === document.documentElement) return false;
    if (!el.getClientRects().length) return false;
    var cs = css(el);
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    if (cs.pointerEvents === 'none') return false;
    var r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return false;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) return false;
    return true;
  }

  /** 找出当前可见的「整页层」，按 z-index / DOM 顺序从高到低排 */
  function findLayers() {
    var out = [];
    var nodes = document.querySelectorAll('[id]');
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (IGNORE_IDS[el.id] || !LAYER_ID.test(el.id)) continue;
      if (!isShown(el)) continue;
      var cs = css(el);
      if (cs && cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      var r = el.getBoundingClientRect();
      if ((r.width * r.height) / (vw * vh) < 0.25) continue; // 小气泡、小角标不算
      var z = cs ? parseInt(cs.zIndex, 10) : 0;
      out.push({ el: el, z: isNaN(z) ? 0 : z, i: i });
    }
    out.sort(function (a, b) { return b.z - a.z || b.i - a.i; });
    return out;
  }

  function callFn(name) {
    try {
      if (typeof window[name] === 'function') {
        window[name]();
        return true;
      }
    } catch (e) {
      nativeLog('[shell] ' + name + '() 抛错: ' + (e && e.message ? e.message : e));
    }
    return false;
  }

  /** 层里若自带「关闭 / 返回」按钮，就点它，让应用自己把状态、动画处理干净 */
  function clickCloseButton(layer) {
    if (!layer) return false;
    var nodes = layer.querySelectorAll('[onclick]');
    var fallback = null;
    for (var i = 0; i < nodes.length; i++) {
      var code = (nodes[i].getAttribute('onclick') || '').trim();
      if (!/^(close|hide|dismiss)[A-Za-z0-9_]*\s*\(/.test(code)) continue;
      if (isShown(nodes[i])) {
        try { nodes[i].click(); return true; } catch (e) { /* 继续找 */ }
      }
      if (!fallback) fallback = nodes[i];
    }
    if (fallback) {
      try { fallback.click(); return true; } catch (e) { /* ignore */ }
    }
    return false;
  }

  var LAYER_SUFFIX = /(Modal|Page|Overlay|Popup|Panel|Sheet|Dialog|Viewer|Drawer|Mask)$/i;

  /** 按命名约定找关闭函数：addFriendModal → closeAddFriend() / closeAddFriendModal() */
  function callCloseFnByName(id) {
    var base = id.replace(LAYER_SUFFIX, '');
    if (!base) return false;

    var cap = base.charAt(0).toUpperCase() + base.slice(1);
    if (callFn('close' + cap) || callFn('hide' + cap)) return true;

    // 缩写命名：closeWorldBook ↔ worldBookPage
    var lower = base.toLowerCase();
    for (var k in window) {
      if (!/^(close|hide)[A-Z]/.test(k)) continue;
      if (typeof window[k] !== 'function') continue;
      var suffix = k.replace(/^(close|hide)/, '').toLowerCase();
      if (suffix.length >= 3 && lower.indexOf(suffix) === 0) {
        if (callFn(k)) return true;
      }
    }
    return false;
  }

  function hideLayer(el) {
    try {
      el.style.setProperty('display', 'none', 'important');
      el.classList.remove('show', 'active', 'open', 'visible', 'is-open');
    } catch (e) { /* ignore */ }
    document.body.style.overflow = '';
    return true;
  }

  function closeTopLayer() {
    // 1) 聊天详情页：id 是 chatInterface，不套 xxxPage 的命名
    var chat = document.getElementById('chatInterface');
    if (chat && isShown(chat)) {
      if (clickCloseButton(chat)) return true;
      if (callFn('closeChatInterface')) return true;
      return hideLayer(chat);
    }

    var layers = findLayers();
    if (!layers.length) return false;
    var top = layers[0].el;

    // 2) 层自带的关闭按钮
    if (clickCloseButton(top)) return true;
    // 3) 命名约定对应的关闭函数
    if (callCloseFnByName(top.id)) return true;
    // 4) 兜底隐藏：至少不会直接退出应用
    return hideLayer(top);
  }

  /**
   * 原生返回键 / 侧滑会调用它。
   * 返回 true = 已经退回上一层；false = 已经在最外层，交给原生做「再按一次退出」。
   */
  window.__appBack = function () {
    window.__lastBackAt = Date.now();
    try {
      return !!closeTopLayer();
    } catch (e) {
      nativeLog('[shell] back error: ' + (e && e.message ? e.message : e));
      return false;
    }
  };

  function installDownloadBridge() {
    // 1) 程序化 a.click()（应用导出都是这一种）
    var rawClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try {
        if (this.hasAttribute && this.hasAttribute('download') && saveAnchor(this)) return;
      } catch (e) { /* 交给原生点击 */ }
      return rawClick.apply(this, arguments);
    };

    // 2) 用户手点 / dispatchEvent 派发
    document.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        var a = t && t.closest ? t.closest('a[download]') : null;
        if (!a) return;
        if (!/^(blob|data):/i.test(a.getAttribute('href') || '')) return;
        e.preventDefault();
        e.stopPropagation();
        saveAnchor(a);
      },
      true
    );
  }

  /* ================================================================
   * 三、左右边缘滑动返回
   * 手势导航的系统返回已经在原生层了；三键导航时系统不会把侧滑当返回，
   * 这里补一个，并且和原生返回（刚触发过的 400ms 内）做去重，避免连退两层。
   * ================================================================ */

  function installEdgeSwipe() {
    var EDGE = 30;      // 起始点距屏幕边缘的宽度
    var MIN_DX = 64;    // 最小水平位移
    var MAX_DY = 90;    // 上下抖动容差
    var MAX_MS = 800;   // 超时不认
    var start = null;

    document.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches.length !== 1) { start = null; return; }
        var t = e.touches[0];
        var w = window.innerWidth || 0;
        if (t.clientX <= EDGE) start = { x: t.clientX, y: t.clientY, at: Date.now(), dir: 1 };
        else if (t.clientX >= w - EDGE) start = { x: t.clientX, y: t.clientY, at: Date.now(), dir: -1 };
        else start = null;
      },
      { passive: true, capture: true }
    );

    document.addEventListener(
      'touchmove',
      function (e) {
        if (!start || e.touches.length !== 1) return;
        if (Math.abs(e.touches[0].clientY - start.y) > MAX_DY) start = null;
      },
      { passive: true, capture: true }
    );

    document.addEventListener(
      'touchend',
      function (e) {
        if (!start) return;
        var s = start;
        start = null;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - s.x;
        var dy = Math.abs(t.clientY - s.y);
        var ok = s.dir === 1 ? dx >= MIN_DX : dx <= -MIN_DX;
        if (!ok || dy > MAX_DY || Date.now() - s.at > MAX_MS) return;
        if (Date.now() - (window.__lastBackAt || 0) < 400) return;
        try { window.__appBack(); } catch (err) { /* ignore */ }
      },
      { passive: true, capture: true }
    );
  }

  /* ================================================================
   * 启动
   * ================================================================ */

  if (isNative) {
    installDownloadBridge();
    installEdgeSwipe();
    try { API.ready(); } catch (e) { /* ignore */ }

    // 未捕获异常透传到 logcat，方便排查 APK 里才出现的问题
    window.addEventListener('error', function (ev) {
      nativeLog('[web] ' + (ev.message || 'error') + ' @' + (ev.filename || '?') + ':' + (ev.lineno || 0));
    });
  } else if (!window.__appBack) {
    // 浏览器里也提供同名函数，页面代码可以无脑调用
    window.__appBack = function () { return false; };
  }
})();

