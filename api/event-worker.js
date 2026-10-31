// api/event-worker.js
// Dipanggil terjadwal (cron). Memposting SATU karya dari antrean `event_antrean` per pemanggilan,
// tanpa butuh login admin atau halaman terbuka. Memakai helper yang sama dengan instagram-publish.js.
// Dua mode:
//  1) Cron/batch: header "Authorization: Bearer <CRON_SECRET>" -> memproses antrean (cadangan).
//  2) Langsung dari event.html: POST { id } tanpa secret -> hanya memposting SATU dokumen berstatus 'antre'
//     milik id itu, dengan validasi dan kuota server yang sama (tidak bisa resume yang macet).

import { admin, init, httpErr, getToken, igUserId, graph } from './_ig.js';

const DAILY_LIMIT = 50;      // maksimal slide tayang per hari
const MAX_ATTEMPTS = 3;      // percobaan sebelum ditandai gagal
const STALE_MS = 5 * 60 * 1000; // klaim "memposting" yang macet lebih dari ini boleh dilanjutkan

const sleep = ms => new Promise(r => setTimeout(r, ms));
const wibDate = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD (WIB)

function validUrl(u) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return !!cloud && typeof u === 'string' && u.startsWith(`https://res.cloudinary.com/${cloud}/`);
}

async function waitReady(id, token, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const s = await graph('GET', String(id), { fields: 'status_code,status' }, token);
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') {
      throw new Error(`Instagram menolak media (${s.status_code}). ${s.status || ''}`);
    }
    await sleep(2500);
  }
  const e = new Error('Instagram masih memproses media.'); e.timeout = true; throw e;
}

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    const isCron = !!secret && req.headers.authorization === `Bearer ${secret}`;
    const rawId = req.body?.id ?? req.query?.id;
    const onlyId = (!isCron && typeof rawId === 'string' && /^[A-Za-z0-9]{10,40}$/.test(rawId)) ? rawId : null;
    if (!isCron && !onlyId) throw httpErr(401, 'Tidak berwenang.');

    const fs = init().firestore();
    const FV = admin.firestore.FieldValue;
    const today = wibDate();

    // Slide yang sudah tayang hari ini (cek ulang di server, tidak percaya kuota dari browser)
    const postedSnap = await fs.collection('event_antrean').where('igPostedDate', '==', today).get();
    let postedToday = 0;
    postedSnap.forEach(d => { postedToday += Number(d.data().slideCount) || 0; });

    // Kandidat: antre / macet, jadwal sudah tiba, urut paling lama
    const snap = onlyId
      ? { docs: [await fs.collection('event_antrean').doc(onlyId).get()].filter(x => x.exists && x.data().status === 'antre') }
      : await fs.collection('event_antrean').where('status', 'in', ['antre', 'memposting']).get();
    const candidates = snap.docs
      .filter(d => (d.data().jadwalTayang || '9999') <= today)
      .sort((a, b) => String(a.data().jadwalTayang).localeCompare(String(b.data().jadwalTayang)) ||
        (a.data().queuedAt?.toMillis?.() || 0) - (b.data().queuedAt?.toMillis?.() || 0));

    if (!candidates.length) return res.status(200).json({ ok: true, message: 'Antrean kosong.' });

    for (const cand of candidates) {
      const ref = cand.ref;

      // Klaim dokumen agar tidak diproses dua kali
      const d = await fs.runTransaction(async tx => {
        const s = await tx.get(ref), x = s.data();
        const stale = isCron && x.status === 'memposting' && Date.now() - (x.claimedAt?.toMillis?.() || 0) > STALE_MS;
        if (x.status !== 'antre' && !stale) return null;
        tx.update(ref, { status: 'memposting', claimedAt: FV.serverTimestamp() });
        return x;
      });
      if (!d) continue;

      // Validasi data (koleksi ini bisa ditulis publik, jadi jangan dipercaya mentah-mentah)
      const urls = Array.isArray(d.slideUrls) ? d.slideUrls : [];
      const caption = typeof d.caption === 'string' ? d.caption.trim().slice(0, 2200) : '';
      if (urls.length < 1 || urls.length > 10 || !urls.every(validUrl) || !caption) {
        await ref.update({ status: 'ditolak_sistem', error: 'Data antrean tidak valid.' });
        continue;
      }
      if (postedToday + urls.length > DAILY_LIMIT) {
        await ref.update({ status: 'antre' }); // kuota hari ini penuh, tunggu besok
        continue;
      }

      try {
        const token = await getToken();
        const uid = igUserId();
        let childIds = d.igChildIds || [];
        let creationId = d.igCreationId;

        if (!creationId) {
          if (urls.length === 1) {
            creationId = (await graph('POST', `${uid}/media`, { image_url: urls[0], caption }, token)).id;
          } else {
            if (childIds.length !== urls.length) {
              childIds = [];
              for (const u of urls) {
                childIds.push((await graph('POST', `${uid}/media`, { image_url: u, is_carousel_item: 'true' }, token)).id);
              }
              await ref.update({ igChildIds: childIds });
            }
            for (const c of childIds) await waitReady(c, token);
            creationId = (await graph('POST', `${uid}/media`,
              { media_type: 'CAROUSEL', children: childIds.join(','), caption }, token)).id;
          }
          await ref.update({ igCreationId: creationId });
        }

        await waitReady(creationId, token);
        const pub = await graph('POST', `${uid}/media_publish`, { creation_id: String(creationId) }, token);

        let permalink = '';
        try { permalink = (await graph('GET', pub.id, { fields: 'permalink' }, token)).permalink || ''; }
        catch (e) { console.warn('Permalink gagal diambil:', e.message); }

        await ref.update({
          status: 'tayang', igMediaId: pub.id, igPermalink: permalink,
          igPostedAt: FV.serverTimestamp(), igPostedDate: today, error: FV.delete()
        });

        // Catat riwayat (kegagalan mencatat tidak membatalkan postingan yang sudah tayang)
        try {
          const subs = await fs.collection('weekly_submissions').where('antreanId', '==', ref.id).get();
          for (const s of subs.docs) {
            await s.ref.set({ igMediaId: pub.id, igPermalink: permalink, igPostedAt: FV.serverTimestamp() }, { merge: true });
          }
          await fs.collection('instagram_posts').add({
            mediaId: pub.id, permalink, submissionId: subs.docs[0]?.id || null, eventId: d.eventId || null,
            author: String(d.studentName || '').slice(0, 120), title: String(d.title || '').slice(0, 200),
            postedBy: 'event-worker', postedAt: FV.serverTimestamp()
          });
        } catch (e) { console.warn('Gagal mencatat riwayat:', e.message); }

        return res.status(200).json({ ok: true, posted: ref.id, slides: urls.length, permalink });

      } catch (e) {
        console.error('event-worker:', ref.id, e.message);
        if (e.timeout) {
          // Biarkan 'memposting' dengan igCreationId/igChildIds tersimpan; run berikutnya melanjutkan
          return res.status(200).json({ ok: true, pending: ref.id, message: e.message });
        }
        const attempts = (d.attempts || 0) + 1;
        await ref.update(attempts >= MAX_ATTEMPTS
          ? { status: 'gagal_posting', attempts, error: String(e.message).slice(0, 300) }
          : { status: 'antre', attempts, error: String(e.message).slice(0, 300),
              igCreationId: FV.delete(), igChildIds: FV.delete() });
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(200).json({ ok: true, message: 'Tidak ada karya yang bisa diposting sekarang.' });
  } catch (e) {
    console.error('event-worker:', e.message);
    return res.status(e.status || 500).json({ error: e.message });
  }
}
