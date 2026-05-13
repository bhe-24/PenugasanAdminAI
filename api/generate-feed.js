/**
 * generate-feed.js
 * Gemini 2.5 Flash — Social Media Feed Content Generator
 * Untuk Mading Cendekia Aksara
 */

const GEMINI_API_KEY = "MASUKKAN_GEMINI_API_KEY_DISINI"; // Ganti dengan API key Gemini kamu
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Peta label kategori
export const KATEGORI_MAP = {
  motivasi: "Motivasi & Inspirasi",
  tips_menulis: "Tips Menulis",
  quotes: "Quotes Bijak",
  pengumuman: "Pengumuman",
  achievement: "Pencapaian",
  buku_review: "Review Buku",
  writing_challenge: "Challenge",
  berita: "Berita & Update",
};

/**
 * Membangun prompt berdasarkan kategori dan konteks tambahan
 */
function buildPrompt(kategori, konteks = "") {
  const labelKategori = KATEGORI_MAP[kategori] || kategori;

  const instruksiKhusus = {
    motivasi: `
Buat konten motivasi yang inspiratif untuk komunitas penulis muda Indonesia.
Gunakan bahasa yang hangat, semangat, dan membangkitkan gairah menulis.
Bisa berupa kalimat motivasi, ajakan bertindak, atau refleksi singkat.
`,
    tips_menulis: `
Buat tip menulis yang praktis dan mudah diterapkan oleh pelajar SMA/mahasiswa.
Sertakan teknik spesifik, contoh singkat, atau langkah sederhana.
Hindari teori umum — langsung ke poin yang actionable.
`,
    quotes: `
Buat satu quotes bijak tentang menulis, literasi, atau kreativitas.
Format: "Isi kutipan" — Nama Tokoh (atau buat kutipan orisinal yang terasa autentik).
Tambahkan 1–2 kalimat refleksi singkat.
`,
    pengumuman: `
Buat teks pengumuman resmi namun tetap ramah dan menarik untuk media sosial komunitas sastra/literasi.
Sertakan ajakan untuk bergabung/bertindak di bagian akhir.
`,
    achievement: `
Buat teks apresiasi pencapaian siswa/anggota komunitas yang inspiring.
Gunakan nada bangga, positif, dan mendorong anggota lain untuk turut berprestasi.
`,
    buku_review: `
Buat review buku singkat yang menarik minat baca.
Sertakan: Judul & penulis (bisa karangan), kesan utama, dan mengapa harus dibaca.
Maksimal 3–4 kalimat padat.
`,
    writing_challenge: `
Buat teks ajakan writing challenge yang energik dan menantang.
Sertakan: Tema tantangan, aturan singkat, dan deadline/hadiah singkat.
Gunakan emoji untuk membuat lebih hidup.
`,
    berita: `
Buat teks berita singkat dalam gaya media sosial — informatif, padat, dan menarik.
Sertakan fakta/info utama dan ajakan untuk mencari tahu lebih lanjut.
`,
  };

  const instruksi =
    instruksiKhusus[kategori] ||
    `Buat konten menarik untuk kategori ${labelKategori}.`;

  return `Kamu adalah asisten konten kreatif untuk komunitas literasi "Mading Cendekia Aksara" — sebuah platform majalah dinding digital untuk pelajar dan pecinta sastra Indonesia.

Tugasmu: Buat konten untuk postingan Instagram kategori "${labelKategori}".

${instruksi}

${konteks ? `Konteks tambahan dari admin: ${konteks}` : ""}

Ketentuan output:
- Panjang: 150–280 karakter (ideal untuk Instagram caption yang terbaca di poster)
- Bahasa: Indonesia yang ekspresif, modern, dan sesuai usia 16–25 tahun
- Boleh gunakan 1–3 emoji yang relevan
- JANGAN tambahkan hashtag (akan ditambah otomatis)
- JANGAN tambahkan tanda kutip pembuka/penutup
- Langsung tulis kontennya saja, tanpa preamble seperti "Berikut adalah..." atau "Tentu!"
- Tone: ${getTone(kategori)}

Output hanya berisi teks konten siap pakai, tidak ada penjelasan tambahan.`;
}

