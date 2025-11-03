const CACHE_NAME = 'gt-markdawin-v2'; // تم تحديث الإصدار

// الملفات الأساسية لهيكل التطبيق
const APP_SHELL_URLS = [
    '/',
    'index.html',
    'styles.css',
    'script.js',
    'manifest.json',
    'marked.umd.js', // ملف ناقص سابقاً
    'emojis.json',   // ملف ناقص سابقاً
    'fonts.json'     // ملف ناقص سابقاً
];

// 1. التثبيت (Install) - تخزين هيكل التطبيق
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching App Shell');
                return cache.addAll(APP_SHELL_URLS);
            })
            .then(() => self.skipWaiting()) // تفعيل العامل فوراً
    );
});

// 2. التفعيل (Activate) - تنظيف المخازن القديمة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME) // حذف أي مخزن لا يطابق الاسم الجديد
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim()) // السيطرة على جميع الصفحات المفتوحة
    );
});

// 3. الجلب (Fetch) - تطبيق استراتيجيات التخزين
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // الاستراتيجية 1: Cache First (لهيكل التطبيق)
    // نخدم من الكاش مباشرة إن وجد، وإلا نجلبه من الشبكة
    if (APP_SHELL_URLS.includes(url.pathname.endsWith('/') ? '/' : url.pathname.substring(1))) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => response || fetch(event.request))
        );
        return;
    }

    // الاستراتيجية 2: Stale While Revalidate (للخطوط والإيموجي)
    // نخدم من الكاش فوراً، وفي نفس الوقت نطلب تحديثاً من الشبكة ونخزنه للمرة القادمة
    if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/emojis/svg/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    // أعد من الكاش إذا كان موجوداً، وإلا انتظر الشبكة
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // الاستراتيجية 3: Network Only (لأي شيء آخر)
    // لا تقم بتخزين الطلبات الأخرى (مثل طلبات خارجية)
    event.respondWith(fetch(event.request));
});
