// File: api/notif.js
export default async function handler(req, res) {
    // Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Tambahkan variabel 'jenis' (Bisa mendeteksi ini kiriman dari 'tugas' atau 'kuis')
    const { judul, pesan, urlTujuan, jenis } = req.body;

    // APP ID OneSignal Anda
    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";

    // REST API KEY dari Vercel Environment Variables
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

    if (!ONESIGNAL_REST_API_KEY) {
        return res.status(500).json({ error: "REST API KEY OneSignal belum dikonfigurasi di Vercel." });
    }

    // MEMBUAT ID UNIK AGAR NOTIFIKASI NUMPUK & BISA DIDETEKSI
    // Contoh hasil: "tugas-1718293812" atau "kuis-1718293899"
    const tipeKategori = jenis ? jenis : "umum";
    const ID_Unik_Notifikasi = tipeKategori + "-" + Date.now();

    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                included_segments: ["Total Subscriptions"], // Diperbarui agar pasti kena target
                target_channel: "push",
                headings: { "en": judul },
                contents: { "en": pesan },
                url: urlTujuan,
                web_push_topic: ID_Unik_Notifikasi // Kunci utama agar notifikasi tidak saling menghilangkan
            })
        });

        const data = await response.json();

        // Cek Error HTTP Standar
        if (!response.ok) {
            const errorMessage = data?.errors?.[0] || data?.errors || data?.message || "Gagal mengirim notifikasi.";
            return res.status(response.status).json({ success: false, error: errorMessage, data });
        }

        // Cek Jebakan OneSignal (Berhasil 200, tapi ID kosong / error tertutup)
        if (data.errors && (!data.id || data.id === "")) {
            const errorMessage = Array.isArray(data.errors) ? data.errors[0] : "Target notifikasi kosong.";
            return res.status(400).json({ success: false, error: errorMessage, data });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error internal server Vercel:", error);
        return res.status(500).json({ success: false, error: "Gagal mengirim notifikasi" });
    }
}
