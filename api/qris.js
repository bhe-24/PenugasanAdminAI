/* SATU FILE untuk seluruh sistem QRIS Kaskuy (hanya 1 serverless function).
   POST /api/qris?action=create   -> dipanggil halaman keuangan.html
   POST /api/qris?action=webhook  -> didaftarkan di dashboard Kaskuy */
const crypto = require('crypto');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();
const TS = admin.firestore.Timestamp, FV = admin.firestore.FieldValue;

const BIAYA_LUNAS = 75450, BIAYA_CICILAN = 37725, DENDA = 0.10, MINGGU = 7 * 864e5;
const CICILAN2_HARI = 30; // ASUMSI: jatuh tempo cicilan 2 = 30 hari setelah cicilan 1. Sesuaikan.

/* ===== ADAPTER KASKUY — path & nama field PLACEHOLDER, cocokkan dengan dokumentasi ===== */
const GW = {
  base: process.env.KASKUY_BASE_URL,
  createPath: '/GANTI_PATH_BUAT_TRANSAKSI',
  statusPath: (id) => `/GANTI_PATH_CEK_STATUS/${id}`,
};
async function gw(path, opt = {}) {
  const r = await fetch(GW.base + path, {
    ...opt,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.KASKUY_API_KEY}`, ...(opt.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Gateway error ${r.status}`);
  return j;
}
async function gwCreate({ orderId, amount }) {
  const j = await gw(GW.createPath, { method: 'POST', body: JSON.stringify({ order_id: orderId, amount }) });
  const d = j.data || j;
  return {
    gatewayId: String(d.id || d.transaction_id),
    qrString: d.qr_string || null,
    qrImage: d.qr_url || d.qr_image || null,
    amount: Number(d.total_amount || d.amount || amount),
    expiresAtMs: d.expired_at ? new Date(d.expired_at).getTime() : Date.now() + 30 * 60000,
  };
}
async function gwStatus(gatewayId) {
  const j = await gw(GW.statusPath(gatewayId));
  const d = j.data || j;
  return { paid: ['paid', 'success', 'settlement'].includes(String(d.status).toLowerCase()), amount: Number(d.total_amount || d.amount) };
}

/* ===== util ===== */
const readRaw = (req) => new Promise((ok, no) => { let b = ''; req.on('data', c => b += c); req.on('end', () => ok(b)); req.on('error', no); });

function nominalCicilan2(user) {
  const due = user.sem3_cicilan2_due && user.sem3_cicilan2_due.toDate ? user.sem3_cicilan2_due.toDate() : null;
  if (!due) return BIAYA_CICILAN;
  const selisih = Date.now() - due.getTime();
  if (selisih <= MINGGU) return BIAYA_CICILAN;
  return Math.round(BIAYA_CICILAN * Math.pow(1 + DENDA, Math.floor(selisih / MINGGU)));
}

