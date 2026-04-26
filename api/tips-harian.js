import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // --- 1. MEMBUAT TEKS TIPS MENGGUNAKAN GEMINI ---
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.9 // Kreativitas tinggi agar tips dan topiknya sangat beragam setiap hari
            }
        });
        
        const promptTeks = `
Peranmu adalah Penulis Senior dan Editor Mading yang asyik, gaul, wawasannya luas, dan tidak kaku.
Tugasmu: Berikan SATU tips kepenulisan acak untuk anak SMA. Eksplorasi seluruh bidang kepenulisan! (Bisa tentang meracik plot twist, nulis dialog yang hidup, jurnalisme sekolah, nulis puisi, show don't tell, atau sekadar tips melawan writer's block).

Aturan Mutlak:
1. Gaya bahasa HARUS lugas, ringan, asyik, dan mudah dimengerti (seperti penulis manusia sedang membagikan trik rahasianya). DILARANG KERAS menggunakan bahasa kaku khas robot/AI.
2. WAJIB sertakan satu contoh singkat penerapan langsung di dalam penjelasanmu.
3. WAJIB balas HANYA dalam format JSON yang valid.
4. JSON memiliki dua kunci:
   - "judul": Judul tips yang memancing rasa penasaran (maksimal 7 kata).
   - "isi": Penjelasan tips beserta contohnya. Tulis secara mengalir dalam 1 paragraf padat (sekitar 4-6 kalimat yang isinya "daging" semua).
`;
        
        const resultTeks = await model.generateContent(promptTeks);
        const tipData = JSON.parse(resultTeks.response.text());


        // --- 2. MEMBUAT ILUSTRASI MENGGUNAKAN IMAGEN 4 ---
        let imageUrl = "";
        try {
            // Prompt untuk gambar estetik ala lofi/akademi
            const imgPrompt = "Aesthetic minimal 2D flat vector illustration of an open notebook, a modern pen, and a cup of coffee on a wooden desk, warm cozy lighting, pastel colors, lofi study aesthetic, no text";
            
            const imgRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: { prompt: imgPrompt },
                    parameters: { sampleCount: 1 }
                })
            });
            
            const imgJson = await imgRes.json();
            
            if (imgJson.predictions && imgJson.predictions[0]) {
                // Mengambil hasil render gambar berupa format Base64
                imageUrl = `data:image/png;base64,${imgJson.predictions[0].bytesBase64Encoded}`;
            } else {
                throw new Error("Gagal mengambil prediksi gambar");
            }
        } catch(imgErr) {
            console.warn("Gambar Imagen gagal digenerate. Memakai gambar cadangan (fallback).", imgErr);
            // Gambar cadangan estetik bebas hak cipta jika API Imagen sedang sibuk/limit
            imageUrl = "https://images.unsplash.com/photo-1455390582262-044cdead2708?auto=format&fit=crop&w=600&q=80"; 
        }

        // --- 3. MENGIRIM KEMBALI KE WEBSITE ---
        res.status(200).json({
            judul: tipData.judul,
            isi: tipData.isi,
            gambar: imageUrl
        });

    } catch (error) {
        console.error("AI Daily Tip Error:", error);
        res.status(500).json({ error: "Gagal membuat tips harian." });
    }
}
