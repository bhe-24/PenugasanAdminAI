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
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const bulanRomawi = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][d.getMonth()];
        const tahun = d.getFullYear(); 

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
        
        const nomorFormat = String(urutanSelanjutnya).padStart(3, '0');
        const autoNoSurat = `${nomorFormat}/${kategori}/CA/${bulanRomawi}/${tahun}`;

        // =========================================================================
        // PROMPT SUPER PROFESIONAL (DI-UPGRADE UNTUK PRESISI & ANTI-KARANGAN)
        // =========================================================================
        const promptText = `
Anda adalah Sekretaris Jenderal Eksekutif dan Ahli Tata Naskah Dinas di "Cendekia Aksara" (Komunitas Literasi & Pendidikan Indonesia).
Tugas Anda adalah merangkai teks Surat Resmi (kategori: ${kategori}) yang sangat elegan, berbobot, presisi, dan mematuhi PUEBI.

KONTEKS / PERINTAH DASAR SURAT DARI PIMPINAN: 
"${konteks}"

INSTRUKSI KHUSUS:
"${instruksi_khusus || 'Gunakan diksi yang meyakinkan, lugas, dan profesional.'}"

ATURAN PENULISAN MUTLAK (WAJIB DIPATUHI):
1. SUDUT PANDANG & TONE: Selalu gunakan kata ganti "Kami" (mewakili instansi Cendekia Aksara). Gunakan nada yang berwibawa, menghormati, dan tegas.
2. PERIHAL: Maksimal 3-5 kata yang merangkum inti surat. (Contoh: "Penerbitan Nomor Sertifikat", "Surat Keputusan Kepengurusan").
3. TUJUAN (Kepada Yth): Susun secara hierarkis minimal 2 baris (Jabatan/Nama, lalu Instansi/Lokasi).
4. STRUKTUR PARAGRAF (PENTING):
   - JANGAN membuat surat hanya 1 paragraf! Pecah menjadi struktur yang logis.
   - Jika ini Surat Keputusan (SK) atau Surat Edaran, buatkan poin-poin keputusan di bagian isi (Misal: "Memutuskan: PERTAMA..., KEDUA...").
   - Jika ini surat pemberitahuan/permohonan, pecah menjadi paragraf Latar Belakang dan paragraf Inti Maksud.
5. PARAGRAF PENUTUP: Berisi kalimat konklusif, harapan kerja sama/kehadiran, dan ucapan terima kasih yang formal. 
6. ATURAN LAMPIRAN (SANGAT KETAT): 
   - JANGAN MENGARANG LAMPIRAN. Jika konteks hanya sekadar "pemberitahuan", "minta nomor", atau "teguran", KOSONGKAN lampiran.
   - Buat lampiran HANYA jika konteks dari pimpinan SECARA EKSPLISIT meminta pembuatan "Susunan Acara", "Daftar Peserta", "Rundown", atau "Ketentuan".
7. LARANGAN KERAS: JANGAN pernah menuliskan Nomor Surat, Tanggal, Tempat, Nama Tanda Tangan, atau Kop Surat di dalam teks JSON Anda.

Output WAJIB berupa JSON absolut tanpa markdown tambahan dengan format persis seperti ini:
{
  "perihal": "string",
  "tujuan": "string (Gunakan \\n untuk baris baru)",
  "pembuka": "string (Paragraf 1: Pengantar atau latar belakang. Jika ini SK, tuliskan konsideran Menimbang/Mengingat jika perlu)",
  "isi_utama": "string (Paragraf 2/3: Inti surat. Gunakan \\n\\n untuk paragraf baru. Boleh pakai numbering 1. 2. 3. jika itu SK atau rincian)",
  "penutup": "string (Paragraf terakhir penutup)",
  "lampiran_teks": "string (Opsional. HANYA JIKA diminta dalam konteks. Kosongkan string (\"\") jika tidak butuh lampiran)"
}
`;

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.4, // Diturunkan ke 0.4 agar SANGAT logis dan tidak sembarangan berkhayal
                responseMimeType: "application/json" 
            },
            safetySettings: safetySettings
        });
        
        let textResponse = result.response.text();
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const finalResult = JSON.parse(textResponse);

        finalResult.no_surat = autoNoSurat;

        // --- PENYESUAIAN FORMAT KE FORM HTML ---
        // Karena di HTML kita hanya punya form 's_pembuka' dan 's_penutup' sebelum 'tabel',
        // kita gabungkan 'pembuka' dan 'isi_utama' dari AI ke dalam field 's_pembuka' HTML.
        const gabunganPembukaDanIsi = finalResult.pembuka + "\n\n" + (finalResult.isi_utama || "");
        
        // Kembalikan ke format yang dibaca oleh HTML admin/generator-surat.html
        res.status(200).json({
            no_surat: finalResult.no_surat,
            perihal: finalResult.perihal,
            tujuan: finalResult.tujuan,
            pembuka: gabunganPembukaDanIsi, // Gabungan agar paragrafnya panjang
            penutup: finalResult.penutup,
            lampiran_teks: finalResult.lampiran_teks
        });

    } catch (error) {
        console.error("API Surat Error:", error);
        res.status(500).json({ error: error.message || "Sistem Sekretaris AI sedang sibuk merangkai surat, silakan coba lagi." });
    }
}