/* ===== action: create ===== */
async function handleCreate(req, res, raw) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { uid } = await admin.auth().verifyIdToken(token);
  const ref = db.doc('users/' + uid);
  const user = (await ref.get()).data();
  const sem = parseInt(String(user.semester || 1).replace(/\D/g, '')) || 1;
  const stageReq = (JSON.parse(raw || '{}').stage) || '';

  let amount, label, stage;
  if (sem < 3) {
    if (user.statusPembayaran === 'Lunas') return res.status(400).json({ error: 'Sudah lunas' });
    const n = (await db.collection('exams').where('status', '==', 'active').get()).size;
    amount = n * 1000; label = 'Uang Ujian'; stage = 'ujian';
  } else {
    const st = user.sem3_status || 'belum';
    if (st === 'lunas') return res.status(400).json({ error: 'Sudah lunas' });
    if (st === 'cicilan1_lunas') { amount = nominalCicilan2(user); label = 'Pelunasan Cicilan Tahap 2'; stage = 'cicilan2'; }
    else if (stageReq === 'cicilan1') { amount = BIAYA_CICILAN; label = 'Cicilan Tahap 1 (50%)'; stage = 'cicilan1'; }
    else if (stageReq === 'lunas') { amount = BIAYA_LUNAS; label = 'Lunas Penuh'; stage = 'lunas'; }
    else return res.status(400).json({ error: 'Tahap tidak valid' });
  }
  if (!amount) return res.status(400).json({ error: 'Tidak ada tagihan aktif' });

  const p = user.pendingInvoice;
  if (p && p.stage === stage && p.baseAmount === amount && p.expiresAtMs > Date.now() + 60000) {
    return res.json({ label, amount: p.amount, qrImage: p.qrImage, qrString: p.qrString, expiresAtMs: p.expiresAtMs });
  }

  const orderId = `CA-${uid.slice(0, 6)}-${Date.now()}`;
  const inv = await gwCreate({ orderId, amount });
  const rec = { orderId, gatewayId: inv.gatewayId, stage, baseAmount: amount, amount: inv.amount,
                qrImage: inv.qrImage, qrString: inv.qrString, expiresAtMs: inv.expiresAtMs, label };

  await db.doc('payments/' + orderId).set({ uid, ...rec, status: 'pending', createdAt: FV.serverTimestamp() });
  await ref.update(sem >= 3
    ? { pendingInvoice: rec, sem3_paymentStatus: 'waiting', sem3_pendingAmount: inv.amount, sem3_pendingStage: stage }
    : { pendingInvoice: rec, paymentStatus: 'waiting', pendingAmount: inv.amount });

  res.json({ label, amount: inv.amount, qrImage: inv.qrImage, qrString: inv.qrString, expiresAtMs: inv.expiresAtMs });
}

/* ===== action: webhook ===== */
async function handleWebhook(req, res, raw) {
  const secret = process.env.KASKUY_WEBHOOK_SECRET;
  if (secret) { // nama header & algoritma: sesuaikan dokumentasi Kaskuy
    const sig = String(req.headers['x-signature'] || '');
    const exp = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp)))
      return res.status(401).json({ error: 'bad signature' });
  }
  const body = JSON.parse(raw || '{}');
  const orderId = (body.data || body).order_id;
  if (!orderId) return res.status(400).json({ error: 'order_id kosong' });

  const pRef = db.doc('payments/' + orderId);
  const p = (await pRef.get()).data();
  if (!p) return res.status(404).json({ error: 'order tidak dikenal' });
  if (p.status === 'paid') return res.json({ ok: true });

  const st = await gwStatus(p.gatewayId); // konfirmasi ulang ke gateway
  if (!st.paid || (Number.isFinite(st.amount) && st.amount !== p.amount)) return res.json({ ok: true, ignored: true });

  await db.runTransaction(async (t) => {
    const uRef = db.doc('users/' + p.uid);
    const [pSnap, uSnap] = await Promise.all([t.get(pRef), t.get(uRef)]);
    if (pSnap.data().status === 'paid') return;
    const u = uSnap.data(), now = Date.now();
    let upd = { pendingInvoice: FV.delete() };
    if (p.stage === 'ujian') {
      upd = { ...upd, statusPembayaran: 'Lunas', paymentStatus: 'verified' };
    } else {
      upd.sem3_paymentStatus = 'verified';
      if (p.stage === 'cicilan1') {
        upd.sem3_status = 'cicilan1_lunas';
        upd.sem3_cycle_start = TS.fromMillis(now);
        upd.sem3_cicilan2_due = TS.fromMillis(now + CICILAN2_HARI * 864e5);
      } else {
        upd.sem3_status = 'lunas';
        if (!u.sem3_cycle_start) upd.sem3_cycle_start = TS.fromMillis(now);
      }
    }
    t.update(pRef, { status: 'paid', paidAt: FV.serverTimestamp() });
    t.update(uRef, upd);
  });
  res.json({ ok: true });
}

/* ===== router ===== */
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const raw = await readRaw(req);
    const action = new URL(req.url, 'http://x').searchParams.get('action');
    if (action === 'create') return await handleCreate(req, res, raw);
    if (action === 'webhook') return await handleWebhook(req, res, raw);
    res.status(400).json({ error: 'action tidak dikenal' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'internal' });
  }
};
module.exports.config = { api: { bodyParser: false } };
