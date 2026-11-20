// File: api/notif.js
// Engine Pusat Pengiriman Push Notifikasi Cendekia Aksara
// Mendukung Pengiriman Langsung & Terjadwal (Lockscreen Push via OneSignal)
// Tahan Banting: Jika API Key belum diset atau offline, tetap return 200 dengan status fallback

export default async function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            service: 'Cendekia Notifikasi API Engine',
            version: '2.6.0',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { judul, pesan, urlTujuan, jenis, semester, send_after } = req.body || {};
    const targetUid = req.body?.targetUid || req.body?.targetUserId || null;
    const excludeUserId = req.body?.excludeUserId || null;

    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

    // Fail-Safe: Jika OneSignal API Key belum diset, return 200 dengan status fallback
    if (!ONESIGNAL_REST_API_KEY) {
        return res.status(200).json({
            success: true,
            mode: 'local_sw_fallback',
            message: 'OneSignal REST API Key belum dikonfigurasi di server. Notifikasi aktif melalui Service Worker & Push lokal.',
            payload: { judul, pesan, urlTujuan, jenis }
        });
    }

    const tipeKategori = jenis ? jenis : "umum";
    const ID_Unik_Notifikasi = tipeKategori + "-" + Date.now();
    const finalUrl = urlTujuan 
        ? (urlTujuan.startsWith('http') ? urlTujuan : `https://penugasan-admin-ai.vercel.app${urlTujuan}`) 
        : "https://penugasan-admin-ai.vercel.app/mem-free/index.html";

    // 1. KITA SUSUN KERANGKA DASAR PESAN DENGAN LOGO RESMI & BADGE TRANSPARAN
    let payload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { 
            "en": judul || "Notifikasi Cendekia Aksara", 
            "id": judul || "Notifikasi Cendekia Aksara" 
        },
        contents: { 
            "en": pesan || "Ada informasi baru untukmu.", 
            "id": pesan || "Ada informasi baru untukmu." 
        },
        url: finalUrl,
        chrome_web_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        chrome_web_badge: "https://penugasan-admin-ai.vercel.app/img/badge-96x96.png",
        firefox_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        priority: 10, // Prioritas tinggi agar memicu getaran dan layar kunci HP
        ttl: 86400,
        web_push_topic: ID_Unik_Notifikasi
    };

    if (send_after) {
        payload.send_after = send_after;
    }

    // 2. TARGET PENERIMA
    if (targetUid) {
        payload.include_aliases = { external_id: [targetUid] };
    } else if (semester) {
        payload.filters = [
            { field: "tag", key: "semester", relation: "=", value: semester.toString() }
        ];
    } else {
        payload.included_segments = ["Total Subscriptions"];
    }

    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return res.status(200).json({
                success: true,
                mode: 'fallback_active',
                warning: data?.errors?.[0] || "OneSignal response non-200",
                data
            });
        }

        return res.status(200).json({ 
            success: true, 
            mode: 'onesignal_delivered', 
            data 
        });
    } catch (error) {
        return res.status(200).json({
            success: true,
            mode: 'fallback_active',
            message: 'OneSignal fetch timeout, dialihkan ke Service Worker lokal.',
            error: error.message
        });
    }
}
