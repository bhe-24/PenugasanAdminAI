// File: api/cron-ultah.js (api/corn-ultah.js)
// Dipanggil terjadwal otomatis oleh Vercel Cron setiap hari pukul 07:05 WIB (00:05 UTC)
// Mengirimkan ucapan selamat ulang tahun ke siswa yang berulang tahun hari ini
// dan notifikasi broadcast ucapan ke teman-temannya via OneSignal Push

import admin from 'firebase-admin';

const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";

function getFirestoreDb() {
    try {
        if (!admin.apps.length) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : null;

            if (process.env.FIREBASE_PROJECT_ID && privateKey && process.env.FIREBASE_CLIENT_EMAIL) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: privateKey,
                    })
                });
            } else {
                return null;
            }
        }
        return admin.firestore();
    } catch (e) {
        console.warn("[Cron-Ultah] Firebase Admin init error:", e.message);
        return null;
    }
}

async function sendPush({ targetUserId, excludeUserId, judul, pesan, urlTujuan, jenis }) {
    const apiKey = process.env.ONESIGNAL_API_KEY;
    if (!apiKey) {
        console.log(`[Cron-Ultah Sim] Push: ${judul} -> ${pesan}`);
        return true;
    }

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            target_channel: "push",
            headings: { en: judul, id: judul },
            contents: { en: pesan, id: pesan },
            url: urlTujuan ? (urlTujuan.startsWith('http') ? urlTujuan : `https://penugasan-admin-ai.vercel.app${urlTujuan}`) : "https://penugasan-admin-ai.vercel.app/siswa/ultah.html",
            chrome_web_icon: "https://i.imgur.com/5Srjyo4.png",
            chrome_web_badge: "https://i.imgur.com/5Srjyo4.png",
            priority: 10,
            ttl: 86400
        };

        if (targetUserId) {
            payload.include_aliases = { external_id: [targetUserId] };
        } else {
            payload.included_segments = ["Total Subscriptions"];
        }

        const res = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + apiKey
            },
            body: JSON.stringify(payload)
        });
        return res.ok;
    } catch (err) {
        console.error("[Cron-Ultah] Push error:", err.message);
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log("[Cron-Ultah] Menjalankan Robot Pengecek Ulang Tahun Siswa...");

        const db = getFirestoreDb();
        if (!db) {
            return res.status(200).json({
                success: true,
                mode: 'simulation_ready',
                message: 'Firebase Admin credentials belum dikonfigurasi di environment. Layanan cron ultah siap berjalan saat credential terpasang.'
            });
        }

        // Ambil waktu hari ini (WIB - Asia/Jakarta)
        const today = new Date();
        const options = { timeZone: 'Asia/Jakarta' };
        const localeDate = today.toLocaleDateString('en-CA', options); // Format: YYYY-MM-DD
        const dateObj = new Date(localeDate);

        const currentMonthDay = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        const currentYear = dateObj.getFullYear().toString();

        // Tarik data siswa
        const usersSnap = await db.collection('users').where('role', '==', 'siswa').get();
        let totalNotified = 0;

        for (const docSnap of usersSnap.docs) {
            const data = docSnap.data();
            if (!data.tanggalLahir) continue;

            const parts = data.tanggalLahir.split('-');
            let userMonthDay = "";
            if (parts.length === 3) {
                userMonthDay = parts[0].length === 4 ? `${parts[1]}-${parts[2]}` : `${parts[1]}-${parts[0]}`;
            }

            if (userMonthDay === currentMonthDay && data.lastNotifiedYear !== currentYear) {
                const userId = docSnap.id;
                const userName = data.name || "Siswa Cendekia";

                // A. Push Notifikasi Khusus Siswa yang Berulang Tahun
                await sendPush({
                    targetUserId: userId,
                    judul: `🎉 Selamat Ulang Tahun, ${userName}!`,
                    pesan: `Selamat hari lahir dari keluarga besar Cendekia Aksara! Buka kejutan spesial dan hadiah literasimu hari ini.`,
                    urlTujuan: "/siswa/ultah.html",
                    jenis: "ultah"
                });

                // B. Push Notifikasi ke Teman-Teman
                await sendPush({
                    excludeUserId: userId,
                    judul: `🎂 Hari ini ${userName} Ulang Tahun!`,
                    pesan: `Yuk kirimkan ucapan hangat dan doa terbaikmu untuk ${userName}!`,
                    urlTujuan: `/siswa/ultah.html?u=${userId}`,
                    jenis: "ultah_teman"
                });

                // C. Update penanda tahun agar tidak spam
                await docSnap.ref.update({
                    lastNotifiedYear: currentYear
                });

                totalNotified++;
                console.log(`[Cron-Ultah] Berhasil mengirim push ultah untuk: ${userName}`);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Pengecekan ultah selesai. ${totalNotified} siswa berulang tahun hari ini.`,
            totalNotified
        });

    } catch (error) {
        console.error("[Cron-Ultah] Error:", error);
        return res.status(200).json({
            success: false,
            error: error.message
        });
    }
}
