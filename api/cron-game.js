// File: api/cron-game.js
// Dipanggil terjadwal otomatis oleh Vercel Cron setiap hari pukul 07:00 WIB (00:00 UTC)
// Memancarkan push notification ke seluruh siswa/member (termasuk yang tidak membuka aplikasi web hari ini)

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
        return res.status(200).json({
            success: true,
            mode: 'simulation',
            message: 'OneSignal REST API Key belum diset di environment. Cron game siap berjalan saat key tersedia.'
        });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        included_segments: ["Total Subscriptions"],
        headings: {
            "en": "🎮 Mode Bermain Terbuka!",
            "id": "🎮 Mode Bermain Terbuka!"
        },
        contents: {
            "en": "Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!",
            "id": "Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!"
        },
        url: "https://penugasan-admin-ai.vercel.app/mem-free/bermain.html",
        chrome_web_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        chrome_web_badge: "https://penugasan-admin-ai.vercel.app/img/badge-96x96.png",
        firefox_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        priority: 10,
        ttl: 86400,
        web_push_topic: "cendekia-game-" + todayStr
    };

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
        return res.status(200).json({
            success: true,
            message: "Push notifikasi game harian dengan logo resmi berhasil dipancarkan ke seluruh HP siswa.",
            data
        });
    } catch (err) {
        return res.status(200).json({
            success: false,
            message: "Gagal mengirim push via OneSignal",
            error: err.message
        });
    }
}
