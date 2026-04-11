// Menggunakan fetch ke Google Gemini API (gemini-2.5-flash)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const data = req.body;
    // Pastikan API Key Gemini tersimpan di ENV servermu dengan nama GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY; 

    // --- SUSUN OUTLINE MENJADI TEKS ---
    let outlineTeks = "Tidak ada outline";
    if (data.outline && data.outline.length > 0) {
        outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1} (${bab.judul_bab || 'Tanpa Judul'}): ${bab.isi_bab}`).join('\n');
    }

    // --- THE SUPER PROMPT ---
    const systemPrompt = `
Kamu adalah "Mentor Cendekia", seorang Editor Akuisisi Novel di penerbitan mayor yang asyik, gaul, tapi sangat kritis dan tajam dalam membedah naskah. 
Gaya bahasamu kasual, empatik, menggunakan kata "Aku" dan "Kamu".

Tugasmu: Mengevaluasi proposal naskah dari siswa.
Siswa: ${data.studentName}
Judul: ${data.judul}
Genre: ${data.genre}
Target: ${data.target_kata} kata
Logline: ${data.logline}
Sinopsis: ${data.sinopsis}
Outline:
${outlineTeks}

STRUKTUR BALASAN YANG WAJIB KAMU BUAT:
1. Sapaan Hangat: Sapa nama siswanya. Beri apresiasi karena sudah menyelesaikan proposal ini.
   (Contoh: "Halo ${data.studentName}! Setelah aku baca apa yang kamu ajukan...")
2. Evaluasi Judul & Genre: Apakah judulnya menarik/komersial? Apakah genre dan target katanya logis?
3. Bedah Logline & Sinopsis:
   - Apresiasi kekuatan idenya.
   - PENGKRITIKAN TAJAM: Sebutkan jika ada plot hole, karakter yang kurang kuat motifnya, atau alur yang klise.
   - Gunakan kalimat seperti: "Ada beberapa poin kosong yang seru banget untuk kamu tambahkan nih..."
4. Evaluasi Outline: Apakah pacing/alur per babnya masuk akal? Adakah bab yang terasa lambat (dragging) atau terlalu terburu-buru (rushing)?
5. Kesimpulan (Urgensi & Potensi): Beri tahu potensi naskah ini di pasaran. 
6. Rekomendasi Keputusan Akhir: Secara implisit beri tahu apakah naskah ini "Layak ACC", "Perlu Revisi Minor/Mayor", atau "Sebaiknya ganti ide (Tolak)".

Tulis langsung pesan untuk siswanya, tanpa tanda kutip pembuka atau format JSON. Langsung paragraf teks.
`;

    try {
        // Endpoint resmi Gemini API
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const aiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: "Kamu adalah mentor novel yang ahli." }]
                },
                contents: [{
                    parts: [{ text: systemPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 800
                }
            })
        });

        if (!aiResponse.ok) {
            const errorData = await aiResponse.json();
            console.error("Detail Error Gemini API:", errorData);
            throw new Error("Gagal memanggil API Gemini");
        }

        const aiResult = await aiResponse.json();
        
        // Mengekstrak teks balasan dari struktur JSON spesifik Gemini
        const hasilTeks = aiResult.candidates[0].content.parts[0].text;

        // Kirim balik ke frontend Admin
        return res.status(200).json({ analisis_teks: hasilTeks });

    } catch (error) {
        console.error("Error AI API:", error);
        return res.status(500).json({ message: "Gagal memproses AI" });
    }
}
