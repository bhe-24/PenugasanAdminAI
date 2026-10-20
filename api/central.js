// File: api/central.js
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// ==========================================
// 1. INISIALISASI ENVIRONMENT VARIABLES
// ==========================================
const SAKELAR_API_KEY = process.env.SAKELAR_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Inisialisasi Klien (Jika Key tersedia)
const groq = GROQ_API_KEY ? new OpenAI({ apiKey: GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }) : null;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Konfigurasi Model Utama Sakelar
const SAKELAR_URL = 'https://api.sakelar.web.id/v1/chat/completions';
const SAKELAR_DEFAULT_MODEL = 'claude-opus-5'; 

// ==========================================
// 2. FUNGSI UTILITIES
// ==========================================

// Fungsi Pembersih Teks Universal
const sanitizeText = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, '').trim(); 
};

// Filter Keamanan Gemini Universal
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// FUNGSI BARU: Pengekstrak JSON Anti-Gagal
const extractJSON = (text) => {
    try {
        // 1. Coba parse langsung (kondisi ideal)
        return JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim());
    } catch (e) {
        // 2. Jika gagal karena ada teks pengantar, gunakan Regex untuk mengambil bagian { ... } saja
        console.warn("Gagal parse langsung, mencoba ekstraksi regex...");
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (err2) {
                console.error("Gagal parse regex:", match[0]);
                throw new Error("JSON terdeteksi tapi strukturnya rusak (malformed).");
            }
        }
        throw new Error("Tidak ada struktur JSON yang ditemukan dalam respons AI.");
    }
};

// ==========================================
// 3. FUNGSI MULTI-TIER FALLBACK AI ENGINE
// ==========================================
async function generateWithFallback(systemPrompt, userPrompt, temperature, isJsonMode = false) {
    let lastError = "";

    // TIER 1: SAKELAR API (UTAMA)
    if (SAKELAR_API_KEY) {
        try {
            console.log("Mencoba Sakelar API...");
            const response = await fetch(SAKELAR_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SAKELAR_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: SAKELAR_DEFAULT_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: temperature
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                let resultText = "";
                // Deteksi gaya response: OpenAI style (choices) vs Anthropic style (content)
                if (data.choices && data.choices.length > 0) {
                     resultText = data.choices[0]?.message?.content || "";
                } else if (data.content && data.content.length > 0) {
                     resultText = data.content[0]?.text || ""; 
                } else {
                     throw new Error("Struktur balasan API Sakelar tidak dikenali.");
                }

                // DETEKSI PENOLAKAN SAKELAR (CONTENT FILTER / HTTP 400 MESSAGE INSIDE 200 OK)
                if (resultText.includes("Request rejected by AI provider") || resultText.includes("HTTP 400")) {
                    throw new Error("Prompt ditolak oleh filter keamanan Sakelar API.");
                }

                console.log("Sakelar API Berhasil!");
                return resultText;

            } else {
                const errData = await response.text();
                throw new Error(`Sakelar HTTP Error ${response.status}: ${errData}`);
            }
        } catch (error) {
            console.warn("Sakelar API Gagal/Ditolak, BERALIH KE GROQ...", error.message);
            lastError = `Sakelar: ${error.message}`;
        }
    }

    // TIER 2: GROQ API (FALLBACK 1)
    if (groq) {
        try {
            console.log("Mencoba Groq API...");
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: temperature,
                response_format: isJsonMode ? { type: "json_object" } : { type: "text" }
            });
            console.log("Groq API Berhasil!");
            return completion.choices[0]?.message?.content || "";
        } catch (error) {
            console.warn("Groq API Gagal, BERALIH KE GEMINI...", error.message);
            lastError += ` | Groq: ${error.message}`;
        }
    }

    // TIER 3: GEMINI API (FALLBACK 2 / TERAKHIR)
    if (genAI) {
        try {
            console.log("Mencoba Gemini API...");
            const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
            const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" }); 
            
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
                generationConfig: { 
                    temperature: temperature, 
                    responseMimeType: isJsonMode ? "application/json" : "text/plain" 
                },
                safetySettings: safetySettings
            });
            console.log("Gemini API Berhasil!");
            return result.response.text();
        } catch (error) {
            console.error("Gemini API Gagal.", error.message);
            lastError += ` | Gemini: ${error.message}`;
            throw new Error(`Semua AI Engine Gagal. Detail: ${lastError}`);
        }
    }

    throw new Error("Tidak ada API Key AI yang dikonfigurasi.");
}

