// /js/naskah-mou-pdf.js
// Modul bersama untuk MOU Penerbitan Naskah/Buku Cendekia Aksara.
// Berisi definisi skema penerbitan (Gratis/Reguler/Express) dan generator
// definisi dokumen pdfMake. Dipakai oleh mou-penerbitan.html (pembuatan &
// arsip) dan verifikasi-naskah.html (verifikasi & cetak ulang dokumen sah).

export const SKEMA = {
    gratis: {
        key: 'gratis', kode: 'GRT', label: 'Gratis (Non-Komersial)',
        biayaText: 'Rp 0,00 (Tanpa Biaya Penerbitan)',
        eksemplarText: 'Tidak ada eksemplar cetak otomatis di awal; eksemplar bukti terbit diserahkan kepada Penulis setelah capaian penjualan pada Pasal 8 terpenuhi',
        halamanMax: 200
    },
    reguler: {
        key: 'reguler', kode: 'REG', label: 'Reguler',
        biayaText: 'Maksimal Rp 450.000,00 (empat ratus lima puluh ribu rupiah)',
        eksemplarText: '5 (lima) eksemplar buku cetak diserahkan kepada Penulis',
        halamanMax: 200
    },
    express: {
        key: 'express', kode: 'EXP', label: 'Express',
        biayaText: 'Rp 750.000,00 (tujuh ratus lima puluh ribu rupiah)',
        eksemplarText: '7 (tujuh) eksemplar buku cetak diserahkan kepada Penulis',
        halamanMax: 200
    }
};

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const ROMAWI_BULAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function parseTanggal(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// Istilah asing/di luar kaidah kebahasaan yang otomatis dicetak miring
const FOREIGN_TERMS = ['CASE', 'Force Majeure', 'self-managed printing', 'royalti', 'preview']
    .sort((a, b) => b.length - a.length);
const FOREIGN_RE = new RegExp('(' + FOREIGN_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
const fmt = (s) => String(s).split(FOREIGN_RE).map((seg, i) => (i % 2 ? { text: seg, italics: true } : seg)).filter(x => x !== '');
const runs = (parts) => (Array.isArray(parts) ? parts : [parts]).flatMap(p => (typeof p === 'string' ? fmt(p) : [p]));

const teks = (t) => ({ text: runs(t), alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 10] });
const pasalTitle = (n, judul) => ({ headlineLevel: 1, text: [`PASAL ${n}\n`, judul], fontSize: 11, bold: true, alignment: 'center', margin: [0, 16, 0, 10] });
const ayatOl = (items) => ({
    stack: items.map((it, i) => ({
        unbreakable: true,
        columns: [{ text: `(${i + 1})`, width: 26, bold: true }, { text: runs(it), width: '*', alignment: 'justify', lineHeight: 1.4 }],
        margin: [0, 0, 0, 7]
    })),
    margin: [8, 0, 0, 6]
});
const pasal = (n, judul, intro, items) => [pasalTitle(n, judul), ...(intro ? [teks(intro)] : []), ...(items ? [ayatOl(items)] : [])];
const garis = (w, y) => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 455, y2: 0, lineWidth: w, lineColor: '#001f3f' }], margin: y });

function cekData(val, label, isDraftLike) {
    if (isDraftLike && (!val || String(val).trim() === '')) return { text: `[ BELUM DIISI: ${label.toUpperCase()} ]`, color: 'red', bold: true };
    return val || '';
}

/**
 * Membangun definisi dokumen pdfMake untuk MOU Penerbitan Naskah/Buku.
 * data: { klasifikasi, judul_naskah, penulis_nama, penulis_alamat, jumlah_halaman,
 *         tanggal, nomor_surat, p1_nama, p1_jabatan, ttd_penerbit, ttd_penulis }
 * opts: { isDraft, isGeneric, qrVerifikasiDataUrl, assets:{logo,cap,tnrR,tnrB,tnrI,tnrBI} }
 */
