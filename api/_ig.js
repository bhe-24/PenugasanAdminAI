// api/_ig.js — helper bersama (awalan "_" = tidak dijadikan endpoint oleh Vercel)

// PERBAIKAN 1: Menggunakan import
import admin from 'firebase-admin';

const API_VERSION = () => process.env.IG_API_VERSION || 'v26.0';

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function init() {
  if (!admin.apps.length) {
    let sa;
    try {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      throw httpErr(500, 'FIREBASE_SERVICE_ACCOUNT di Vercel bukan JSON yang valid.');
    }
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  return admin;
}

// Hanya admin yang UID-nya ada di ADMIN_UID_ALLOWLIST yang boleh memposting
async function requireAdmin(req) {
  const h = req.headers.authorization || '';
  const idToken = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!idToken) throw httpErr(401, 'Belum login.');

  let decoded;
  try {
    decoded = await init().auth().verifyIdToken(idToken);
  } catch {
    throw httpErr(401, 'Sesi login tidak valid atau kedaluwarsa. Muat ulang halaman.');
  }

  const allow = (process.env.ADMIN_UID_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allow.length) throw httpErr(500, 'ADMIN_UID_ALLOWLIST di Vercel masih kosong.');
  if (!allow.includes(decoded.uid)) throw httpErr(403, 'Akun ini tidak diizinkan memposting ke Instagram.');
  return decoded;
}

// Token: pakai hasil perpanjangan otomatis (Firestore) bila masih berlaku dan berasal dari token env yang sama,
// kalau tidak, pakai IG_ACCESS_TOKEN dari env.
async function getToken() {
  const envToken = process.env.IG_ACCESS_TOKEN;
  if (!envToken) throw httpErr(500, 'IG_ACCESS_TOKEN belum diisi di Vercel.');
  try {
    const snap = await init().firestore().collection('_server_secrets').doc('instagram').get();
    if (snap.exists) {
      const d = snap.data();
      if (d.token && d.sourceTail === envToken.slice(-8) && d.expiresAt > Date.now()) return d.token;
    }
  } catch (e) {
    console.warn('Gagal membaca token tersimpan:', e.message);
  }
  return envToken;
}

function igUserId() {
  if (!process.env.IG_USER_ID) throw httpErr(500, 'IG_USER_ID belum diisi di Vercel.');
  return process.env.IG_USER_ID;
}

async function graph(method, path, params, token) {
  const url = `https://graph.instagram.com/${API_VERSION()}/${path}`;
  const all = { ...params, access_token: token };
  let res;
  if (method === 'GET') {
    res = await fetch(`${url}?${new URLSearchParams(all)}`);
  } else {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(all)
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    const code = e.code ? ` (code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''})` : '';
    throw httpErr(res.status >= 400 ? res.status : 400, `Instagram: ${e.message || 'permintaan gagal'}${code}`);
  }
  return data;
}

// PERBAIKAN 2: Menggunakan export
export { admin, init, httpErr, requireAdmin, getToken, igUserId, graph };
