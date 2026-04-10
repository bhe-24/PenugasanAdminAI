export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    // ... CORS handling sama ...

    const callGeminiWithRetry = async (maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const body = await req.text();
                const data = JSON.parse(body);
                const { judulBuku, babJudul, jumlahParagraf = 15 } = data;
                
                const matchBab = babJudul.match(/Bab\s*(\d+)/i);
                const nomorBab = matchBab ? matchBab[1] : '1'; 

                // PROMPT LENGKAP DAN DETAIL (yang di atas)
                const prompt = `Kamu adalah penulis buku teks pendidikan ahli dan instruktur literasi dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa kamu yang RINGAN, mengalir, edukatif, dan praktis (mudah diaplikasikan siswa).
- Alur penjelasan harus RUNUT. DILARANG KERAS mengulang-ulang kalimat atau berputar-putar di ide yang sama.
- FOKUS PADA "CARA": Jika membahas suatu teknik (misal: cara menulis di Wattpad, cara membuat puisi), jelaskan langkah-langkahnya secara konkret, logis, dan bisa langsung dipraktikkan.
- CONTOH NYATA & FAKTUAL: WAJIB menggunakan karya Sastra Indonesia atau referensi platform digital (Wattpad, Cabaca, Storial) yang BENAR-BENAR ADA di dunia nyata. 
  * Sebutkan judul karya dan nama penulis aslinya secara akurat (Contoh yang bagus: "Dear Nathan" karya Erisca Febriani, "Mariposa", dll).
  * JANGAN PERNAH mengarang kutipan palsu atau berhalusinasi. 
  * Hindari contoh klise. Gunakan contoh yang segar dan relevan dengan tren saat ini.
- Tulis MINIMAL ${jumlahParagraf} paragraf yang benar-benar padat gizi.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3> menggunakan awalan nomor ${nomorBab}):
1. <h3>${nomorBab}.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori dan pondasi dasar dari materi bab ini - MINIMAL 3 paragraf)
2. <h3>${nomorBab}.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Berikan panduan langkah demi langkah cara menerapkannya. WAJIB sertakan 2 contoh kutipan atau studi kasus dari karya nyata yang faktual - MINIMAL 5 paragraf)
3. <h3>${nomorBab}.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis mendalam menggunakan tag <table border="1" style="border-collapse: collapse; width:100%;"><tr><th>...</th></tr><tr><td>...</td></tr></table>. Bandingkan minimal 3 elemen/pendekatan - MINIMAL 4 paragraf)
4. <h3>${nomorBab}.4 Kesimpulan dan Pengayaan</h3>
   (Berikan 1 paragraf kesimpulan yang kuat. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN tingkat tinggi berbentuk bullet points <ul><li>...</li></ul> dengan jawaban singkat).

ATURAN FORMATTING HTML YANG SANGAT KERAS:
- Balas HANYA dengan format HTML murni. TIDAK ADA TEKS DI LUAR HTML.
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk memberi spasi antar paragraf.
- JANGAN tulis ulang Judul Bab (tag h1/h2) di awal teks, langsung mulai saja dari <h3>${nomorBab}.1.
- TABEL WAJIB: <table border="1" style="border-collapse: collapse; width:100%;"> dengan <th> dan <td>
- DILARANG MENGGUNAKAN markdown (\`**, *, #, dll).
- SEMUA paragraf dalam tag <p></p>`; 

                // ... sisa kode fetch dan response sama persis ...
            } catch (error) {
                // ... error handling sama ...
            }
        }
    };

    return callGeminiWithRetry(3);
}
