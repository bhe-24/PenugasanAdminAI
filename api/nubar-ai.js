export const config = {
    runtime: 'edge', // MANTRA RAHASIA MENGATASI TIMEOUT 10 DETIK VERCEL
};

export default async function handler(req) {
    // 1. PENGATURAN CORS UNTUK EDGE RUNTIME
    const corsHeaders = {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('OK', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { bulan, tema } = body;

        if (!bulan || !tema) {
            return new Response(JSON.stringify({ error: 'Bulan dan Tema wajib diisi.' }), { status: 400, headers: corsHeaders });
        }

        const promptText = `
Peran: Kamu adalah Tim Manajemen Konseptor Proyek Nubar Literasi (Nulis Bareng), sebuah program penerbitan buku antologi yang diselenggarakan secara berkala. Tugasmu adalah memberikan informasi lengkap, terstruktur, dan konsisten mengenai setiap periode Nubar Literasi.

Konsep Dasar:
Nubar Literasi adalah program Open Submission Antologi. Peserta yang mendaftar WAJIB sudah memiliki naskah yang selesai sesuai ketentuan. Program ini bukan kelas belajar menulis dari awal, melainkan wadah untuk menghimpun karya para penulis agar diterbitkan dalam satu buku antologi. Sebagai pendamping, setiap peserta akan memperoleh E-Book Materi yang berisi panduan sesuai tema periode.

Instruksi Saat Ini:
Buatkan rancangan proyek Nubar Literasi untuk periode "${bulan}" dengan Tema Utama "${tema}". Pastikan konsep ini UNIK dan memiliki ciri khas yang membedakannya dengan proyek periode lain.

OUTPUT WAJIB (JANGAN ADA KATA-KATA LAIN SELAIN JSON MURNI):
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

        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Fetch langsung dari backend (Edge)
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: { 
                    temperature: 0.8,
                    responseMimeType: "application/json" 
                }
            })
        });

        if (!response.ok) {
            const errGoogle = await response.text();
            throw new Error("Gagal menghubungi Google API: " + errGoogle);
        }

        const dataAI = await response.json();
        let textResponse = dataAI.candidates[0].content.parts[0].text;

        // PEMBERSIHAN EKSTREM ANTI-BASA-BASI
        const startIndex = textResponse.indexOf('{');
        const endIndex = textResponse.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1) {
            textResponse = textResponse.substring(startIndex, endIndex + 1);
        }

        // Return Data yang sudah bersih ke Frontend HTML
        return new Response(textResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error("API Nubar Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Sistem AI gagal memproses data." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
