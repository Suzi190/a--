// Service Worker - 实现后台音乐播放 + 智能缓存更新
const CACHE_VERSION = 'v7';
const CACHE_NAME = `shouhu-app-${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/music.html'
];

// 安装 Service Worker - 缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Service Worker 缓存失败:', err);
      })
  );
  self.skipWaiting();
});

// 激活 Service Worker - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // 只删除旧的 shouhu-app 缓存，保留其他缓存
            return cacheName.startsWith('shouhu-app-') && cacheName !== CACHE_NAME;
          })
          .map(cacheName => {
            console.log('Service Worker 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 拦截请求 - 网络优先，缓存后备（确保能获取更新）
self.addEventListener('fetch', event => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // 网络请求成功，更新缓存
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 网络失败，回退到缓存
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 缓存也没有，返回离线页面（如果有的话）
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          throw new Error('网络不可用且缓存未命中');
        });
      })
  );
});

// 处理后台播放消息
self.addEventListener('message', event => {
  if (event.data === 'keep-alive') {
    console.log('Service Worker 保持活跃');
  }
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