function getTone(kategori) {
  const tones = {
    motivasi: "hangat, membara, penuh semangat",
    tips_menulis: "informatif, praktis, bersahabat",
    quotes: "dalam, reflektif, bijaksana",
    pengumuman: "resmi namun ramah, jelas, antusias",
    achievement: "bangga, apresiatif, inspiring",
    buku_review: "antusias, persuasif, literary",
    writing_challenge: "energik, menantang, exciting",
    berita: "informatif, ringkas, menarik",
  };
  return tones[kategori] || "profesional dan menarik";
}

/**
 * Generate konten dengan Gemini 2.5 Flash
 * @param {string} kategori - Key kategori konten
 * @param {string} konteks - Konteks tambahan opsional dari admin
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function generateFeedContent(kategori, konteks = "") {
  if (!kategori) {
    return { success: false, error: "Kategori tidak boleh kosong." };
  }

  const prompt = buildPrompt(kategori, konteks);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
          stopSequences: [],
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(
        errData.error?.message || `HTTP Error ${response.status}`
      );
    }

    const data = await response.json();

    // Ambil teks dari respons Gemini
    const content =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!content) {
      throw new Error("Respons kosong dari Gemini AI.");
    }

    return { success: true, content };
  } catch (error) {
    console.error("[generate-feed.js] Gemini API Error:", error);
    return {
      success: false,
      error: error.message || "Gagal terhubung ke Gemini AI.",
    };
  }
}

/**
 * Generate judul/headline dari konten yang sudah ada
 * @param {string} konten - Isi konten yang sudah digenerate
 * @param {string} kategori - Kategori konten
 * @returns {Promise<{success: boolean, judul?: string, error?: string}>}
 */
export async function generateJudul(konten, kategori) {
  const labelKategori = KATEGORI_MAP[kategori] || kategori;

  const prompt = `Berdasarkan konten Instagram berikut untuk kategori "${labelKategori}":

"${konten}"

Buat 1 judul/headline yang:
- Singkat: 3–6 kata saja
- Menarik perhatian, bisa berupa kalimat tanya, pernyataan bold, atau kata kunci impactful
- Sesuai dengan isi konten
- Cocok jadi judul besar di poster Instagram
- TIDAK pakai tanda baca di akhir kecuali tanda tanya jika sesuai

Tulis hanya judulnya saja, tanpa penjelasan.`;

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 64,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    const judul =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!judul) throw new Error("Respons judul kosong.");

    return { success: true, judul };
  } catch (error) {
    console.error("[generate-feed.js] Error generate judul:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate hashtag relevan
 * @param {string} konten
 * @param {string} kategori
 * @returns {Promise<string>}
 */
export async function generateHashtag(konten, kategori) {
  const baseHashtags = {
    motivasi: "#CendekiaAksara #Motivasi #SemangatMenulis #Literasi",
    tips_menulis: "#CendekiaAksara #TipsMenulis #Menulis #WritingTips",
    quotes: "#CendekiaAksara #QuoteHariIni #Inspirasi #Sastra",
    pengumuman: "#CendekiaAksara #Pengumuman #InfoPenting",
    achievement: "#CendekiaAksara #Prestasi #BanggaIndonesia",
    buku_review: "#CendekiaAksara #ReviewBuku #Membaca #Literasi",
    writing_challenge: "#CendekiaAksara #WritingChallenge #Tantangan",
    berita: "#CendekiaAksara #Berita #Update #Literasi",
  };

  return (
    baseHashtags[kategori] ||
    "#CendekiaAksara #MadingDigital #Literasi #Indonesia"
  );
}
