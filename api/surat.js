import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from '@google/generative-ai';

// Inisialisasi diletakkan di luar fungsi utama
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // Pengaturan CORS untuk keamanan dan aksesibilitas
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { kategori, nomor_terakhir, konteks, instruksi_khusus } = req.body;

        if (!kategori || !konteks) {
            return res.status(400).json({ error: 'Data tidak lengkap. Kategori dan konteks wajib diisi.' });
        }

        // --- SISTEM PENOMORAN MUTLAK (SERVER-SIDE) ---
        // Memastikan waktu di-set ke Zona Waktu Indonesia (WIB)
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][d.getMonth()];
        const tahun = d.getFullYear(); 

        // Kalkulasi nomor urut selanjutnya
        let urutanSelanjutnya = 1;
        if (nomor_terakhir && typeof nomor_terakhir === 'string') {
            const parts = nomor_terakhir.split('/');
            if (parts.length > 0) {
                const angkaTerakhir = parseInt(parts[0], 10);
                if (!isNaN(angkaTerakhir)) {
                    urutanSelanjutnya = angkaTerakhir + 1;
                }
            }
        }
        
        // Memformat jadi 3 digit (Contoh: 001, 002, 015)
        const nomorFormat = String(urutanSelanjutnya).padStart(3, '0');
        const autoNoSurat = `${nomorFormat}/${kategori}/CA/${bulanRomawi}/${tahun}`;

        // =========================================================================
        // PROMPT SUPER PROFESIONAL (DI-UPGRADE UNTUK SURAT RESMI TINGKAT TINGGI)
        // =========================================================================
        const promptText = `
Anda adalah Sekretaris Jenderal Eksekutif dan Ahli Tata Naskah Dinas di "Cendekia Aksara" (Komunitas Literasi & Pendidikan Indonesia).
Tugas Anda adalah merangkai teks Surat Resmi yang sangat elegan, berbobot, presisi, dan mematuhi PUEBI (Pedoman Umum Ejaan Bahasa Indonesia).

KONTEKS / PERINTAH DASAR SURAT: 
"${konteks}"

INSTRUKSI KHUSUS DARI PIMPINAN:
"${instruksi_khusus || 'Gunakan diksi yang meyakinkan, lugas, dan profesional.'}"

ATURAN PENULISAN MUTLAK (WAJIB DIPATUHI):
1. SUDUT PANDANG & TONE: Selalu gunakan kata ganti "Kami" (mewakili instansi Cendekia Aksara). Gunakan nada yang berwibawa, menghormati, namun tegas. Hindari kalimat bertele-tele.
2. PERIHAL: Buat maksimal 3-5 kata yang merangkum inti surat dengan padat. (Contoh: "Permohonan Peminjaman Gedung", "Undangan Pemateri Seminar").
3. TUJUAN (Kepada Yth): Susun secara hierarkis minimal 2 baris (Jabatan/Nama, lalu Instansi/Lokasi).
4. PARAGRAF PEMBUKA: Harus elegan. Dimulai tepat dengan kata "Dengan hormat," (langsung digabung dengan kalimat pertama). Berikan dasar pemikiran atau latar belakang singkat yang rasional mengapa surat ini dibuat.
5. PARAGRAF PENUTUP: Berisi kalimat konklusif, harapan kerja sama/kehadiran, dan ucapan terima kasih yang formal. 
6. LAMPIRAN CERDAS: Jika konteks surat mengisyaratkan adanya acara, perlombaan, atau kegiatan, ANDA WAJIB membuatkan rancangan "Susunan Acara (Rundown)" atau "Ketentuan Kegiatan" yang rapi di dalam *field* \`lampiran_teks\`.
7. LARANGAN KERAS: JANGAN pernah menuliskan Nomor Surat, Tanggal, Tempat, Nama Tanda Tangan, atau Kop Surat di dalam teks JSON Anda. Kami hanya butuh ISI TEKSNYA saja.

Output WAJIB berupa JSON absolut tanpa markdown tambahan (\`\`\`json) dengan format struktur persis seperti ini:
{
  "perihal": "string",
  "tujuan": "string (Gunakan \\n untuk baris baru)",
  "pembuka": "string (Paragraf pembuka yang solid)",
  "penutup": "string (Paragraf penutup yang formal)",
  "lampiran_teks": "string (Opsional. Tuliskan susunan acara, syarat lomba, atau daftar nama jika diperlukan. Gunakan format teks rapi dengan indentasi atau poin-poin. Kosongkan string jika tidak butuh lampiran)"
}
`;

        // Filter keamanan dilonggarkan penuh untuk mencegah AI menolak memproses teks
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        // Menggunakan model Gemini 2.5 Flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.5, // Diturunkan ke 0.5 agar AI lebih logis, kaku, resmi, dan tidak terlalu berkhayal (kreatif)
                responseMimeType: "application/json" 
            },
            safetySettings: safetySettings
        });
        
        let textResponse = result.response.text();
        
        // PEMBERSIH KODE (ANTI-ERROR)
        // Kadang AI tetap mengirimkan format markdown ```json ... ``` meskipun sudah dilarang
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

        // Parsing JSON
        const finalResult = JSON.parse(textResponse);

        // KUNCI UTAMA: Inject No. Surat yang dihitung mutlak oleh Server
        finalResult.no_surat = autoNoSurat;

        res.status(200).json(finalResult);

    } catch (error) {
        console.error("API Surat Error:", error);
        res.status(500).json({ error: error.message || "Sistem Sekretaris AI sedang sibuk merangkai surat, silakan coba lagi." });
    }
}
