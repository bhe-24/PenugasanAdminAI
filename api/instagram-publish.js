// api/instagram-publish.js
// Dipanggil bertahap dari halaman admin (tiap langkah singkat -> aman dari batas waktu Vercel).
// action: config | createChild | createSingle | createCarousel | status | publish
const { admin, init, httpErr, requireAdmin, getToken, igUserId, graph } = require('./_ig');

function checkImageUrl(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) throw httpErr(500, 'CLOUDINARY_CLOUD_NAME belum diisi di Vercel.');
  if (typeof url !== 'string' || !url.startsWith(`https://res.cloudinary.com/${cloud}/`)) {
    throw httpErr(400, 'URL gambar harus berasal dari Cloudinary akun ini.');
  }
}

function cleanCaption(c) {
  if (typeof c !== 'string' || !c.trim()) throw httpErr(400, 'Caption kosong.');
  return c.trim().slice(0, 2200);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw httpErr(405, 'Gunakan metode POST.');
    const user = await requireAdmin(req);
    const body = req.body || {};
    const token = await getToken();
    const uid = igUserId();

    switch (body.action) {
      case 'config': {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_UPLOAD_PRESET) {
          throw httpErr(500, 'Variabel Cloudinary belum lengkap di Vercel.');
        }
        return res.status(200).json({
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
        });
      }

      case 'createChild': {
        checkImageUrl(body.imageUrl);
        const r = await graph('POST', `${uid}/media`, { image_url: body.imageUrl, is_carousel_item: 'true' }, token);
        return res.status(200).json({ id: r.id });
      }

      case 'createSingle': {
        checkImageUrl(body.imageUrl);
        const r = await graph('POST', `${uid}/media`, { image_url: body.imageUrl, caption: cleanCaption(body.caption) }, token);
        return res.status(200).json({ id: r.id });
      }

      case 'createCarousel': {
        const ids = Array.isArray(body.children) ? body.children.filter(x => /^\d+$/.test(String(x))) : [];
        if (ids.length < 2 || ids.length > 10) throw httpErr(400, 'Carousel butuh 2 sampai 10 slide.');
        const r = await graph('POST', `${uid}/media`, {
          media_type: 'CAROUSEL',
          children: ids.join(','),
          caption: cleanCaption(body.caption)
        }, token);
        return res.status(200).json({ id: r.id });
      }

      case 'status': {
        if (!/^\d+$/.test(String(body.id))) throw httpErr(400, 'ID tidak valid.');
        const r = await graph('GET', String(body.id), { fields: 'status_code,status' }, token);
        return res.status(200).json({ status_code: r.status_code, status: r.status || '' });
      }

      case 'publish': {
        if (!/^\d+$/.test(String(body.creationId))) throw httpErr(400, 'creationId tidak valid.');
        const pub = await graph('POST', `${uid}/media_publish`, { creation_id: String(body.creationId) }, token);

        let permalink = '';
        try {
          const m = await graph('GET', pub.id, { fields: 'permalink' }, token);
          permalink = m.permalink || '';
        } catch (e) {
          console.warn('Permalink gagal diambil:', e.message);
        }

        // Catat riwayat (kegagalan mencatat tidak membatalkan postingan yang sudah tayang)
        try {
          const fs = init().firestore();
          const FV = admin.firestore.FieldValue;
          if (typeof body.submissionId === 'string' && body.submissionId) {
            await fs.collection('weekly_submissions').doc(body.submissionId).set({
              igMediaId: pub.id, igPermalink: permalink, igPostedAt: FV.serverTimestamp()
            }, { merge: true });
          }
          await fs.collection('instagram_posts').add({
            mediaId: pub.id,
            permalink,
            submissionId: body.submissionId || null,
            eventId: body.eventId || null,
            author: String(body.author || '').slice(0, 120),
            title: String(body.title || '').slice(0, 200),
            postedBy: user.uid,
            postedAt: FV.serverTimestamp()
          });
        } catch (e) {
          console.warn('Gagal mencatat riwayat:', e.message);
        }

        return res.status(200).json({ mediaId: pub.id, permalink });
      }

      default:
        throw httpErr(400, 'Action tidak dikenal.');
    }
  } catch (e) {
    console.error('instagram-publish:', e.message);
    return res.status(e.status || 500).json({ error: e.message });
  }
};
