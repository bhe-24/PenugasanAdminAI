// File: api/cron-beruang.js
// Dipanggil terjadwal otomatis oleh Vercel Cron setiap hari pukul 06:00 WIB (23:00 UTC)
// Mengingatkan member bahwa Si Beruang di Tulis Aku sudah kembali tidur per 00:00 WIB.

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
            message: 'OneSignal REST API Key belum diset di environment. Cron beruang 06:00 WIB siap berjalan saat key tersedia.'
        });
    }

    const wibNow = new Date(Date.now() + 7 * 3600000);
    const wibDateStr = `${wibNow.getUTCFullYear()}-${String(wibNow.getUTCMonth() + 1).padStart(2, '0')}-${String(wibNow.getUTCDate()).padStart(2, '0')}`;

    const payload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        included_segments: ["Total Subscriptions"],
        headings: {
            "en": "🐻 Si Beruang Kembali Tidur!",
            "id": "🐻 Si Beruang Kembali Tidur!"
        },
        contents: {
            "en": "Yah beruangnya sudah tidur lagi, ayo bangunkan beruangnya dan raih banyak poin!",
            "id": "Yah beruangnya sudah tidur lagi, ayo bangunkan beruangnya dan raih banyak poin!"
        },
        url: "https://penugasan-admin-ai.vercel.app/mem-5k/permainan/tulis-aku.html",
        chrome_web_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        chrome_web_badge: "https://penugasan-admin-ai.vercel.app/img/badge-96x96.png",
        firefox_icon: "https://penugasan-admin-ai.vercel.app/img/icon-192x192.png",
        priority: 10,
        ttl: 64800,
        web_push_topic: "cendekia-beruang-" + wibDateStr
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
            message: "Push notifikasi Si Beruang pukul 06:00 WIB berhasil dipancarkan.",
            data
        });
    } catch (err) {
        return res.status(200).json({
            success: false,
            message: "Gagal mengirim push beruang via OneSignal",
            error: err.message
        });
    }
}
