export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { 
                status: 405,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }

    try {
        // Edge Runtime: Parse JSON dengan TextDecoder
        const body = await req.text();
        const data = JSON.parse(body);
        const { judulBuku, babJudul, jumlahParagraf = 15 } = data;
        
        if (!judulBuku || !babJudul) {
            return new Response(
                JSON.stringify({ error: 'judulBuku dan babJudul wajib diisi' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // EKSTRAK NOMOR BAB
        const matchBab = babJudul.match(/Bab\s*(\d+)/i);
        const nomorBab = matchBab ? matchBab[1] : '1'; 

        // PROMPT YANG SUDAH DI-ESCAPE
        const prompt = `Kamu adalah penulis buku teks pendidikan ahli dan instruktur literasi dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa RINGAN, mengalir, edukatif, dan praktis (mudah diaplikasian siswa).
- Alur penjelasan RUNUT. DILARANG KERAS mengulang-ulang kalimat atau berputar-putar di ide yang sama.
- FOKUS PADA "CARA": Jika membahas teknik, jelaskan langkah-langkah konkret, logis, bisa langsung dipraktikkan.
- CONTOH NYATA & FAKTUAL: WAJIB gunakan karya Sastra Indonesia atau platform digital (Wattpad, Cabaca, Storial) YANG BENAR-BENAR ADA.
  * Sebutkan judul karya dan nama penulis asli secara akurat (Contoh: "Dear Nathan" karya Erisca Febriani, "Mariposa", dll).
  * JANGAN PERNAH mengarang kutipan palsu atau berhalusinasi.
  * Hindari contoh klise. Gunakan contoh segar dan relevan tren saat ini.
- Tulis MINIMAL ${jumlahParagraf} paragraf padat gizi.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3> menggunakan awalan nomor ${nomorBab}):
1. <h3>${nomorBab}.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori dan pondasi dasar materi bab ini)
2. <h3>${nomorBab}.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Panduan langkah demi langkah. WAJIB sertakan contoh kutipan/studi kasus dari karya nyata)
3. <h3>${nomorBab}.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis mendalam menggunakan tag <table><tr><td>...</td></tr></table> ber-border)
4. <h3>${nomorBab}.4 Kesimpulan dan Pengayaan</h3>
   (1 paragraf kesimpulan. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN tingkat tinggi berbentuk bullet points <ul><li>...</li></ul>).

ATURAN FORMATTING HTML:
- Balas HANYA dengan format HTML murni.
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk spasi antar paragraf.
- JANGAN tulis ulang Judul Bab (tag h1/h2) di awal, langsung mulai dari <h3>${nomorBab}.1.
- DILARANG menggunakan markdown.`;

        // Gunakan model yang benar
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ 
                    parts: [{ 
                        text: prompt 
                    }] 
                }],
                generationConfig: { 
                    temperature: 0.5, 
                    maxOutputTokens: 8192,
                    topP: 0.8,
                    topK: 40
                }
            })
        });

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text();
            console.error('Gemini Error:', errText);
            throw new Error(`Gemini API Error: ${geminiResponse.status} - ${errText.slice(0, 200)}`);
        }
        
        const geminiData = await geminiResponse.json();
        
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Respons Gemini tidak valid');
        }
        
        let htmlRes = geminiData.candidates[0].content.parts[0].text;

        // Bersihkan markdown dan artifacts
        htmlRes = htmlRes
            .replace(/```html\s*/g, '')
            .replace(/```\s*/g, '')
            .replace(/^\s*[\r\n]/gm, '') // Hapus baris kosong di awal
            .trim();

        return new Response(
            JSON.stringify({ 
                chapterHtml: htmlRes,
                success: true 
            }), 
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store'
                }
            }
        );

    } catch (error) {
        console.error('Handler Error:', error);
        return new Response(
            JSON.stringify({ 
                error: error.message || 'Internal server error',
                success: false 
            }), 
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
}
