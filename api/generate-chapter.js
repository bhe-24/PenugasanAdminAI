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
        
        // EKSTRAK NOMOR BAB SECARA OTOMATIS (Misal: dari "Bab 3: Puisi" menjadi "3")
        const matchBab = babJudul.match(/Bab\s*(\d+)/i);
        const nomorBab = matchBab ? matchBab[1] : '1'; // Default ke 1 jika tidak ada kata "Bab"
        
        // PROMPT MASTER: Anti-Repetisi, Data Segar (Anti-Template), dan Nomor Dinamis
        const prompt = `Kamu adalah penulis buku teks pendidikan ahli dan dosen sastra kekinian dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa kamu yang RINGAN, mengalir, edukatif, dan mudah dipahami siswa (tidak kaku seperti robot).
- Alur penjelasan harus SANGAT RUNUT dan menyambung. 
- ANTI REPETISI: Setiap paragraf harus berisi ide atau informasi BARU. DILARANG KERAS mengulang-ulang kalimat, frasa, atau inti pikiran yang sama.
- DATA RIIL & ANTI KLISE: WAJIB menggunakan karya Sastra Indonesia atau platform digital (seperti Wattpad, Cabaca, dll) yang BENAR-BENAR ADA. 
  * PENTING: JANGAN terus-menerus memakai contoh template seperti "Laskar Pelangi" atau "Bumi Manusia". 
  * Jika membahas Wattpad, sebutkan judul, tren, atau penulis nyata yang populer (misal: "Dear Nathan" karya Erisca Febriani, "Mariposa", "Teluk Alaska", dll).
  * Jika membahas puisi/cerpen, gunakan spektrum penulis yang luas (Aan Mansyur, Eka Kurniawan, Dee Lestari, dll).
- Tulis MINIMAL ${jumlahParagraf} paragraf yang benar-benar padat gizi dan mendalam.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3> menggunakan awalan nomor ${nomorBab}):
1. <h3>${nomorBab}.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori, definisi, dan pondasi dasar dari materi bab ini secara mendalam)
2. <h3>${nomorBab}.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Berikan panduan langkah demi langkah menerapkannya beserta contoh kutipan atau studi kasus dari karya nyata yang segar/kekinian)
3. <h3>${nomorBab}.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis mendalam menggunakan tag <table><tr><td>...</td></tr></table> ber-border)
4. <h3>${nomorBab}.4 Kesimpulan dan Pengayaan</h3>
   (Berikan 1 paragraf kesimpulan padat. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN tingkat tinggi berbentuk bullet points <ul><li>...</li></ul> untuk menguji pemahaman siswa).

ATURAN FORMATTING HTML:
- Balas HANYA dengan format HTML murni. 
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk memberi spasi antar paragraf.
- JANGAN tulis ulang Judul Bab (tag h1/h2) di awal teks, langsung mulai saja dari <h3>${nomorBab}.1.
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
                    temperature: 0.6, // Suhu optimal untuk memancing pengetahuan sastranya
                    frequency_penalty: 0.4 // Penalti yang kuat agar tidak mengulang kata/ide
                })
            });

            if (!groqResponse.ok) throw new Error("Groq API Error/Limit");
            
            const groqData = await groqResponse.json();
            htmlRes = groqData.choices[0].message.content;

        } catch (groqError) {
            // ==========================================
            // ATTEMPT 2: FALLBACK KE GEMINI 2.5 FLASH DENGAN GOOGLE SEARCH
            // ==========================================
            console.log("Groq gagal/limit, beralih ke mesin Gemini 2.5 Flash dengan Google Search...");
            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    // INI FITUR RAHASIA: MENGAKTIFKAN GOOGLE SEARCH AGAR DATANYA REALTIME!
                    tools: [
                        { googleSearch: {} }
                    ],
                    generationConfig: { 
                        temperature: 0.6, 
                        maxOutputTokens: 8192,
                        presencePenalty: 0.3 
                    }
                })
            });

            if (!geminiResponse.ok) throw new Error("Gemini API juga Error/Limit");
            
            const geminiData = await geminiResponse.json();
            htmlRes = geminiData.candidates[0].content.parts[0].text;
        }

        // BERSIHKAN FORMAT MARKDOWN JIKA AI MASIH MENYERTAKANNYA
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
