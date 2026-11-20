// File: api/notif.js
// Engine Pusat Pengiriman Push Notifikasi Cendekia Aksara
// Mendukung Pengiriman Langsung & Terjadwal (Lockscreen Push via OneSignal)
// Tahan Banting: Jika API Key belum diset atau offline, tetap return 200 dengan status fallback

export default async function handler(req, res) {
    // Health check endpoint
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'online',
            service: 'Cendekia Notifikasi API Engine',
            version: '2.5.0',
            timestamp: new Date().toISOString()
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Menangkap data: judul, pesan, urlTujuan, jenis, semester, targetUid / targetUserId, send_after
    const { judul, pesan, urlTujuan, jenis, semester, send_after } = req.body || {};
    const targetUid = req.body?.targetUid || req.body?.targetUserId || null;
    const excludeUserId = req.body?.excludeUserId || null;

    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

    // Fail-Safe: Jika OneSignal API Key belum diset, jangan return 500!
    // Kembalikan 200 dengan status fallback agar client memproses via Service Worker lokal
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

    // 1. KITA SUSUN KERANGKA DASAR PESAN DENGAN OPTIMALISASI LAYAR KUNCI HP
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
        chrome_web_icon: "https://i.imgur.com/5Srjyo4.png",
        chrome_web_badge: "https://i.imgur.com/5Srjyo4.png",
        priority: 10, // Prioritas tinggi untuk memicu getaran dan layar kunci HP
        ttl: 86400,   // Disimpan hingga 24 jam jika perangkat offline
        web_push_topic: ID_Unik_Notifikasi
    };

    // Dukungan Jadwal Pengiriman di Masa Depan (cth: Pengingat Game Pagi Besok)
    if (send_after) {
        payload.send_after = send_after;
    }

    // 2. KITA TENTUKAN SIAPA TARGETNYA (LOGIKA PINTAR)
    if (targetUid) {
        // Kasus A: Kirim ke 1 Siswa Saja (Nilai / Ultah / Skor / Tantangan)
        payload.include_aliases = { external_id: [targetUid] };
    } else if (semester) {
        // Kasus B: Kirim ke Semester Tertentu Saja (Tugas / Game Semester)
        payload.filters = [
            { field: "tag", key: "semester", relation: "=", value: semester.toString() }
        ];
    } else {
        // Kasus C: Kirim Massal ke Semua Siswa (Game Harian Terbuka / Pengumuman)
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
            // Tetap kembalikan 200 agar frontend client mengaktifkan local fallback tanpa crash
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
        // Fail-safe jika server OneSignal timeout / error jaringan
        return res.status(200).json({
            success: true,
            mode: 'fallback_active',
            message: 'OneSignal fetch timeout, dialihkan ke Service Worker lokal.',
            error: error.message
        });
    }
}
