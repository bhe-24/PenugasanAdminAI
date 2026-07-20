const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async function handler(req, res) {
    // Pengaturan CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { bulan, tema } = req.body;

        if (!bulan || !tema) {
            return res.status(400).json({ error: 'Bulan dan Tema wajib diisi.' });
        }

        const promptText = `
Peran: Kamu adalah Asisten Resmi Nubar Literasi (Nulis Bareng), sebuah program penerbitan buku antologi yang diselenggarakan secara berkala. Tugasmu adalah memberikan informasi lengkap, terstruktur, dan konsisten mengenai setiap periode Nubar Literasi.

Konsep Dasar:
Nubar Literasi adalah program Open Submission Antologi. Peserta yang mendaftar WAJIB sudah memiliki naskah yang selesai sesuai ketentuan. Program ini bukan kelas belajar menulis dari awal, melainkan wadah untuk menghimpun karya para penulis agar diterbitkan dalam satu buku antologi. Sebagai pendamping, setiap peserta akan memperoleh E-Book Materi yang berisi panduan sesuai tema periode. E-book tersebut berfungsi sebagai referensi untuk meningkatkan kualitas karya, bukan sebagai tugas yang harus diselesaikan.

Instruksi Saat Ini:
Buatkan rancangan proyek Nubar Literasi untuk periode "${bulan}" dengan Tema Utama "${tema}". Pastikan konsep ini UNIK dan memiliki ciri khas yang membedakannya dengan proyek periode lain.

OUTPUT WAJIB (Harus dalam Format JSON Murni tanpa Markdown \`\`\`json):
{
  "informasi_periode": {
    "nama_periode": "Nubar Literasi [Bulan Tahun]",
    "tema_utama": "[Tema]",
    "tagline": "[Tagline Menarik]",
    "deskripsi": "[Deskripsi singkat kegiatan]"
  },
  "konsep_buku": {
    "judul_sementara": "[Judul Buku]",
    "makna_tema": "[Makna tema]",
    "target_pembaca": "[Target]",
    "nuansa_buku": "[Nuansa]",
    "tujuan_penerbitan": "[Tujuan]"
  },
  "ketentuan_naskah": [
    "Jenis karya: ...", "Tema: ...", "Jumlah kata: ...", "Format penulisan: ...", "Font: ...", "Bahasa: ...", "Orisinalitas: ...", "Larangan: ...", "Revisi: ..."
  ],
  "ebook_materi": [
    "Isi 1", "Isi 2", "Isi 3", "Isi 4", "Isi 5"
  ],
  "alur_kegiatan": [
    "1. Pembukaan pendaftaran peserta.", "2. ...", "3. ..."
  ],
  "timeline": [
    { "kegiatan": "Pendaftaran Peserta", "waktu": "Minggu ke-1" },
    { "kegiatan": "Batas Pengumpulan", "waktu": "Minggu ke-2" }
  ],
  "progress_proyek": [
    "Pendaftaran peserta.", "Pengumpulan naskah.", "Seleksi administrasi.", "Editing.", "Layout."
  ],
  "konsep_cover": {
    "warna_dominan": "[Warna]",
    "gaya_ilustrasi": "[Gaya]",
    "nuansa_visual": "[Nuansa]",
    "tipografi": "[Font Cover]",
    "elemen_utama": "[Elemen]",
    "mood": "[Mood]"
  },
  "konsep_layout": {
    "ukuran_buku": "[Ukuran, misal 14x20 cm]",
    "font_isi": "[Font]",
    "tata_letak": "[Layout]",
    "ornamen": "[Ornamen]",
    "pembuka_bab": "[Gaya Bab]",
    "daftar_isi": "[Gaya Daftar Isi]"
  },
  "target_akhir": [
    "Karyanya terbit dalam buku antologi.", "Mendapat e-book materi.", "Mendapat pengalaman penerbitan."
  ]
}
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.8, // Sedikit kreatif agar tiap proyek tidak monoton
                responseMimeType: "application/json" 
            }
        });
        
        let textResponse = result.response.text();
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const finalResult = JSON.parse(textResponse);
        res.status(200).json(finalResult);

    } catch (error) {
        console.error("API Nubar Error:", error);
        res.status(500).json({ error: error.message || "Sistem AI sedang sibuk." });
    }
}
