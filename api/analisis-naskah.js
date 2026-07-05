// API Evaluasi Progres & Final Naskah -- Studio Menulis / Inkubasi
// Memakai mesin AI yang sama dengan analisis-proposal.js:
// - SDK aktif: @google/genai (bukan @google/generative-ai yang sudah deprecated)
// - Model: gemma-4-31b-it
// - thinkingConfig.thinkingLevel: "MINIMAL" -- INI PENTING, mencegah bug "pikiran AI"
//   ikut tertulis di output (includeThoughts:false diabaikan/bug khusus utk Gemma 4).
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Batas aman panjang teks yang dikirim ke AI (karakter). Novel yang sangat panjang
// akan dipotong dengan catatan, supaya tidak melebihi context window model.
const MAX_CHARS = 400000;

function potongJikaTerlaluPanjang(teks) {
    if (teks.length <= MAX_CHARS) return teks;
    const setengah = Math.floor(MAX_CHARS / 2);
    return (
        teks.slice(0, setengah) +
        "\n\n[...NASKAH DIPOTONG KARENA TERLALU PANJANG UNTUK DIANALISIS SEKALIGUS, BAGIAN TENGAH DILEWATI...]\n\n" +
        teks.slice(teks.length - setengah)
    );
}

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
        const mode = data.mode === 'final' ? 'final' : 'progress'; // default aman: progress

        // Gabungkan bab-bab yang mau dievaluasi jadi satu teks terstruktur
        let babTeks = "Tidak ada bab untuk dievaluasi.";
        if (data.chapters && Array.isArray(data.chapters) && data.chapters.length > 0) {
            babTeks = data.chapters.map((bab, i) => {
                const nomor = (data.bab_dari || 1) + i;
                return `--- BAB ${nomor}: ${bab.judul_bab || '(Tanpa Judul)'} (${bab.jumlah_kata || 0} kata) ---\n${bab.isi_teks || ''}`;
            }).join('\n\n');
        }
        babTeks = potongJikaTerlaluPanjang(babTeks);

        // Ringkasan riwayat catatan checkpoint sebelumnya (untuk kontinuitas)
        let riwayatTeks = "Belum ada riwayat evaluasi mentor sebelumnya.";
        if (data.riwayat_catatan && Array.isArray(data.riwayat_catatan) && data.riwayat_catatan.length > 0) {
            riwayatTeks = data.riwayat_catatan.map(r =>
                `[Evaluasi Bab ${r.bab_dari}-${r.bab_sampai}]: ${r.catatan}`
            ).join('\n\n');
        }

        const konteksProposal = `
Data Proposal Awal (acuan konsistensi):
- Judul: ${data.judul || '-'}
- Genre: ${data.genre || '-'}
- Target Kata: ${data.target_kata || '-'}
- Logline: ${data.logline || '-'}
- Sinopsis: ${data.sinopsis || '-'}
`;

        let promptText = "";

        if (mode === 'progress') {
            promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional dan selalu memberi arahan yang jelas dan actionable. Sesekali boleh menyindir bagian yang jelas lemah/melenceng, tapi jangan merendahkan secara pribadi. Gunakan bahasa "Aku" dan "Kamu", gaul, tajam, to the point.

Tugas: Evaluasi PROGRES penulisan naskah "${data.judul}" karya "${data.studentName}", khusus untuk Bab ${data.bab_dari} sampai Bab ${data.bab_sampai} yang baru saja ditulis.

${konteksProposal}

Riwayat Evaluasi Mentor Sebelumnya (cek apakah masukan lama sudah ditindaklanjuti):
${riwayatTeks}

Isi Bab yang Dievaluasi Sekarang:
${babTeks}

Ketentuan Review (SANGAT KETAT):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Dilarang keras memakai kata seperti "Halo", "Terima kasih", "Mari kita bedah", atau "Semoga sukses". LANGSUNG TEMBAK KE INTINYA.
2. Cek KONSISTENSI bab-bab ini dengan logline/sinopsis/outline awal -- apakah cerita masih di jalur yang benar atau mulai melenceng.
3. Jika ada catatan mentor sebelumnya, TEGUR kalau belum ditindaklanjuti (boleh sindir), atau apresiasi singkat (tetap tegas) kalau sudah diperbaiki.
4. Bedah kekuatan penulisan: pacing, dialog, deskripsi, perkembangan karakter. Cari plot hole atau bagian yang klise/lemah, boleh sindir sedikit kalau memang lemah.
5. Tutup dengan arahan konkret untuk bab-bab selanjutnya (bukan skor kelulusan, ini baru evaluasi progres tengah jalan).
6. Gunakan baris baru (enter) antar paragraf agar enak dipandang.
7. Tuliskan jawaban dalam teks biasa (plain text). DILARANG KERAS menggunakan Markdown seperti bintang-bintang (**teks**/*teks*) dan JANGAN menulis seluruh ulasan dengan HURUF KAPITAL.
8. PASTIKAN ulasan tuntas, kalimat selesai dengan titik, tidak terpotong.
9. JANGAN PERNAH menuliskan proses berpikirmu atau catatan internal -- langsung tulis hasil evaluasi akhirnya saja.
`;
        } else {
            // mode === 'final'
            // FIX: skor final sekarang dipecah jadi 10 ASPEK PENILAIAN terpisah
            // (bukan 1 angka tunggal), karena ini akan dipakai langsung sebagai
            // 10 kolom nilai rapor semester 3 (menggantikan nilai tugas/ujian).
            promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional, adil, dan selalu memberi arahan yang jelas. Sesekali boleh menyindir bagian yang lemah, tapi tetap beri apresiasi yang pantas kalau memang bagus. Gunakan bahasa "Aku" dan "Kamu", gaul, tajam, to the point.

Tugas: Berikan EVALUASI FINAL menyeluruh untuk naskah LENGKAP "${data.judul}" karya "${data.studentName}". Evaluasi ini akan dipakai LANGSUNG sebagai NILAI RAPOR AKHIR siswa (menggantikan nilai tugas/ujian semester ini), jadi harus adil, menyeluruh, dan berbasis bukti dari keseluruhan naskah.

${konteksProposal}

Riwayat Evaluasi Mentor Sepanjang Proses Penulisan (cek apakah masukan-masukan ini akhirnya ditindaklanjuti di naskah final):
${riwayatTeks}

Isi Naskah Lengkap:
${babTeks}

Ketentuan Review (SANGAT KETAT):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Dilarang keras memakai kata seperti "Halo", "Terima kasih", "Mari kita bedah", atau "Semoga sukses". LANGSUNG TEMBAK KE INTINYA.
2. Bahas SECARA RINCI kesepuluh aspek berikut di dalam narasi evaluasimu (boleh dikelompokkan per paragraf, tidak harus urut kaku): kekuatan ide & orisinalitas, struktur alur & logika cerita, pengembangan karakter, konsistensi genre & tone, teknik penulisan & pacing, gaya bahasa & diksi, kekuatan dialog, penyelesaian plot hole & konsistensi detail, resolusi konflik & ending, kerapian bahasa (PUEBI) & teknis penulisan.
3. Sebutkan apakah masukan-masukan mentor selama proses penulisan akhirnya ditindaklanjuti atau tidak di naskah final (boleh sindir kalau ada yang diabaikan berulang kali).
4. Beri KRITIK TAJAM pada kelemahan yang masih ada, DAN apresiasi yang pantas pada bagian yang kuat -- tetap dengan nada tegas, bukan basa-basi berlebihan.
5. Tutup narasi dengan nasihat arahan yang jelas untuk pengembangan naskah ini ke depan.
6. Gunakan baris baru (enter) antar paragraf agar enak dipandang.
7. Tuliskan jawaban dalam teks biasa (plain text). DILARANG KERAS menggunakan Markdown seperti bintang-bintang (**teks**/*teks*) dan JANGAN menulis seluruh ulasan dengan HURUF KAPITAL.
8. PASTIKAN narasi tuntas, kalimat selesai dengan titik, tidak terpotong.
9. JANGAN PERNAH menuliskan proses berpikirmu, draft kasar, atau skor di tengah narasi.
10. SETELAH narasi selesai, WAJIB tutup jawabanmu dengan PERSIS 10 baris berikut, urutan dan format ini HARUS SAMA PERSIS (skor tiap aspek 0-100, boleh beda antar aspek sesuai kekuatan/kelemahan naskah, jangan asal disamakan semua):
Skor Ide dan Orisinalitas: [angka]/100
Skor Struktur Alur dan Logika Cerita: [angka]/100
Skor Pengembangan Karakter: [angka]/100
Skor Konsistensi Genre dan Tone: [angka]/100
Skor Teknik Penulisan dan Pacing: [angka]/100
Skor Gaya Bahasa dan Diksi: [angka]/100
Skor Kekuatan Dialog: [angka]/100
Skor Penyelesaian Plot Hole dan Konsistensi: [angka]/100
Skor Resolusi Konflik dan Ending: [angka]/100
Skor Kerapian Bahasa PUEBI dan Teknis: [angka]/100
`;
        }

        const result = await ai.models.generateContent({
            model: "gemma-4-31b-it",
            contents: promptText,
            config: {
                temperature: 0.7,
                maxOutputTokens: mode === 'final' ? 3000 : 2000,
                // FIX PENTING: mencegah bocornya "pikiran"/thinking Gemma 4 ke output.
                thinkingConfig: {
                    thinkingLevel: "MINIMAL"
                }
            }
        });

        // Lapisan pertahanan tambahan: buang bagian yang ditandai thought:true
        const candidateParts = result.candidates?.[0]?.content?.parts || [];
        let textResponse = candidateParts
            .filter(part => !part.thought && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n')
            .trim();

        if (!textResponse) {
            textResponse = result.text || "";
        }

        // Bersihkan simbol markdown yang mungkin masih nyelip
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        // Untuk mode final, coba parse skor numeriknya dari baris terakhir
        let skorAkhir = null;
        if (mode === 'final') {
            const match = cleanFeedback.match(/Skor Akhir Naskah:\s*(\d{1,3})\s*\/\s*100/i);
            if (match) {
                skorAkhir = Math.max(0, Math.min(100, parseInt(match[1], 10)));
            }
        }

        res.status(200).json({
            analisis_teks: cleanFeedback,
            skor: skorAkhir // null untuk mode progress, angka 0-100 (atau null jika gagal diparse) untuk mode final
        });

    } catch (error) {
        console.error("AI Error (Analisis Naskah):", error);
        res.status(500).json({
            analisis_teks: "Aduh, AksaBot lagi pusing bacanya. Coba klik analisis sekali lagi ya!",
            skor: null
        });
    }
}
