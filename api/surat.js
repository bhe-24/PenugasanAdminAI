const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

module.exports = async function handler(req, res) {
    // Pengaturan CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("API Key Gemini tidak ditemukan.");
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const { kategori, nomor_terakhir, konteks, instruksi_khusus } = req.body;

        if (!kategori || !konteks) return res.status(400).json({ error: 'Data tidak lengkap.' });

        const d = new Date();
        const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][d.getMonth()];
        const tahun = d.getFullYear();

        // Prompt Super untuk Sekretaris AI
        const promptText = `
Peran: Anda adalah Sekretaris Jenderal "Cendekia Aksara" (Komunitas Literasi Edukatif).
Tugas: Menyusun Draf Surat Resmi berdasarkan instruksi admin.

KODE KATEGORI SURAT: ${kategori}
NOMOR SURAT TERAKHIR KATEGORI INI: ${nomor_terakhir || 'Belum ada surat'}
KONTEKS & INFORMASI SURAT: 
${konteks}

INSTRUKSI KHUSUS DARI ADMIN:
${instruksi_khusus || 'Tidak ada instruksi khusus. Buat senatural mungkin.'}

ATURAN PENULISAN:
1. Hitung Nomor Surat Selanjutnya. Jika nomor terakhir adalah 002/MEDPART/X/2026, maka surat ini adalah 003/${kategori}/${bulanRomawi}/${tahun}. Jika belum ada, mulai dari 001.
2. Gaya Bahasa: Sopan, kontekstual, luwes, meyakinkan, namun tetap menjaga tata krama formal (tidak kaku seperti robot). Gunakan kata ganti "Kami" untuk pengirim.
3. Struktur: Buka dengan salam hormat, isi maksud dan tujuan secara jelas (masukkan informasi dari admin), dan tutup dengan harapan serta salam.
4. JANGAN menggunakan tag HTML <table>. Jika admin meminta tabel (misal daftar delegasi), gunakan format Bullet Points (-) atau penomoran (1. 2. 3.) yang rapi karena ini akan dicetak ke dalam file teks (Google Docs).

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "no_surat": "(Nomor surat hasil perhitungan)",
  "perihal": "(Perihal/Hal surat, singkat & jelas)",
  "tujuan": "(Nama instansi/orang yang dituju)",
  "isi_surat": "(Seluruh paragraf isi surat. Gunakan \\n\\n untuk paragraf baru. JANGAN cantumkan tempat/tanggal di atas, dan JANGAN cantumkan tanda tangan di bawah, cukup isi intinya saja karena kop & TTD sudah ada di template kertas)."
}
`;

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
            safetySettings: safetySettings
        });
        
        let textResponse = result.response.text();
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const finalResult = JSON.parse(textResponse);

        res.status(200).json(finalResult);

    } catch (error) {
        console.error("API Surat Error:", error);
        res.status(500).json({ error: error.message });
    }
}
