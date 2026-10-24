// api/instagram-refresh.js
// Memperpanjang token Instagram (berlaku ±60 hari) dan menyimpannya di Firestore (server-only).
// Dipanggil mingguan oleh Vercel Cron. Wajib ada env CRON_SECRET.
const { admin, init, httpErr, getToken } = require('./_ig');

module.exports = async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw httpErr(401, 'Tidak diizinkan.');

    const current = await getToken();
    const url = 'https://graph.instagram.com/refresh_access_token?' +
      new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: current });

    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error || !d.access_token) {
      throw httpErr(502, `Gagal memperpanjang token: ${d.error?.message || r.status}`);
    }

    await init().firestore().collection('_server_secrets').doc('instagram').set({
      token: d.access_token,
      expiresAt: Date.now() + Number(d.expires_in) * 1000,
      sourceTail: (process.env.IG_ACCESS_TOKEN || '').slice(-8),
      refreshedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ ok: true, expiresInDays: Math.round(Number(d.expires_in) / 86400) });
  } catch (e) {
    console.error('instagram-refresh:', e.message);
    return res.status(e.status || 500).json({ error: e.message });
  }
};
