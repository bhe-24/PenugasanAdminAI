// File: api/notif.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Menangkap data baru: semester dan targetUid
    const { judul, pesan, urlTujuan, jenis, semester, targetUid } = req.body;

    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
        return res.status(500).json({ error: "REST API KEY OneSignal belum dikonfigurasi." });
    }

    const tipeKategori = jenis ? jenis : "umum";
    const ID_Unik_Notifikasi = tipeKategori + "-" + Date.now();

    // 1. KITA SUSUN KERANGKA DASAR PESANNYA
    let payload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { "en": judul },
        contents: { "en": pesan },
        url: urlTujuan,
        web_push_topic: ID_Unik_Notifikasi
    };

    // 2. KITA TENTUKAN SIAPA TARGETNYA (LOGIKA PINTAR)
    if (targetUid) {
        // Kasus A: Kirim ke 1 Siswa Saja (Nilai Tugas)
        payload.include_aliases = { external_id: [targetUid] };
    } else if (semester) {
        // Kasus B: Kirim ke Semester Tertentu Saja (Tugas Baru)
        payload.filters = [
            { field: "tag", key: "semester", relation: "=", value: semester.toString() }
        ];
    } else {
        // Kasus C: Kirim Massal ke Semua (Pengumuman)
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

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data?.errors?.[0] || data?.errors || "Gagal mengirim notifikasi.";
            return res.status(response.status).json({ success: false, error: errorMessage, data });
        }

        if (data.errors && (!data.id || data.id === "")) {
            const errorMessage = Array.isArray(data.errors) ? data.errors[0] : "Target notifikasi kosong.";
            return res.status(400).json({ success: false, error: errorMessage, data });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Gagal mengirim notifikasi internal" });
    }
}
