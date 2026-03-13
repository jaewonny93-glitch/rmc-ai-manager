// RMC Ai Manager - Service Worker
// 버전이 바뀌면 자동으로 캐시 갱신 후 즉시 적용
'use strict';

const VERSION = 'rmc-v1.5';
const CACHE = 'rmc-cache-' + VERSION;

// 캐시할 핵심 파일 목록
const BASE = '/rmc-ai-manager';
const CORE_FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/flutter_bootstrap.js',
  BASE + '/flutter.js',
  BASE + '/main.dart.js',
  BASE + '/manifest.json',
  BASE + '/icons/Icon-192.png',
  BASE + '/icons/Icon-512.png',
];

// ── install: 핵심 파일 캐시 후 즉시 대기 없이 활성화 ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      // 핵심 파일 캐시 (실패해도 설치 진행)
      return cache.addAll(CORE_FILES).catch(function() {});
    }).then(function() {
      // 대기 없이 즉시 활성화 (기존 SW를 바로 교체)
      return self.skipWaiting();
    })
  );
});

// ── activate: 이전 버전 캐시 삭제 후 즉시 모든 탭 제어 ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE; // 현재 버전 외 모두 삭제
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      // 새로고침 없이 현재 열린 탭 즉시 제어
      return self.clients.claim();
    }).then(function() {
      // 모든 탭에 새 버전 적용 완료 알림
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
        });
      });
    })
  );
});

// ── fetch: 네트워크 우선, 실패시 캐시 ──
self.addEventListener('fetch', function(event) {
  // POST 등 non-GET 요청은 SW에서 처리 안 함
  if (event.request.method !== 'GET') return;

  // chrome-extension 등 무관한 요청 무시
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request).then(function(networkResponse) {
      // 네트워크 성공 → 캐시에도 저장
      if (networkResponse && networkResponse.status === 200) {
        var clone = networkResponse.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return networkResponse;
    }).catch(function() {
      // 네트워크 실패 → 캐시에서 응답
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // index.html 폴백 (오프라인)
        return caches.match('/index.html');
      });
    })
  );
});

// ── message: 외부에서 skipWaiting 요청 처리 ──
self.addEventListener('message', function(event) {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