// ==========================================
// 4. MAIN HANDLER
// ==========================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const action = req.body?.action || req.query?.action;

        if (!action) {
            return res.status(400).json({ error: "Parameter 'action' tidak ditemukan." });
        }

        switch (action) {

            // ---------------------------------------------------------
            // [A] KOREKSI UJIAN
            // ---------------------------------------------------------
            case 'grade-ujian': {
                let { instruction, rubric, answer, studentName } = req.body;
                if (!answer || answer.trim() === '') return res.status(400).json({ error: 'Karya/Jawaban siswa kosong' });

                answer = sanitizeText(answer);
                instruction = sanitizeText(instruction) || 'Buatlah karya tulisan fiksi/esai yang baik dan benar sesuai kaidah.';
                rubric = sanitizeText(rubric) || 'Nilai rentang 0-100 dengan mempertimbangkan: Gagasan, Struktur, Tanda Baca, Diksi, Typo, dan Gaya Penulisan.';
                studentName = studentName && studentName !== 'undefined' ? studentName : 'Penulis';

                const systemPrompt = `Peran: Anda adalah seorang Mentor Penulisan Kreatif dan Editor Fiksi yang ramah, asyik, objektif, dan suportif.
Tugas: Mengoreksi karya siswa dengan gaya bahasa yang ringan, kasual, dan sangat akrab.`;

                const userPrompt = `Informasi Siswa: Nama: "${studentName}"
Instruksi Tugas: "${instruction}"
Rubrik & Unsur Penilaian: "${rubric}"
Karya Siswa: "${answer}"

Kamu WAJIB mengembalikan output HANYA dalam satu buah objek JSON tanpa teks pengantar apa pun.
Format JSON yang diminta:
{
  "score": (angka bulat 0-100),
  "feedback": "(string HTML dengan tag <b>, <i>, <br>)"
}

Ketentuan Feedback:
1. Mulailah dengan sapaan hangat "Halo, ${studentName}!" lalu apresiasi spesifik.
2. Wajib gunakan "Aku" (mentor) dan "Kamu" (siswa).
3. Tulis mengalir dalam paragraf (jangan pakai poin-poin angka): Analisis gaya, temuan typo/PUEBI, contoh perbaikan, dan motivasi penutup.
4. DILARANG KERAS MENGGUNAKAN MARKDOWN.`;

                let rawResponse = await generateWithFallback(systemPrompt, userPrompt, 0.5, true);
                
                try {
                    const finalResult = extractJSON(rawResponse);
                    return res.status(200).json({ score: finalResult.score, feedback: finalResult.feedback });
                } catch (parseError) {
                    console.error("Gagal parse JSON final. Raw response AI:", rawResponse);
                    throw new Error("AI tidak memberikan JSON yang valid.");
                }
            }

            // ---------------------------------------------------------
            // [B] KOREKSI PENUGASAN
            // ---------------------------------------------------------
            case 'grade-tugas': {
                let { studentName, instruction, answer } = req.body;
                if (!answer || answer.trim() === '') return res.status(400).json({ error: 'Jawaban siswa kosong' });

                answer = sanitizeText(answer);
                instruction = sanitizeText(instruction) || 'Kerjakan tugas dengan baik, jujur, dan perhatikan kaidah penulisan.';
                studentName = studentName && studentName !== 'undefined' ? studentName : 'Siswa';

                const systemPrompt = `Peran: Kamu adalah teman belajar yang pintar dan asik (bukan guru yang kaku).
Tugas: Nilai jawaban temanmu (siswa) berdasarkan instruksi penugasan.`;

                const userPrompt = `Informasi Siswa: Nama: "${studentName}"
Instruksi Penugasan: "${instruction}"
Jawaban Siswa: "${answer}"

Kamu WAJIB mengembalikan output HANYA dalam satu buah objek JSON tanpa teks pengantar apa pun.
Format JSON yang diminta:
{
  "score": (angka bulat 0-100),
  "feedback": "(string HTML dengan tag <b>, <i>, <br>)"
}

Ketentuan Feedback:
1. Sapaan hangat "Halo, ${studentName}!" atau "Selamat Pagi/Siang/Sore, ${studentName}!".
2. Gunakan "Aku" dan "Kamu". Jangan "Anda" atau "Saya".
3. Tulis mengalir dalam paragraf (tanpa poin-poin): Analisis Kesalahan, Koreksi/Contoh benar, dan Pujian/Apresiasi.
4. DILARANG KERAS MENGGUNAKAN MARKDOWN.`;

                let rawResponse = await generateWithFallback(systemPrompt, userPrompt, 0.4, true);
                
                try {
                    const finalResult = extractJSON(rawResponse);
                    return res.status(200).json({ score: finalResult.score, feedback: finalResult.feedback });
                } catch (parseError) {
                    console.error("Gagal parse JSON final. Raw response AI:", rawResponse);
                    throw new Error("AI tidak memberikan JSON yang valid.");
                }
            }

            // ---------------------------------------------------------
            // [C] EDIT ARTIKEL / KARYA TULIS
            // ---------------------------------------------------------
            case 'edit-artikel': {
                const { text, title, instruction } = req.body;
                if (!text) return res.status(400).json({ error: 'Teks kosong.' });

                const customInstruction = instruction 
                    ? `INSTRUKSI KHUSUS:\n"${instruction}"`
                    : `INSTRUKSI UMUM: Rapikan ejaan, perbaiki typo, pastikan kalimat mengalir.`;

                const systemPrompt = `Kamu adalah editor artikel profesional. Keluarkan HANYA teks murni (termasuk tag HTML jika diminta) TANPA penjelasan tambahan.`;
                const userPrompt = `Judul: ${title || 'Tanpa Judul'}\n\n${customInstruction}\n\nTEKS:\n"""\n${text}\n"""\nKeluarkan murni HTML.`;

                let textResponse = await generateWithFallback(systemPrompt, userPrompt, instruction ? 0.7 : 0.1, false);
                textResponse = textResponse.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

                return res.status(200).json({ result: textResponse });
            }

            default:
                return res.status(404).json({ error: `Action '${action}' tidak dikenali oleh sistem API Central.` });
        }

    } catch (error) {
        console.error("API Central Error Breakdown:", error);
        return res.status(500).json({ 
            score: 0, 
            feedback: "Sistem mengalami gangguan saat memproses dari AI. Silakan coba beberapa saat lagi.",
            error: error.message 
        });
    }
}
