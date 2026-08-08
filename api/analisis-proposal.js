import OpenAI from 'openai';

// Inisialisasi Groq API
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

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

        // Konteks Revisi (Disesuaikan agar AI paham kalau siswa ngeyel)
        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `\n\nSTATUS NASKAH: INI ADALAH NASKAH REVISI.\nSebelumnya, aku (mentor) sudah memberikan catatan revisi berikut kepada penulis:\n--- CATATAN SEBELUMNYA ---\n'${data.feedback_mentor}'\n--------------------------\nTUGASMU SEKARANG: Cek apakah dia sudah memperbaiki logline/sinopsis/outlinenya sesuai catatanku di atas! Langsung tegur -- kalau perlu dengan sindiran -- kalau dia ngeyel/belum diperbaiki, atau kasih apresiasi singkat (tetap tegas, jangan lembek) kalau sudah benar, lalu lanjut bedah celah lainnya.`;
        } else {
            konteksRevisi = `\n\nSTATUS NASKAH: PENGAJUAN BARU.\nIni adalah ide pertama dari ${data.studentName}. Langsung bedah kelogisan ide, konflik, dan cari plot holenya.`;
        }

        // PROMPT UTAMA (Versi Mentor Galak & Kritis)
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
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Dilarang keras memakai kata seperti "Halo", "Terima kasih sudah submit", "Tentu, mari kita bedah", atau "Semoga sukses". LANGSUNG TEMBAK KE INTINYA (misal: "Hal pertama yang harus kamu revisi adalah...", atau "Ide ini cukup menarik, tapi...").
2. Bedah kelogisan Judul, Genre, dan Target Kata.
3. Berikan KRITIKAN TAJAM pada Logline/Sinopsis/Outline. Cari celah plot hole atau klise, dan kalau ada bagian yang klise/lemah, boleh sindir sedikit ("ide ini udah dipakai seribu naskah lain, coba cari sudut yang lebih personal"). Jika ada yang kurang sesuai, berikan contoh perbaikan yang konkret.
4. Di bagian akhir, sesuaikan nada penutupmu berdasarkan skor kesiapan yang kamu nilai sendiri di langkah internal tadi:
   - Skor di bawah 75%: Tutup dengan tegas bahwa ini WAJIB REVISI. Nada kritis dan galak, boleh sindir, tapi kasih daftar arahan perbaikan yang jelas dan konkret.
   - Skor 75-84%: Bilang bahwa naskah ini SUDAH DEKAT tapi belum boleh di-ACC. Pakai nada mendesak/memacu semangat, semacam "ayo dikit lagi, jangan lambat, tinggal beberapa hal ini yang harus kamu benerin dulu -- asalkan kamu BENERAN perbaiki, bukan asal ganti kata doang." Tetap sebutkan poin revisi yang konkret.
   - Skor 85-89%: Bilang ini SUDAH BOLEH DI-ACC, tapi tetap beri sedikit "ngedumel"/keluhan kecil soal hal-hal minor yang masih mengganjal, dan tetap kasih arahan jelas untuk penyempurnaan naskah ke depannya (bukan syarat wajib acc, cuma saran).
   - Skor 90-100%: Naskah SANGAT SIAP. Kurangi nada mengomel, kasih nasihat yang jelas dan tulus serta harapan untuk pengembangan naskah ke depan. Tetap tegas, jangan berlebihan memuji.
5. WAJIB tulis baris terakhir jawabanmu persis dengan format ini (untuk dibaca mentor manusia, bukan siswa): "Skor Kesiapan Naskah: [angka]/100"
6. Gunakan baris baru (enter) antar paragraf agar enak dipandang.
7. Tuliskan jawaban dalam teks biasa (plain text). DILARANG KERAS menggunakan Markdown seperti bintang-bintang untuk tebal/miring (**teks** atau *teks*) dan JANGAN menulis seluruh ulasan dengan HURUF KAPITAL.
8. PASTIKAN ulasanmu dijawab sampai tuntas, kalimat selesai dengan titik, dan tidak terpotong di akhir.
9. JANGAN PERNAH menuliskan proses berpikirmu, catatan internal, draft kasar, atau skor kesiapan di tengah jawaban -- hanya di baris terakhir sesuai format poin 5. Langsung tulis hasil evaluasi akhirnya saja.
`;

        // Panggil Groq API
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'Kamu adalah editor penerbitan novel profesional. Taati instruksi roleplay dengan ketat dan patuhi seluruh format aturan review.'
                },
                {
                    role: 'user',
                    content: promptText
                }
            ],
            temperature: 0.7,
            max_tokens: 2500
        });

        const textResponse = completion.choices[0]?.message?.content || "";

        // Bersihkan karakter bintang jika AI tetap mengeluarkannya
        let cleanFeedback = textResponse ? textResponse.replace(/\*/g, "").trim() : "⚠ Teks kosong dikembalikan oleh AI.";

        // Kembalikan ke Frontend dengan struktur JSON
        res.status(200).json({ analisis_teks: cleanFeedback });

    } catch (error) {
        console.error("AI Error (Groq):", error);
        
        // Cetak error ke layar jika ada masalah koneksi/limit
        res.status(200).json({ 
            analisis_teks: `⚠ TERJADI CRASH PADA SERVER GROQ AI:\n\nDetail Error: ${error.message}` 
        });
    }
}
