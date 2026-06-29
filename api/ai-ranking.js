import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================================================
// FIX: Parser JSON yang aman terhadap respons yang terpotong (truncated).
// Akar masalah error "Unterminated string in JSON": Gemini kadang berhenti
// menulis output di tengah jalan (biasanya karena limit maxOutputTokens
// tercapai saat menganalisis banyak karya), sehingga string JSON terpotong
// dan JSON.parse() langsung gagal total. Fungsi ini:
//   1. Membersihkan markdown code-fence (```json ... ```) jika ada.
//   2. Mencoba parse langsung dulu (jalur normal/cepat).
//   3. Jika gagal, mencoba "menyelamatkan" data dengan memotong array JSON
//      sampai objek terakhir yang lengkap (valid), jadi peserta yang sudah
//      berhasil dianalisis tidak hilang semua hanya karena satu entri
//      di ujung terpotong.
// ============================================================================
function safeParseJSON(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Respons AI kosong atau bukan teks.');
    }

    // 1. Bersihkan kemungkinan markdown fence ```json ... ``` atau ``` ... ```
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    // 2. Coba parse langsung — ini jalur yang berhasil di kondisi normal
    try {
        return { data: JSON.parse(cleaned), wasTruncated: false };
    } catch (firstError) {
        // Lanjut ke percobaan recovery di bawah
    }

    // 3. Recovery: respons kemungkinan terpotong di tengah array JSON.
    // Cari posisi awal array.
    const startIdx = cleaned.indexOf('[');
    if (startIdx === -1) {
        throw new Error('Format respons AI tidak valid (tidak ditemukan awal array JSON).');
    }

    let arrayContent = cleaned.slice(startIdx);

    // Potong mundur dari akhir string sampai ketemu '}' terakhir yang
    // menutup sebuah objek peserta secara lengkap, lalu tutup array di sana.
    const lastCompleteObjectEnd = arrayContent.lastIndexOf('}');
    if (lastCompleteObjectEnd === -1) {
        throw new Error('Respons AI terpotong terlalu awal, tidak ada satu pun data karya yang berhasil diselesaikan.');
    }

    const recoveredJsonString = arrayContent.slice(0, lastCompleteObjectEnd + 1) + ']';

    try {
        const recovered = JSON.parse(recoveredJsonString);
        if (Array.isArray(recovered) && recovered.length > 0) {
            return { data: recovered, wasTruncated: true };
        }
        throw new Error('Hasil recovery tidak berupa array data yang valid.');
    } catch (secondError) {
        throw new Error('Respons AI terpotong (kemungkinan melebihi batas token) dan tidak dapat diperbaiki otomatis.');
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = req.body;
        let { eventName, karya, total } = data;

        if (!karya || total === 0) {
            return res.status(400).json({ error: 'Data karya tidak valid atau kosong.' });
        }

        // --- BACKEND YANG MENYUSUN PROMPT ---
        const promptText = `
Peran: Kamu adalah "Juri Sastra Eksekutif Cendekia Aksara", kritikus yang tajam, objektif, dan sangat menghargai keindahan diksi serta kedalaman makna.
Tugas: Menganalisis SEMUA karya dari event "${eventName}". Total ada ${total} karya yang masuk untuk dinilai.

Kriteria Penilaian:
1. Eksplorasi ide dan orisinalitas cerita/pesan.
2. Gaya bahasa, pemilihan diksi, dan penggunaan majas yang efektif.
3. Kedalaman emosi dan penyampaian pesan yang koheren.

Data Karya yang Masuk:
${karya}

Tolong berikan output HANYA dalam format JSON ARRAY murni yang valid. Struktur JSON-nya harus persis seperti ini untuk SETIAP peserta (Urutkan dari karya yang paling terbaik / Juara 1 di atas hingga yang terbawah):
[
  {
    "peringkat": "(Contoh: Juara 1 / Juara 2 / Juara 3 / Peserta)",
    "nama_penulis": "(Nama Peserta)",
    "judul_karya": "(Judul Karya)",
    "analisis": "(Analisis tajam dan objektif sekitar 2-3 kalimat padat mengenai kelebihan dan kekurangan karya tersebut)"
  }
]

Ketentuan Output (SANGAT KETAT):
1. JANGAN ADA BASA-BASI. Langsung berikan format JSON Array dimulai dari tanda [.
2. Analisis HARUS mencakup SEMUA (${total}) peserta yang ada di Data Karya. Jangan ada yang terlewat.
3. Buatlah analisis se-padat dan se-singkat mungkin (maksimal 2 kalimat) agar seluruh ${total} peserta tetap muat dalam output.
4. Wajib berikan predikat Juara 1, Juara 2, dan Juara 3 untuk 3 karya teratas. Sisanya berikan predikat "Peserta".
`;

        // Konfigurasi Filter Keamanan untuk melonggarkan pengecekan AI
        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        // FIX: maxOutputTokens dihitung dinamis berdasarkan jumlah peserta.
        // Sebelumnya nilainya tetap (8192) sehingga event dengan banyak karya
        // membuat Gemini berhenti menulis di tengah JSON (truncated) dan
        // menyebabkan "Unterminated string in JSON". Sekarang dialokasikan
        // ~450 token per peserta (cukup untuk field + analisis singkat),
        // dengan batas bawah 8192 dan batas atas 65536 (limit umum Flash).
        const estimatedTokens = Math.min(65536, Math.max(8192, total * 450));

        // Menggunakan model Gemini Flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.6,
                maxOutputTokens: estimatedTokens,
                responseMimeType: "application/json" // Memaksa AI mengembalikan format JSON murni
            },
            safetySettings: safetySettings
        });

        // FIX: cek alasan berhentinya generasi. Jika Gemini berhenti karena
        // MAX_TOKENS, kita sudah tahu sebabnya sebelum bahkan mencoba parse,
        // sehingga pesan error ke admin jadi jelas dan actionable.
        const candidate = result.response.candidates?.[0];
        const finishReason = candidate?.finishReason;

        let textResponse = result.response.text();

        if (!textResponse || textResponse.trim() === '') {
            console.error("AI Error (Ranking Karya): Respons kosong dari Gemini. finishReason:", finishReason);
            return res.status(500).json({
                error: finishReason === 'SAFETY'
                    ? "Sistem Penilaian menolak memproses konten ini (terblokir filter keamanan)."
                    : "Sistem Penilaian tidak mengembalikan hasil apa pun. Silakan coba lagi."
            });
        }

        // FIX: parsing aman, tidak langsung JSON.parse mentah seperti sebelumnya.
        let finalResult;
        let wasTruncated = false;
        try {
            const parsed = safeParseJSON(textResponse);
            finalResult = parsed.data;
            wasTruncated = parsed.wasTruncated || finishReason === 'MAX_TOKENS';
        } catch (parseError) {
            console.error("AI Error (Ranking Karya) - Gagal parsing JSON:", parseError.message);
            console.error("finishReason dari Gemini:", finishReason);
            console.error("Potongan akhir respons mentah:", textResponse.slice(-300));
            return res.status(500).json({
                error: "Hasil evaluasi dari sistem terlalu panjang dan terpotong sebelum selesai. Coba kurangi jumlah karya per evaluasi, atau coba lagi."
            });
        }

        // Mengembalikan data JSON ke frontend admin
        res.status(200).json({
            analisis_data: finalResult,
            ...(wasTruncated ? {
                warning: `Peringatan: hasil evaluasi mungkin tidak lengkap (terpotong). Hanya ${finalResult.length} dari ${total} karya yang berhasil dianalisis penuh. Disarankan mengulang evaluasi.`
            } : {})
        });

    } catch (error) {
        console.error("AI Error (Ranking Karya):", error);
        res.status(500).json({ 
            error: "AksaBot sedang mengalami kendala server. Silakan coba lagi!" 
        });
    }
}
