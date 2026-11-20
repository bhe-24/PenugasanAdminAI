// File: OneSignalSDK.sw.js
// Antena Service Worker Resmi OneSignal untuk Push Notification Background
try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
    console.warn("[OneSignalSDK.sw.js] Import CDN bypass:", e);
}

// Terhubung dengan Service Worker Cendekia Aksara
try {
    importScripts("/sw.js");
} catch (e) {
    console.warn("[OneSignalSDK.sw.js] Import sw.js bypass:", e);
}
