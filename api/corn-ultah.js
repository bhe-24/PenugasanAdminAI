// File: api/cron-ultah.js
import admin from 'firebase-admin';

// 1. INISIALISASI FIREBASE ADMIN (Sesuaikan dengan file env-mu)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    // Keamanan: Hanya izinkan GET/POST dari Cron
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log("Menjalankan Robot Pengecek Ulang Tahun...");
        
        // 2. AMBIL WAKTU HARI INI (WIB - Waktu Indonesia Barat)
        const today = new Date();
        const options = { timeZone: 'Asia/Jakarta' };
        const localeDate = today.toLocaleDateString('en-CA', options); // Format: YYYY-MM-DD
        const dateObj = new Date(localeDate);
        
        const currentMonthDay = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const currentYear = dateObj.getFullYear().toString();

        // 3. TARIK DATA SEMUA SISWA
        const usersSnap = await db.collection('users').where('role', '==', 'siswa').get();
        let totalNotified = 0;

        for (const docSnap of usersSnap.docs) {
            const data = docSnap.data();
            if (!data.tanggalLahir) continue;

            // Ekstrak Format Tanggal Lahir jadi MM-DD
            const parts = data.tanggalLahir.split('-');
            let userMonthDay = "";
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    userMonthDay = `${parts[1]}-${parts[2]}`; // Jika YYYY-MM-DD
                } else {
                    userMonthDay = `${parts[1]}-${parts[0]}`; // Jika DD-MM-YYYY
                }
            }

            // 4. CEK APAKAH ULTAH HARI INI & BELUM DIKIRIMI NOTIF TAHUN INI
            if (userMonthDay === currentMonthDay && data.lastNotifiedYear !== currentYear) {
                
                const userId = docSnap.id;
                const userName = data.name || "Siswa";

                // --- A. KIRIM NOTIFIKASI KE YANG ULANG TAHUN ---
                // (Sesuaikan URL ini dengan API Notifikasi OneSignal/Push yang kamu pakai)
                await fetch(`https://${req.headers.host}/api/notif`, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetUserId: userId, 
                        judul: "Selamat Ulang Tahun! 🎉",
                        pesan: `Hai, ${userName}! Buka kejutan spesial dari Cendekia Aksara sekarang.`,
                        urlTujuan: "/siswa/ultah.html",
                        jenis: "ultah"
                    })
                }).catch(e => console.error("Gagal kirim notif personal:", e));

                // --- B. KIRIM NOTIFIKASI KE TEMAN-TEMAN (BROADCAST) ---
                await fetch(`https://${req.headers.host}/api/notif`, {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        excludeUserId: userId, // Kirim ke semua KECUALI yang ultah
                        judul: `🎉 Hari ini ${userName} Ulang Tahun!`,
                        pesan: `Yuk berikan doa dan ucapan terbaikmu untuk ${userName} via WhatsApp.`,
                        urlTujuan: `/siswa/ultah.html?u=${userId}`, 
                        jenis: "ultah_teman"
                    })
                }).catch(e => console.error("Gagal kirim notif teman:", e));

                // --- C. KUNCI DATABASE AGAR TIDAK SPAM ---
                await docSnap.ref.update({
                    lastNotifiedYear: currentYear
                });
                
                totalNotified++;
                console.log(`Berhasil mengirim notifikasi ulang tahun untuk: ${userName}`);
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: `Pengecekan ultah selesai. ${totalNotified} siswa berulang tahun hari ini.` 
        });

    } catch (error) {
        console.error("Cron Ultah Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
