import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { materi, jumlahSoal } = req.body;

        if (!materi || materi.trim() === '') {
            return res.status(400).json({ error: 'Materi tidak boleh kosong' });
        }

        const jumlah = jumlahSoal || 5; // Default 5 soal

        // 2. SUSUN PROMPT UNTUK GENERATOR KUIS
        const promptText = `
Tugas Anda adalah membuat ${jumlah} soal Pilihan Ganda (A, B, C, D) berdasarkan materi berikut. 
Soal harus merupakan campuran dari pertanyaan teori (konseptual) dan contoh kasus/penerapan dari materi tersebut.

MATERI PELAJARAN:
"${materi}"

SYARAT DAN FORMAT PENULISAN (Sangat Ketat):
1. Tulis soal di baris pertama.
2. Baris berikutnya adalah pilihan jawaban (A, B, C, D).
3. Berikan tanda bintang (*) di depan pilihan jawaban yang BENAR.
4. Pisahkan setiap soal dengan Satu Baris Kosong (Enter 2x).
5. DILARANG menggunakan awalan angka pada nomor soal (jangan tulis "1.", langsung saja tulis soalnya).
6. DILARANG menambahkan teks pembuka seperti "Berikut adalah soalnya" atau teks penutup. Langsung berikan output format soal.

CONTOH OUTPUT YANG DIHARAPKAN:
Ibu kota Indonesia adalah?
A. Bandung
*B. Jakarta
C. Surabaya
D. Medan

Berdasarkan teori gravitasi, jika buah apel terlepas dari tangkainya, maka buah tersebut akan jatuh ke bawah. Fenomena ini pertama kali dirumuskan oleh?
*A. Isaac Newton
B. Albert Einstein
C. Galileo Galilei
D. Thomas Alva Edison
`;

        // 3. PANGGIL GEMINI AI
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.3 } // Temperature rendah agar patuh pada format
        });
        
        let textResponse = result.response.text();
        
        // Membersihkan markdown jika AI bandel
        textResponse = textResponse.replace(/```text/gi, '').replace(/```/g, '').trim();

        // 4. KIRIM HASIL KE FRONTEND
        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.error("AI Error (Kuis Generator):", error);
        res.status(500).json({ error: "Gagal membuat soal dengan AI." });
    }
}
