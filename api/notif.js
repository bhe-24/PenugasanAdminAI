// File: api/notif.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { judul, pesan, urlTujuan } = req.body;
    const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
    
    // Kunci Rahasia diambil dari Environment Variables Vercel (Sangat Aman)
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY; 

    try {
        const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + ONESIGNAL_REST_API_KEY
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                included_segments: ["Subscribed Users"],
                headings: { "en": judul },
                contents: { "en": pesan },
                url: urlTujuan
            })
        });

        const data = await response.json();
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: "Gagal mengirim notifikasi" });
    }
}
