export const config = {
    runtime: 'edge', // Mencegah Vercel Timeout 10 Detik
};

export default async function handler(req) {
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
        
        // EKSTRAK NOMOR BAB SECARA OTOMATIS
        const matchBab = babJudul.match(/Bab\s*(\d+)/i);
        const nomorBab = matchBab ? matchBab[1] : '1'; 
        
        // PROMPT MASTER GEMINI: Fokus pada Fakta, Tutorial, dan Anti-Ngawur
        const prompt = `Kamu adalah penulis buku teks pendidikan ahli dan instruktur literasi dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa kamu yang RINGAN, mengalir, edukatif, dan praktis (mudah diaplikasikan siswa).
- Alur penjelasan harus RUNUT. DILARANG KERAS mengulang-ulang kalimat atau berputar-putar di ide yang sama.
- FOKUS PADA "CARA": Jika membahas suatu teknik (misal: cara menulis di Wattpad, cara membuat puisi), jelaskan langkah-langkahnya secara konkret, logis, dan bisa langsung dipraktikkan.
- CONTOH NYATA & FAKTUAL: WAJIB menggunakan karya Sastra Indonesia atau referensi platform digital (Wattpad, Cabaca, Storial) yang BENAR-BENAR ADA di dunia nyata. 
  * Sebutkan judul karya dan nama penulis aslinya secara akurat.
  * JANGAN PERNAH mengarang kutipan palsu atau berhalusinasi. Jika kamu tidak tahu, gunakan fitur Google Search-mu untuk mencari faktanya terlebih dahulu.
  * Hindari contoh klise. Gunakan contoh yang segar dan relevan dengan tren saat ini.
- Tulis MINIMAL ${jumlahParagraf} paragraf yang benar-benar padat gizi.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3> menggunakan awalan nomor ${nomorBab}):
1. <h3>${nomorBab}.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori dan pondasi dasar dari materi bab ini)
2. <h3>${nomorBab}.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Berikan panduan langkah demi langkah cara menerapkannya. WAJIB sertakan contoh kutipan atau studi kasus dari karya nyata yang faktual)
3. <h3>${nomorBab}.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis mendalam menggunakan tag <table><tr><td>...</td></tr></table> ber-border)
4. <h3>${nomorBab}.4 Kesimpulan dan Pengayaan</h3>
   (Berikan 1 paragraf kesimpulan. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN tingkat tinggi berbentuk bullet points <ul><li>...</li></ul>).

ATURAN FORMATTING HTML:
- Balas HANYA dengan format HTML murni. 
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk memberi spasi antar paragraf.
- JANGAN tulis ulang Judul Bab (tag h1/h2) di awal teks, langsung mulai saja dari <h3>${nomorBab}.1.
- DILARANG menggunakan markdown (\`\`\`).`;

        console.log(`Menulis ${babJudul} menggunakan Gemini 2.5 Flash (with Search)...`);
        
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                // MENGAKTIFKAN GOOGLE SEARCH AGAR GEMINI MENCARI FAKTA (BUKAN MENGARANG)
                tools: [
                    { googleSearch: {} }
                ],
                generationConfig: { 
                    temperature: 0.5, // Suhu dingin agar hasil logis dan faktual
                    maxOutputTokens: 8192,
                    presencePenalty: 0.3 // Mencegah repetisi ide
                }
            })
        });

        if (!geminiResponse.ok) {
            const errData = await geminiResponse.json();
            throw new Error(`Gemini API Error: ${errData.error?.message || 'Unknown limit'}`);
        }
        
        const geminiData = await geminiResponse.json();
        let htmlRes = geminiData.candidates[0].content.parts[0].text;

        // Bersihkan Markdown jika Gemini masih menyertakannya
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim();

        // Return sukses
        return new Response(JSON.stringify({ chapterHtml: htmlRes }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (e) { 
        // Return error
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
