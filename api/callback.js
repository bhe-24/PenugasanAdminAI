import crypto from 'crypto';
import admin from 'firebase-admin';

// Inisialisasi Firebase Admin (Hanya jalan sekali)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Gagal inisialisasi Firebase Admin:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { merchantCode, amount, merchantOrderId, signature, resultCode } = req.body;
    const apiKey = process.env.DUITKU_API_KEY;

    // 1. Validasi Keamanan (Wajib agar tidak ditembak hacker)
    const signatureString = merchantCode + amount + merchantOrderId + apiKey;
    const expectedSignature = crypto.createHash('md5').update(signatureString).digest('hex');

    if (signature !== expectedSignature) {
        return res.status(403).json({ message: 'Invalid Signature' });
    }

    // 2. Cek apakah pembayaran Lunas
    if (resultCode === '00') {
        // Ekstrak UID siswa dari merchantOrderId yang kita buat di create-qris.js (Format: UID-Timestamp)
        const uid = merchantOrderId.split('-')[0];

        try {
            // A. Update status siswa di koleksi 'users'
            await db.collection('users').doc(uid).update({
                statusPembayaran: 'Lunas',
                paymentStatus: 'verified',
                pendingAmount: 0
            });

            // B. (Opsional) Catat ke riwayat 'finance_logs' agar muncul di halaman Admin Pusatmu
            // Ambil data siswa dulu untuk dapatkan namanya
            const userSnap = await db.collection('users').doc(uid).get();
            const userData = userSnap.data();

            await db.collection('finance_logs').add({
                studentName: userData ? userData.name : 'Siswa',
                studentUid: uid,
                amount: parseInt(amount),
                semester: userData ? userData.semester : '-',
                type: 'Otomatis QRIS Duitku',
                adminName: 'Sistem',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[SUKSES] Pembayaran QRIS Lunas untuk UID: ${uid}`);
            return res.status(200).json({ status: 'Success' }); // Beri tahu Duitku kalau kita sudah terima

        } catch (error) {
            console.error("Gagal update database:", error);
            return res.status(500).json({ status: 'Database Error' });
        }
    } else {
        // Jika pembayaran gagal atau kedaluwarsa
        return res.status(200).json({ status: 'Failed or Expired' });
    }
}
