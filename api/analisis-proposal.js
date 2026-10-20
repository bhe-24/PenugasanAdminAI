// File: api/mentor.js
import OpenAI from 'openai';

// ---------------------------------------------------------
// 1. INISIALISASI KLIEN API
// ---------------------------------------------------------

// Klien Groq (UTAMA) - Langsung ke server Groq
const groq = process.env.GROQ_API_KEY ? new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
}) : null;

// Klien OpenRouter (CADANGAN TERAKHIR)
const openrouter = process.env.OPENROUTER_API_KEY ? new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://edu-cendekia.my.id', 
        'X-Title': 'Cendekia Aksara AI Mentor'
    }
}) : null;

// ---------------------------------------------------------
// 2. DAFTAR MODEL
// ---------------------------------------------------------

// DAFTAR MODEL GROQ (PRIORITAS UTAMA - Langsung dari console Groq milikmu)
const GROQ_MODELS = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-safeguard-20b'
];

// DAFTAR MODEL OPENROUTER (HANYA CADANGAN JIKA GROQ DOWN TOTAL)
const OPENROUTER_MODELS = [
    'nvidia/nemotron-3-ultra-550b-a55b:free', 
    'google/gemma-4-26b-a4b-it:free'
];

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        // Validasi Data
        if (!data || !data.judul || !data.studentName) {
            return res.status(200).json({ analisis_teks: "⚠ DIAGNOSTIK API: Data naskah tidak terbaca oleh server." });
        }

        // Ekstraksi Outline
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && Array.isArray(data.outline) && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        // Konteks Revisi
        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `\n\nSTATUS NASKAH: INI ADALAH NASKAH REVISI.\nSebelumnya, aku (mentor) sudah memberikan catatan revisi berikut kepada penulis:\n--- CATATAN SEBELUMNYA ---\n'${data.feedback_mentor}'\n--------------------------\nTUGASMU SEKARANG: Cek apakah dia sudah memperbaiki logline/sinopsis/outlinenya sesuai catatanku di atas! Langsung tegur -- kalau perlu dengan sindiran -- kalau dia ngeyel/belum diperbaiki, atau kasih apresiasi singkat (tetap tegas, jangan lembek) kalau sudah benar, lalu lanjut bedah celah lainnya.`;
        } else {
            konteksRevisi = `\n\nSTATUS NASKAH: PENGAJUAN BARU.\nIni adalah ide pertama dari ${data.studentName}. Langsung bedah kelogisan ide, konflik, dan cari plot holenya.`;
        }

        // PROMPT UTAMA (Mentor Galak, Sangat Kritis, & Format Super Ketat)
        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional dan selalu memberi arahan yang jelas dan actionable, bukan cuma marah-marah tanpa solusi. Sesekali selipkan sindiran kecil kalau ada bagian yang jelas-jelas lemah atau klise, supaya penulis paham dan "kena", tapi jangan sampai merendahkan atau menyerang pribadi. Gunakan bahasa "Aku" dan "Kamu", gaul, tajam, to the point.

Tugas: Evaluasi proposal naskah "${data.judul}" karya "${data.studentName}".${konteksRevisi}

Data Naskah:
- Genre: ${data.genre}
- Target: ${data.target_kata} kata
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

LANGKAH INTERNAL (jangan ditulis di jawaban, cukup dipakai untuk menentukan nada bicaramu):
Nilai sendiri secara diam-diam seberapa siap naskah ini untuk di-ACC, dalam skala 0-100%, berdasarkan kelogisan ide, kekuatan logline, kedalaman sinopsis, dan kerapian outline.

Ketentuan Review (SANGAT KETAT):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Dilarang keras memakai kata seperti "Halo", "Terima kasih sudah submit", "Tentu, mari kita bedah", atau "Semoga sukses". LANGSUNG TEMBAK KE INTINYA.
2. Bedah kelogisan Judul, Genre, dan Target Kata.
3. Berikan KRITIKAN TAJAM pada Logline/Sinopsis/Outline. Cari celah plot hole atau klise, dan kalau ada bagian yang klise/lemah, boleh sindir sedikit. Jika ada yang kurang sesuai, berikan contoh perbaikan yang konkret.
4. Di bagian akhir, sesuaikan nada penutupmu berdasarkan skor kesiapan yang kamu nilai sendiri:
   - Skor di bawah 75%: Tutup dengan tegas bahwa ini WAJIB REVISI.
   - Skor 75-84%: Bilang bahwa naskah ini SUDAH DEKAT tapi belum boleh di-ACC.
   - Skor 85-89%: Bilang ini SUDAH BOLEH DI-ACC, tapi tetap beri arahan hal minor.
   - Skor 90-100%: Naskah SANGAT SIAP. Tetap tegas, jangan berlebihan memuji.
