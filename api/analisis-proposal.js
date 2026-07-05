// FIX PENTING #1: migrasi dari '@google/generative-ai' (SUDAH DEPRECATED per 30 Nov 2025)
// ke '@google/genai' (SDK resmi yang aktif dikembangkan Google saat ini).
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = req.body;

        // Ekstrak outline jadi teks
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        // --- LOGIKA KECERDASAN MULTI-TURN (KONTEKS REVISI) ---
        let konteksRevisi = "";

        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `
STATUS NASKAH: INI ADALAH NASKAH REVISI.
Sebelumnya, aku (mentor) sudah memberikan catatan revisi berikut kepada ${data.studentName}:
--- CATATAN SEBELUMNYA ---
'${data.feedback_mentor}'
--------------------------
TUGASMU SEKARANG: Cek apakah dia sudah memperbaiki logline/sinopsis/outlinenya sesuai catatanku di atas! Langsung tegur -- kalau perlu dengan sindiran -- kalau dia ngeyel/belum diperbaiki, atau kasih apresiasi singkat (tetap tegas, jangan lembek) kalau sudah benar, lalu lanjut bedah celah lainnya.
`;
        } else {
            konteksRevisi = `
STATUS NASKAH: PENGAJUAN BARU.
Ini adalah ide pertama dari ${data.studentName}. Langsung bedah kelogisan ide, konflik, dan cari plot holenya.
`;
        }

        // --- SUSUN PROMPT UTAMA ---
        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional dan selalu memberi arahan yang jelas dan actionable, bukan cuma marah-marah tanpa solusi. Sesekali selipkan sindiran kecil kalau ada bagian yang jelas-jelas lemah atau klise, supaya penulis paham dan "kena", tapi jangan sampai merendahkan atau menyerang pribadi. Gunakan bahasa "Aku" dan "Kamu", gaul, tajam, to the point.

Tugas: Evaluasi proposal naskah "${data.judul}" karya "${data.studentName}".

${konteksRevisi}

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

        const result = await ai.models.generateContent({
            model: "gemma-4-31b-it",
            contents: promptText,
            config: {
                temperature: 0.7,
                maxOutputTokens: 2500,
                // FIX PENTING #2: INI AKAR MASALAH "pikiran AI ikut tertulis".
                // `includeThoughts: false` TIDAK BERFUNGSI untuk Gemma 4 (bug yang sudah
                // dikonfirmasi Google -- flag ini diam-diam diabaikan khusus model ini).
                // Cara yang benar-benar terbukti mematikan mode "thinking" Gemma 4
                // adalah `thinkingLevel: "MINIMAL"`.
                thinkingConfig: {
                    thinkingLevel: "MINIMAL"
                }
            }
        });

        // FIX PENTING #3: lapisan pertahanan tambahan (defensive).
        // Selain mematikan thinking lewat config di atas, kita juga secara eksplisit
        // membuang bagian mana pun yang ditandai `thought: true` oleh API sebelum
        // digabung jadi teks akhir. Jadi walau suatu saat modelnya tetap "bocor"
        // menyelipkan proses berpikir, itu TIDAK AKAN PERNAH ikut masuk ke kolom
        // catatan mentor.
        const candidateParts = result.candidates?.[0]?.content?.parts || [];
        let textResponse = candidateParts
            .filter(part => !part.thought && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n')
            .trim();

        // Fallback kalau struktur respons berbeda dari dugaan di atas
        if (!textResponse) {
            textResponse = result.text || "";
        }

        // --- PROSES PEMBERSIHAN ---
        // Hapus karakter bintang (*) yang sering dipakai AI untuk bold/italic/list
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        // Backend langsung membungkus teks bersih ke dalam JSON
        res.status(200).json({
            analisis_teks: cleanFeedback
        });

    } catch (error) {
        console.error("AI Error (Analisis Pitching):", error);
        res.status(500).json({
            analisis_teks: "Aduh, AksaBot lagi pusing bacanya. Coba klik analisis sekali lagi ya!"
        });
    }
}
