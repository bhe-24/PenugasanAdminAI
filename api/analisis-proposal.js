import { GoogleGenAI } from '@google/genai';

// Inisialisasi SDK resmi Google terbaru
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // 1. ATUR CORS (Agar frontend bisa menghubungi API)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Tangani preflight request dari browser dengan cepat
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 2. PARSING & VALIDASI DATA
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        // DIAGNOSTIK 1: Cek apakah data dari web kosong/gagal dikirim
        if (!data || !data.judul || !data.studentName) {
            return res.status(200).json({ 
                analisis_teks: "⚠ DIAGNOSTIK API: Data naskah tidak terbaca oleh server. Tolong pastikan koneksi internet stabil dan coba klik tombol evaluasi lagi." 
            });
        }

        // 3. EKSTRAKSI OUTLINE
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && Array.isArray(data.outline) && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        // 4. SUSUN KONTEKS REVISI (AI Multi-turn)
        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `STATUS NASKAH: INI ADALAH NASKAH REVISI.\nSebelumnya, aku (mentor) memberikan catatan ini kepada penulis:\n--- CATATAN SEBELUMNYA ---\n'${data.feedback_mentor}'\n--------------------------\nTUGASMU: Cek apakah dia sudah memperbaikinya! Tegur jika dia ngeyel, beri apresiasi singkat jika sudah benar, lalu lanjut bedah celah lainnya.`;
        } else {
            konteksRevisi = `STATUS NASKAH: PENGAJUAN BARU.\nIni adalah ide pertama dari ${data.studentName}. Bedah kelogisan ide, konflik, dan cari plot holenya.`;
        }

        // 5. PROMPT UTAMA
        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional dan memberi solusi yang actionable. Sesekali selipkan sindiran tajam kalau ada bagian klise atau malas. Gunakan kata sapaan "Aku" dan "Kamu", bahasa gaul, to the point.

Tugas: Evaluasi proposal naskah "${data.judul}" karya ${data.studentName}.

${konteksRevisi}

Data Naskah:
- Genre: ${data.genre}
- Target: ${data.target_kata} kata
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

Ketentuan Review MUTLAK:
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! (Dilarang pakai "Halo", "Terima kasih", "Semoga sukses", dll). LANGSUNG TEMBAK KE INTINYA!
2. Bedah tajam kelogisan Judul, Genre, dan Target Kata.
3. Cari plot hole, kritik jika Logline/Sinopsis/Outline lemah atau klise. Beri contoh perbaikan konkret.
4. Sesuaikan nadamu: Makin berantakan naskahnya, makin pedas kritikanmu. Makin rapi, makin suportif tapi tetap tegas.
5. Tuliskan jawaban HANYA DALAM TEKS BIASA. DILARANG KERAS menggunakan Markdown (seperti bintang * untuk tebal/miring).
6. WAJIB tulis baris terakhir jawabanmu PERSIS seperti ini: "Skor Kesiapan Naskah: [angka]/100"
`;

        // 6. PANGGIL API GOOGLE GEMINI
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: promptText,
            config: {
                temperature: 0.7,
                maxOutputTokens: 2500,
                // Matikan sensor agar AI "galak" tidak diblokir
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });

        // 7. AMBIL HASIL TEKS
        let textResponse = result.text || "";

        // DIAGNOSTIK 2: Cek jika AI merespons kosong (Sensor keamanan Google tetap memblokir diam-diam)
        if (!textResponse || textResponse.trim() === "") {
            const rawData = JSON.stringify(result, null, 2);
            return res.status(200).json({ 
                analisis_teks: `⚠ SISTEM AI MENOLAK MENJAWAB.\nGoogle AI memblokir prompt karena alasan keamanan internal. Berikut data mentah dari sistem:\n\n${rawData}` 
            });
        }

        // 8. BERSIHKAN KARAKTER BINTANG (Jaga-jaga kalau AI ngeyel pakai markdown)
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        // 9. KEMBALIKAN HASIL KE FRONTEND
        res.status(200).json({ analisis_teks: cleanFeedback });

    } catch (error) {
        console.error("AI Error:", error);
        
        // DIAGNOSTIK 3: Status 200 di Catch. 
        // Ini SANGAT PENTING. Kalau pakai 500, frontend kadang mengabaikannya dan layar tetap kosong.
        // Dengan 200, error aslinya (misal salah API Key, limit habis, dsb) akan TERCETAK JELAS di kotak mentor.
        res.status(200).json({
            analisis_teks: `⚠ TERJADI CRASH PADA SERVER GOOGLE GEMINI:\n\nDetail Error: ${error.message}\n\nSolusi: Cek apakah GEMINI_API_KEY di Vercel sudah benar, atau kuota API limit sudah habis.`
        });
    }
}