5. WAJIB tulis baris terakhir jawabanmu persis dengan format ini: "Skor Kesiapan Naskah: [angka]/100"
6. Gunakan baris baru (enter) antar paragraf agar enak dipandang.
7. Tuliskan jawaban dalam teks biasa (plain text). DILARANG KERAS menggunakan Markdown tebal/miring (**teks** atau *teks*).
8. PASTIKAN ulasanmu dijawab sampai tuntas, kalimat selesai dengan titik, dan tidak terpotong di akhir.
9. JANGAN PERNAH menuliskan proses berpikirmu di tengah jawaban. Langsung hasil akhirnya saja.
`;

        let textResponse = "";
        let modelUsed = "";
        let lastError = null;
        let isSuccess = false;

        // ========================================================
        // EKSEKUSI TIER 1: GROQ SEBAGAI UTAMA
        // ========================================================
        if (groq) {
            for (const model of GROQ_MODELS) {
                try {
                    console.log(`Mencoba Groq (Utama) dengan model: ${model}...`);
                    const completion = await groq.chat.completions.create({
                        model: model,
                        messages: [
                            { role: 'system', content: 'Kamu adalah editor penerbitan novel profesional. Taati instruksi roleplay dengan ketat dan patuhi seluruh format aturan review tanpa terkecuali.' },
                            { role: 'user', content: promptText }
                        ],
                        temperature: 0.7,
                        max_tokens: 2500
                    });

                    textResponse = completion.choices[0]?.message?.content || "";
                    if (textResponse.trim()) {
                        modelUsed = `Groq - ${model}`;
                        isSuccess = true;
                        break; 
                    }
                } catch (err) {
                    console.warn(`Groq gagal memanggil ${model}:`, err.message);
                    lastError = err;
                }
            }
        } else {
            console.warn("GROQ_API_KEY tidak ditemukan. Melewati Tier 1...");
        }

        // ========================================================
        // EKSEKUSI TIER 2: OPENROUTER (HANYA JIKA GROQ GAGAL TOTAL)
        // ========================================================
        if (!isSuccess && openrouter) {
            console.warn("Semua model Groq gagal/tidak tersedia. Beralih ke OpenRouter (Cadangan)...");
            for (const model of OPENROUTER_MODELS) {
                try {
                    console.log(`Mencoba OpenRouter dengan model: ${model}...`);
                    const completion = await openrouter.chat.completions.create({
                        model: model,
                        messages: [
                            { role: 'system', content: 'Kamu adalah editor penerbitan novel profesional. Taati instruksi roleplay dengan ketat dan patuhi seluruh format aturan review tanpa terkecuali.' },
                            { role: 'user', content: promptText }
                        ],
                        temperature: 0.7,
                        max_tokens: 2500
                    });

                    textResponse = completion.choices[0]?.message?.content || "";
                    if (textResponse.trim()) {
                        modelUsed = `OpenRouter - ${model}`;
                        isSuccess = true;
                        break;
                    }
                } catch (err) {
                    console.warn(`OpenRouter gagal memanggil ${model}:`, err.message);
                    lastError = err;
                }
            }
        }

        // Jika semua API (Groq dan OpenRouter) hancur berantakan
        if (!isSuccess) {
            throw new Error(`Semua AI Engine utama dan cadangan gagal. Error Terakhir: ${lastError?.message || "Tidak ada respon dari server"}`);
        }

        // Bersihkan karakter bintang jika AI tetap mengeluarkannya
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        // Kembalikan hasil ke Frontend
        res.status(200).json({ 
            analisis_teks: cleanFeedback,
            debug_model: modelUsed 
        });

    } catch (error) {
        console.error("AI System Error:", error);
        res.status(200).json({ 
            analisis_teks: `⚠ TERJADI KENDALA PADA SERVER AI:\n\nDetail Error: ${error.message}` 
        });
    }
}
