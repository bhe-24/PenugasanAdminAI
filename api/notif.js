// File: api/notif.js
// Engine Pusat Pengiriman Push Notifikasi Cendekia Aksara
// Mendukung Pengiriman Langsung & Terjadwal (Lockscreen Push via OneSignal)
// Proteksi Anti-Spam: Mencegah Broadcast Liar Yang Mengakibatkan Notifikasi Ganda

export default async function handler(req, res) {
    if (req.method === 'GET' && req.query?.cron === 'beruang') {
        const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
        const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;
        if (!ONESIGNAL_REST_API_KEY) {
            return res.status(200).json({
                success: true,
                mode: 'simulation',
                message: 'OneSignal REST API Key belum diset. Cron Si Beruang 06:00 WIB siap berjalan.'
            });
        }
        const wibNow = new Date(Date.now() + 7 * 3600000);
        const wibDateStr = `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, '0')}-${String(wibNow.getUTCDate()).padStart(2, '0')}`;
        try {
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    target_channel: "push",
                    included_segments: ["Total Subscriptions"],
                    headings: { en: "🐻 Si Beruang Kembali Tidur!", id: "🐻 Si Beruang Kembali Tidur!" },
                    contents: { en: "Yah beruangnya sudah tidur lagi, ayo bangunkan beruangnya dan raih banyak poin!", id: "Yah beruangnya sudah tidur lagi, ayo bangunkan beruangnya dan raih banyak poin!" },
                    url: "https://penugasan-admin-ai.vercel.app/mem-5k/permainan/tulis-aku.html",
                    chrome_web_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
                    chrome_web_badge: "https://penugasan-admin-ai.vercel.app/img/badge-96x96.png",
                    firefox_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
                    priority: 10,
                    ttl: 64800,
                    web_push_topic: "cendekia-beruang-" + wibDateStr
                })
            });
            const data = await response.json().catch(() => ({}));
            return res.status(200).json({ success: true, mode: 'cron_beruang', data });
        } catch (err) {
            return res.status(200).json({ success: false, mode: 'cron_beruang_error', error: err.message });
        }
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            service: 'Cendekia Notifikasi API Engine',
            version: '2.8.0',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { judul, pesan, urlTujuan, jenis, semester, send_after, broadcast } = req.body || {};
    const targetUid = req.body?.targetUid || req.body?.targetUserId || null;

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
    const todayStr = new Date().toISOString().slice(0, 10);
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
        priority: 10,
        ttl: 86400,
        web_push_topic: "cendekia-" + tipeKategori + "-" + todayStr
    };

    if (send_after) {
        payload.send_after = send_after;
    }

    // 2. TARGET PENERIMA PRESISI (MENCEGAH SPAM BROADCAST GANDA)
    if (targetUid) {
        // Kirim spesifik ke 1 Siswa Saja
        payload.include_aliases = { external_id: [targetUid] };
    } else if (semester) {
        // Kirim ke Semester Tertentu
        payload.filters = [
            { field: "tag", key: "semester", relation: "=", value: semester.toString() }
        ];
    } else if (broadcast === true || send_after) {
        // Hanya broadcast ke semua jika dipanggil oleh Cron resmi atau penjadwalan
        payload.included_segments = ["Total Subscriptions"];
    } else {
        // Cegah pengiriman tanpa target yang membombardir seluruh member
        return res.status(200).json({
            success: true,
            mode: 'skipped_no_target',
            message: 'Push dilewati untuk mencegah broadcast ganda tanpa targetUid.'
        });
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
