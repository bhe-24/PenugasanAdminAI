export const config = {
    runtime: 'edge', // WAJIB: Mencegah Vercel Timeout 10 Detik
};

export default async function handler(req) {
    // Handle CORS untuk Edge Runtime
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    try {
        const body = await req.json();
        const { judulBuku, babJudul, jumlahParagraf } = body;
        
        // PROMPT MASTER: Cerdas, Ketat, dan Berstruktur
        const prompt = `Anda adalah penulis buku teks pendidikan ahli dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa yang RINGAN, mengalir, mudah dipahami siswa, dan TIDAK KAKU.
- Alur penjelasan harus RUNUT, saling menyambung, dan DILARANG KERAS mengulang-ulang kalimat/poin yang sama.
- JIKA MENGGUNAKAN CONTOH KARYA SASTRA, WAJIB menggunakan karya Sastra Indonesia (misal: Bumi Manusia, Laskar Pelangi, Puisi Chairil Anwar, dll). JANGAN gunakan karya sastra asing.
- Panjang materi total MINIMAL ${jumlahParagraf} paragraf yang padat gizi.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3>):
1. <h3>1.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori, definisi, dan pondasi dasar dari materi bab ini secara mendalam)
2. <h3>1.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Berikan panduan langkah demi langkah cara menerapkannya beserta contoh kasus/kalimat dari karya sastra Indonesia)
3. <h3>1.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis menggunakan tag <table><tr><td>...</td></tr></table> ber-border)
4. <h3>1.4 Kesimpulan dan Pengayaan</h3>
   (Berikan 1 paragraf kesimpulan padat. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN berbentuk bullet points <ul><li>...</li></ul> untuk menguji pemahaman siswa).

ATURAN FORMATTING HTML:
- Balas HANYA dengan format HTML murni. 
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk memberi spasi antar paragraf.
- JANGAN sertakan Judul Bab di awal teks, langsung mulai dari <h3>1.1.
- DILARANG menggunakan markdown (\`\`\`).`;

        let htmlRes = "";

        try {
            // ==========================================
            // ATTEMPT 1: NGEBUT DENGAN GROQ AI (LLaMA 3.3)
            // ==========================================
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    model: 'llama-3.3-70b-versatile', 
                    messages: [{ role: 'user', content: prompt }], 
                    temperature: 0.6 // Sedikit diturunkan agar lebih fokus pada struktur
                })
            });

            if (!groqResponse.ok) throw new Error("Groq API Error/Limit");
            
            const groqData = await groqResponse.json();
            htmlRes = groqData.choices[0].message.content;

        } catch (groqError) {
            // ==========================================
            // ATTEMPT 2: FALLBACK KE GEMINI 2.5 FLASH
            // ==========================================
            console.log("Groq gagal/limit, beralih ke mesin Gemini 2.5 Flash...");
            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
                })
            });

            if (!geminiResponse.ok) throw new Error("Gemini API juga Error/Limit");
            
            const geminiData = await geminiResponse.json();
            htmlRes = geminiData.candidates[0].content.parts[0].text;
        }

        // BERSIHKAN FORMAT MARKDOWN (Berlaku untuk Groq maupun Gemini)
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim();

        // Return respons sukses untuk Edge Runtime
        return new Response(JSON.stringify({ chapterHtml: htmlRes }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (e) { 
        // Return respons error untuk Edge Runtime
        return new Response(JSON.stringify({ error: "Semua server AI (Groq & Gemini) sedang sibuk/limit. Coba lagi nanti." }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