export function buildDocDef(data, opts = {}) {
    const isDraft = !!opts.isDraft;
    const isGeneric = !!opts.isGeneric;
    const assets = opts.assets || {};
    const skema = SKEMA[data.klasifikasi] || SKEMA.reguler;
    const C = (v, l) => cekData(v, l, isDraft && !isGeneric);

    const judul = isGeneric ? '[JUDUL NASKAH]' : data.judul_naskah;
    const penulisNama = isGeneric ? '[NAMA PENULIS]' : data.penulis_nama;
    const penulisAlamat = isGeneric ? '[ALAMAT PENULIS]' : data.penulis_alamat;
    const p1Nama = data.p1_nama || 'Mukhamad Bayu Aji Tolafudin';
    const p1Jabatan = data.p1_jabatan || 'Ketua Pembina Literasi';
    const jmlHalaman = (!isGeneric && data.jumlah_halaman) ? data.jumlah_halaman : null;

    const tgl = parseTanggal(data.tanggal);
    const strTanggal = tgl ? `${tgl.getDate()} ${BULAN[tgl.getMonth()]} ${tgl.getFullYear()}` : '';
    const strHari = tgl ? HARI[tgl.getDay()] : '';
    const tahun = tgl ? String(tgl.getFullYear()) : String(new Date().getFullYear());
    const nomorSurat = isGeneric ? '[NOMOR DITERBITKAN OTOMATIS SAAT FINAL]' : (data.nomor_surat || '-');

    const fontsOK = !!(assets.tnrR && assets.tnrB && assets.tnrI && assets.tnrBI);

    const pasal3Items = [
        runs(['Penulis telah memilih Klasifikasi ', { text: skema.label, bold: true }, ' dengan ketentuan sebagai berikut: Biaya ', skema.biayaText, '; Eksemplar untuk Penulis: ', skema.eksemplarText, '; batas maksimal halaman Naskah 200 (dua ratus) halaman.']),
        ...(skema.key === 'gratis' ? ['Sebagai kompensasi atas skema penerbitan tanpa biaya, Penulis dan Penerbit menetapkan capaian penjualan sebagaimana diatur dalam Pasal 8.'] : []),
        'Apabila jumlah halaman Naskah melebihi batas maksimal pada ayat (1), Penerbit berhak mengajukan penyesuaian biaya tambahan yang disepakati secara tertulis oleh PARA PIHAK sebelum proses cetak dimulai.',
        'Perubahan Klasifikasi Penerbitan setelah Perjanjian ini ditandatangani hanya dapat dilakukan melalui adendum tertulis yang disetujui PARA PIHAK.'
    ];

    const pasal4Items = skema.key === 'gratis'
        ? ['Penulis tidak dikenakan biaya penerbitan dalam bentuk apa pun atas Klasifikasi Gratis.', 'Biaya produksi ditanggung sepenuhnya oleh Penerbit sebagai bagian dari program literasi komunitas.']
        : [
            runs(['Penulis wajib membayar biaya penerbitan sebesar ', skema.biayaText, ' kepada Penerbit.']),
            'Pembayaran dilakukan lunas paling lambat sebelum Naskah masuk proses cetak, melalui rekening resmi Penerbit yang diberitahukan secara tertulis.',
            'Biaya administrasi transfer, jika ada, menjadi tanggungan Penulis.',
            'Bukti pembayaran yang sah adalah bukti transfer resmi dari bank/penyedia jasa pembayaran, bukan tangkapan layar aplikasi percakapan.'
        ];

    const pasal7Items = [
        'Penulis berhak menerima Eksemplar sesuai Klasifikasi Penerbitan yang dipilih.',
        'Penulis wajib menyerahkan Naskah final yang telah siap cetak sesuai Pasal 5.',
        ...(skema.key !== 'gratis' ? ['Penulis wajib melunasi biaya penerbitan sesuai Pasal 4.'] : ['Penulis wajib memenuhi capaian penjualan sebagaimana diatur Pasal 8.']),
        'Penulis wajib menjaga nama baik Penerbit dalam setiap bentuk promosi Buku.'
    ];

    const pasal8 = skema.key === 'gratis'
        ? pasal(8, 'CAPAIAN PENJUALAN', null, [
            'Penulis wajib memastikan Buku terjual sekurang-kurangnya 3 (tiga) eksemplar atau senilai akumulasi penjualan Rp 250.000,00 (dua ratus lima puluh ribu rupiah) dalam jangka waktu 6 (enam) bulan sejak tanggal terbit Buku.',
            'Apabila capaian pada ayat (1) tidak terpenuhi, PARA PIHAK akan bermusyawarah untuk menentukan langkah lanjutan, termasuk namun tidak terbatas pada perpanjangan waktu, penyesuaian skema, atau pengenaan biaya penerbitan setara Klasifikasi Reguler.',
            'Pencapaian target penjualan dihitung berdasarkan data penjualan resmi yang dikelola oleh Penerbit.'
        ])
        : pasal(8, 'ROYALTI', null, [
            'Penulis berhak atas royalti penjualan Buku di luar Eksemplar yang telah diterima, dengan besaran dan mekanisme yang diatur dalam kesepakatan tertulis terpisah antara PARA PIHAK.',
            'Pembayaran royalti dilakukan secara berkala berdasarkan laporan penjualan resmi Penerbit.'
        ]);

    const content = [
        // ===== SAMPUL =====
        { text: '\n\n\n\n' },
        garis(4, [0, 0, 0, 5]), garis(1, [0, 0, 0, 0]),
        { text: ['\n\nMEMORANDUM OF UNDERSTANDING\n', { text: '(NOTA KESEPAHAMAN PENERBITAN NASKAH)\n\n', fontSize: 13, bold: false }], fontSize: 21, bold: true, alignment: 'center', lineHeight: 1.4 },
        { text: runs([`PENERBITAN NASKAH — KLASIFIKASI ${skema.label.toUpperCase()}\n`, C(judul, 'Judul Naskah')]), fontSize: 15, bold: true, alignment: 'center', margin: [0, 8, 0, 36] },
        { text: 'ANTARA\n', fontSize: 13, alignment: 'center', margin: [0, 0, 0, 14] },
        { text: 'KOMUNITAS CENDEKIA AKSARA\n(Penerbit)', fontSize: 16, bold: true, alignment: 'center' },
        { text: 'DENGAN\n', fontSize: 13, alignment: 'center', margin: [0, 14, 0, 14] },
        { text: runs([C(penulisNama, 'Nama Penulis'), '\n(Penulis)']), fontSize: 16, bold: true, alignment: 'center' },
        { text: '\n\n\n' }, garis(1, [0, 0, 0, 5]), garis(4, [0, 0, 0, 0]),
        { text: `\nNomor: ${nomorSurat}\nTahun ${tahun}`, fontSize: 11, alignment: 'center', pageBreak: 'after' },

        // ===== KOP SURAT =====
        {
            columns: [
                assets.logo ? { image: assets.logo, width: 58 } : { text: '', width: 58 },
                {
                    width: '*', margin: [0, 2, 0, 0], stack: [
                        { text: 'KOMUNITAS LITERASI CENDEKIA AKSARA', fontSize: 10.5, bold: true, alignment: 'center' },
                        { text: 'PT CENDEKIA AKSARA EDUKASI', fontSize: 14, bold: true, alignment: 'center', margin: [0, 1, 0, 3] },
                        { text: 'Email: ragamliterasi@gmail.com | cendekia.aksara25@gmail.com', fontSize: 7.5, alignment: 'center' },
                        { text: 'Alamat: Gang Melati No. 22, RT 002/RW 004, Karangtejo, Kec. Kedu, Kab. Temanggung 56252', fontSize: 7.5, alignment: 'center' }
                    ]
                },
                { text: '', width: 58 }
            ], margin: [0, 0, 0, 8]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 455, y2: 0, lineWidth: 2 }], margin: [0, 0, 0, 2] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 455, y2: 0, lineWidth: 0.5 }], margin: [0, 0, 0, 14] },

        { text: 'PERJANJIAN KERJA SAMA PENERBITAN NASKAH', fontSize: 12.5, bold: true, italics: true, alignment: 'center', decoration: 'underline' },
        { text: `Nomor: ${nomorSurat}`, fontSize: 10, alignment: 'center', margin: [0, 2, 0, 14] },

        teks(['Pada hari ini, ', C(strHari, 'Hari'), ', tanggal ', C(strTanggal, 'Tanggal'), ', yang bertanda tangan di bawah ini:']),
        {
            margin: [15, 0, 0, 6], layout: 'noBorders',
            table: {
                widths: [18, 90, 10, '*'], body: [
                    [{ text: '1.' }, { text: 'Nama' }, { text: ':' }, { text: runs(p1Nama), bold: true }],
                    [{ text: '' }, { text: 'Jabatan' }, { text: ':' }, { text: runs(p1Jabatan) }],
                    [{ text: '' }, { text: 'Instansi' }, { text: ':' }, { text: 'Komunitas Cendekia Aksara (PT Cendekia Aksara Edukasi)' }]
                ]
            }
        },
        teks('Bertindak untuk dan atas nama Komunitas Cendekia Aksara, selanjutnya dalam Perjanjian ini disebut "PENERBIT".'),
        {
            margin: [15, 0, 0, 6], layout: 'noBorders',
            table: {
                widths: [18, 90, 10, '*'], body: [
                    [{ text: '2.' }, { text: 'Nama' }, { text: ':' }, { text: runs(C(penulisNama, 'Nama Penulis')), bold: true }],
                    [{ text: '' }, { text: 'Alamat' }, { text: ':' }, { text: runs(C(penulisAlamat, 'Alamat Penulis')) }]
                ]
            }
        },
        teks('Bertindak untuk dan atas nama dirinya sendiri selaku pemilik dan pencipta Naskah, selanjutnya dalam Perjanjian ini disebut "PENULIS".'),
        teks('PENERBIT dan PENULIS secara bersama-sama disebut "PARA PIHAK". PARA PIHAK sepakat mengikatkan diri dalam Perjanjian Kerja Sama Penerbitan Naskah dengan ketentuan sebagai berikut:'),

        ...pasal(1, 'DEFINISI', null, [
            '"Naskah" berarti karya tulis dalam bentuk buku yang diserahkan Penulis kepada Penerbit untuk diterbitkan berdasarkan Perjanjian ini.',
            '"Buku" berarti hasil cetak Naskah yang telah melalui proses penyuntingan, tata letak, dan pencetakan oleh Penerbit.',
            '"Klasifikasi Penerbitan" berarti skema penerbitan yang dipilih Penulis, yaitu Gratis, Reguler, atau Express, sebagaimana diatur Pasal 3.',
            '"Eksemplar" berarti satuan salinan cetak Buku yang diserahkan Penerbit kepada Penulis sesuai Klasifikasi Penerbitan yang berlaku.',
            '"CASE" (Cendekia Aksara Sign Elektronik) berarti sistem tanda tangan elektronik resmi Penerbit yang digunakan untuk mengesahkan dokumen ini secara digital.'
        ]),
        ...pasal(2, 'OBJEK DAN RUANG LINGKUP', null, [
            runs(['Objek Perjanjian ini adalah penerbitan dan pencetakan Naskah berjudul "', C(judul, 'Judul Naskah'), '" sesuai Klasifikasi ', skema.label, '.']),
            'Ruang lingkup meliputi penyuntingan, desain sampul, tata letak, pencetakan, dan penyerahan Eksemplar kepada Penulis sesuai Klasifikasi Penerbitan yang dipilih.',
            'Penerbit bertindak sekaligus sebagai pelaksana proses percetakan (self-managed printing) sehingga tidak terdapat pihak ketiga percetakan terpisah dalam Perjanjian ini.'
        ]),
        ...pasal(3, 'KLASIFIKASI DAN SKEMA PENERBITAN', null, pasal3Items),
        ...pasal(4, 'BIAYA DAN TATA CARA PEMBAYARAN', null, pasal4Items),
        ...pasal(5, 'KETENTUAN NASKAH', null, [
            'Naskah yang diserahkan wajib merupakan karya asli Penulis, tidak melanggar hak cipta pihak lain, dan tidak mengandung unsur SARA, pornografi, atau ujaran kebencian.',
            `Jumlah halaman Naskah maksimal 200 (dua ratus) halaman sebagaimana diatur Pasal 3. Kelebihan halaman tunduk pada ketentuan Pasal 3 ayat (2).${jmlHalaman ? ` Jumlah halaman Naskah pada Perjanjian ini adalah ${jmlHalaman} halaman.` : ''}`,
            'Penulis bertanggung jawab penuh atas kebenaran isi, keaslian data, dan keakuratan informasi yang tercantum dalam Naskah.',
            'Penerbit berhak melakukan penyuntingan bahasa dan tata letak tanpa mengubah substansi karya, dengan persetujuan Penulis.'
        ]),
        ...pasal(6, 'HAK DAN KEWAJIBAN PENERBIT', null, [
            'Penerbit berhak menerima biaya penerbitan sesuai Klasifikasi yang dipilih (jika ada).',
            'Penerbit wajib menerbitkan dan mencetak Buku sesuai jadwal yang disepakati setelah seluruh persyaratan Pasal 4 dan Pasal 5 terpenuhi.',
            'Penerbit wajib menyerahkan Eksemplar kepada Penulis sesuai Klasifikasi Penerbitan yang berlaku.',
            'Penerbit wajib memberikan laporan progres penerbitan kepada Penulis atas permintaan tertulis.'
        ]),
        ...pasal(7, 'HAK DAN KEWAJIBAN PENULIS', null, pasal7Items),
        ...pasal8,
        ...pasal(9, 'HAK CIPTA', null, [
            'Hak cipta atas isi Naskah tetap melekat pada Penulis sesuai peraturan perundang-undangan Hak Cipta yang berlaku di Indonesia.',
            'Penerbit diberikan lisensi non-eksklusif untuk mencetak, mendistribusikan, dan memasarkan Buku selama Jangka Waktu Perjanjian ini berlaku.',
            'Penggunaan judul, sampul, dan tata letak Buku oleh pihak ketiga tanpa izin tertulis PARA PIHAK dilarang.'
        ]),
        ...pasal(10, 'JANGKA WAKTU DAN PENGAKHIRAN', null, [
            'Perjanjian ini berlaku sejak tanggal ditandatangani hingga seluruh hak dan kewajiban PARA PIHAK terpenuhi.',
            'Perjanjian dapat diakhiri lebih awal atas kesepakatan tertulis PARA PIHAK, atau apabila salah satu Pihak melakukan wanprestasi yang tidak diperbaiki dalam 14 (empat belas) hari kalender sejak surat peringatan tertulis.'
        ]),
        ...pasal(11, 'KEADAAN MEMAKSA DAN PENYELESAIAN SENGKETA', null, [
            'PARA PIHAK dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pelaksanaan kewajiban akibat keadaan memaksa (Force Majeure) di luar kendali wajar PARA PIHAK.',
            'Setiap perselisihan yang timbul diselesaikan secara musyawarah untuk mufakat; apabila tidak tercapai, PARA PIHAK sepakat menyelesaikannya melalui domisili hukum Kantor Kepaniteraan Pengadilan Negeri Temanggung.'
        ]),
        ...pasal(12, 'PENUTUP', null, [
            'Perjanjian ini dibuat dengan itikad baik oleh PARA PIHAK setelah dibaca dan dipahami seluruh isinya.',
            'Perjanjian ini sah dan mengikat sejak ditandatangani secara elektronik melalui sistem CASE (Cendekia Aksara Sign Elektronik) oleh PARA PIHAK.',
            'Dokumen elektronik ini memiliki kekuatan hukum yang setara dengan dokumen fisik bermeterai sesuai Undang-Undang Informasi dan Transaksi Elektronik yang berlaku di Indonesia.'
        ]),

        // ===== TANDA TANGAN =====
        {
            unbreakable: true, margin: [0, 26, 0, 0], layout: 'noBorders',
            table: {
                widths: ['50%', '50%'], heights: [18, 90, 16], body: [
                    [{ text: 'PENERBIT\nPT Cendekia Aksara Edukasi', bold: true, alignment: 'center', fontSize: 10 },
                    { text: 'PENULIS', bold: true, alignment: 'center', fontSize: 10 }],
                    [
                        {
                            alignment: 'center', stack: [
                                (assets.cap && !isDraft && !isGeneric) ? { image: assets.cap, width: 80, opacity: 0.55 } : { text: '\n\n' },
                                (!isDraft && !isGeneric && data.ttd_penerbit) ? { image: data.ttd_penerbit, width: 115, relativePosition: { x: 0, y: -58 } } : { text: '' }
                            ]
                        },
                        {
                            alignment: 'center', stack: [
                                (!isDraft && !isGeneric && data.ttd_penulis)
                                    ? { image: data.ttd_penulis, width: 115 }
                                    : { text: '\n\n\n(Tanda tangan elektronik CASE)', fontSize: 8.5, italics: true, color: '#94a3b8' }
                            ]
                        }
                    ],
                    [{ text: runs(C(p1Nama, 'Nama Perwakilan Penerbit')), bold: true, alignment: 'center', decoration: 'underline', fontSize: 10 },
                    { text: runs(C(penulisNama, 'Nama Penulis')), bold: true, alignment: 'center', decoration: 'underline', fontSize: 10 }]
                ]
            }
        },

        // ===== QR VERIFIKASI =====
        {
            margin: [0, 18, 0, 0], columns: [
                { width: '*', text: '' },
                opts.qrVerifikasiDataUrl
                    ? { width: 'auto', alignment: 'center', stack: [{ image: opts.qrVerifikasiDataUrl, width: 68 }, { text: 'Pindai untuk verifikasi keaslian dokumen', fontSize: 7, alignment: 'center', color: '#64748b', margin: [0, 2, 0, 0] }] }
                    : { width: 'auto', alignment: 'center', text: isGeneric ? '' : '[ QR verifikasi tersedia pada dokumen final ]', fontSize: 8, italics: true, color: '#94a3b8' },
                { width: '*', text: '' }
            ]
        },
        { text: 'Dokumen ini merupakan salinan yang sah dan telah ditandatangani secara elektronik melalui CASE (Cendekia Aksara Sign Elektronik).', italics: true, fontSize: 8, alignment: 'center', color: '#64748b', margin: [0, 14, 0, 0] }
    ];

    return {
        pageSize: 'A4', pageMargins: [62, 72, 62, 72],
        header: (cp) => (cp <= 1) ? null : { text: `MOU PENERBITAN NASKAH — ${skema.label.toUpperCase()}`, alignment: 'right', fontSize: 8, italics: true, color: '#94a3b8', margin: [0, 26, 62, 0] },
        footer: (cp, pc) => (cp === 1) ? null : { text: `Halaman ${cp - 1} dari ${pc - 1}`, alignment: 'center', fontSize: 9, margin: [0, 16, 0, 0] },
        pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length <= 1,
        content,
        defaultStyle: { font: fontsOK ? 'TimesNewRoman' : 'Roboto', fontSize: 10.3 }
    };
}
