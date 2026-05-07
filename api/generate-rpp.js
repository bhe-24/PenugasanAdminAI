// api/generate-rpp.js
// Backend Vercel — Menggunakan Google Gemini 2.0 Flash
// Mengembalikan objek JSON terstruktur (bukan HTML mentah)
// sehingga PDF yang dihasilkan benar-benar profesional & bersih.

export default async function handler(req, res) {
    // ── CORS ──
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { mapel, semester, topik } = req.body || {};
    if (!mapel || !semester || !topik) {
        return res.status(400).json({ error: 'Parameter mapel, semester, dan topik wajib diisi.' });
    }

    // ── PROMPT ──
    // Minta Gemini mengembalikan JSON murni (tanpa markdown fence)
    const prompt = `
Anda adalah Pakar Kurikulum dan Master Pedagogi Bahasa & Sastra.
Buatlah Rancangan Pelaksanaan Pembelajaran (RPP) SANGAT DETAIL dan PROFESIONAL untuk:
- Mata Pelajaran / Modul : "${mapel}"
- Semester               : ${semester}
- Topik Khusus           : "${topik}"
- Durasi Pertemuan       : 80 Menit

Kembalikan HANYA objek JSON valid tanpa backtick, tanpa komentar, tanpa penjelasan tambahan.
Ikuti PERSIS struktur berikut:

{
  "jumlahSiswa": "15–25 orang",

  "cp": "Teks Capaian Pembelajaran yang mendalam dan filosofis, 3–5 kalimat.",

  "tp": [
    "TP 1 — Ranah Kognitif: ...",
    "TP 2 — Ranah Afektif/Sikap: ...",
    "TP 3 — Ranah Psikomotorik/Praktik: ..."
  ],

  "materiPokok": [
    "Poin materi 1",
    "Poin materi 2",
    "Poin materi 3",
    "Poin materi 4"
  ],

  "metode": [
    "Model: Project-Based Learning (PjBL)",
    "Metode: Diskusi Socrates",
    "Pendekatan: Kontekstual & Kolaboratif",
    "Teknik: Think-Pair-Share"
  ],

  "skenario": [
    {
      "waktu": "Menit 00–10",
      "fase": "Pendahuluan & Apersepsi",
      "menjelaskan": "Uraian detail apa yang guru jelaskan sebagai pembuka (min 3 kalimat).",
      "memadankan": "Analogi menarik dari kehidupan nyata / dunia remaja untuk membuka rasa ingin tahu (min 2 kalimat).",
      "aktivitasSiswa": "Detail respon, tindakan, atau diskusi singkat peserta didik.",
      "poinPenting": "1–2 kalimat poin target yang harus tertanam di benak siswa setelah sesi ini."
    },
    {
      "waktu": "Menit 10–25",
      "fase": "Eksplorasi Konsep",
      "menjelaskan": "...",
      "memadankan": "...",
      "aktivitasSiswa": "...",
      "poinPenting": "..."
    },
    {
      "waktu": "Menit 25–40",
      "fase": "Pendalaman Materi",
      "menjelaskan": "...",
      "memadankan": "...",
      "aktivitasSiswa": "...",
      "poinPenting": "..."
    },
    {
      "waktu": "Menit 40–55",
      "fase": "Latihan Terbimbing",
      "menjelaskan": "...",
      "memadankan": "...",
      "aktivitasSiswa": "...",
      "poinPenting": "..."
    },
    {
      "waktu": "Menit 55–70",
      "fase": "Praktik Mandiri",
      "menjelaskan": "...",
      "memadankan": "...",
      "aktivitasSiswa": "...",
      "poinPenting": "..."
    },
    {
      "waktu": "Menit 70–80",
      "fase": "Penutup & Refleksi",
      "menjelaskan": "...",
      "memadankan": "...",
      "aktivitasSiswa": "...",
      "poinPenting": "..."
    }
  ],

  "penilaian": [
    { "jenis": "Sikap (Afektif)", "teknik": "Observasi", "instrumen": "Lembar observasi keaktifan & kolaborasi" },
    { "jenis": "Pengetahuan (Kognitif)", "teknik": "Tes Lisan / Kuis", "instrumen": "Pertanyaan pemahaman konsep" },
    { "jenis": "Keterampilan (Psikomotorik)", "teknik": "Penugasan Praktik", "instrumen": "Rubrik penilaian karya tulis / produk" }
  ],

  "catatanRefleksi": "Paragraf refleksi guru pasca-pembelajaran: tantangan yang mungkin ditemui, strategi adaptasi, dan rekomendasi tindak lanjut untuk pertemuan berikutnya. (min 4 kalimat)"
}

Isi semua field dengan konten SUBSTANTIF, DETAIL, dan RELEVAN terhadap mata pelajaran dan topik di atas.
JANGAN kembalikan markdown, komentar, atau teks di luar JSON.
`;

    try {
        // ── PANGGIL GEMINI 2.0 FLASH ──
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi di environment variables Vercel.');

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,          // seimbang: terstruktur tapi tetap kreatif
                        topP: 0.95,
                        maxOutputTokens: 8192,
                        responseMimeType: 'application/json'  // minta Gemini return JSON langsung
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errBody = await geminiRes.text();
            throw new Error(`Gemini API error ${geminiRes.status}: ${errBody}`);
        }

        const geminiData = await geminiRes.json();

        // ── EKSTRAK TEKS OUTPUT ──
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Gemini tidak mengembalikan konten. Cek quota / API key.');

        // Bersihkan fence kalau masih ada (jaga-jaga)
        const cleaned = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();

        const rpp = JSON.parse(cleaned);

        return res.status(200).json({ rpp });

    } catch (error) {
        console.error('[generate-rpp] Error:', error.message);
        return res.status(500).json({
            error: 'Gagal menyusun RPP.',
            detail: error.message
        });
    }
}
