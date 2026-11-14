/* SATU FILE untuk seluruh sistem QRIS Kaskuy (serverless function).
   POST /api/qris?action=create            -> dipanggil keuangan / payment.html (siswa login)
   POST /api/qris?action=check             -> dipanggil keuangan / payment.html
   POST /api/qris?action=create-checkout   -> dipanggil payment-checkout.html (pembayaran paket checkout)
   POST /api/qris?action=check-checkout    -> dipanggil payment-checkout.html (polling verifikasi checkout)
   POST /api/qris?action=webhook           -> didaftarkan di dashboard Kaskuy */
import crypto from 'crypto';
import admin from 'firebase-admin';

let db = null;
let TS = null, FV = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    db = admin.firestore();
    TS = admin.firestore.Timestamp;
    FV = admin.firestore.FieldValue;
  }
} catch (e) {
  console.warn('Firebase admin init warning:', e.message);
}

const BIAYA_LUNAS = 75450, BIAYA_CICILAN = 37725, DENDA = 0.10, MINGGU = 7 * 864e5;
const CICILAN2_HARI = 30; // ASUMSI: jatuh tempo cicilan 2 = 30 hari setelah cicilan 1.

/* ===== ADAPTER KASKUY (API v1) ===== */
const GW_BASE = (process.env.KASKUY_BASE_URL || 'https://qris.kaskuy.com/api/v1').replace(/\/$/, '');

async function gw(path, opt = {}) {
  const r = await fetch(GW_BASE + path, {
    ...opt,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.KASKUY_API_KEY}`, ...(opt.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error((j.error && j.error.message) || `Gateway error ${r.status}`);
  return j.data;
}

// POST /payments  (Idempotency-Key wajib; invoice unik per merchant)
async function gwCreate({ orderId, amount, description }) {
  const d = await gw('/payments', {
    method: 'POST',
    headers: { 'Idempotency-Key': orderId },
    body: JSON.stringify({ invoice: orderId, amount, description, expires_in: 1800 }), // 30 menit
  });
  return {
    gatewayId: d.payment_id,
    qrString: d.qr_string || null,
    qrImage: d.qr_url || null,
    amount: Number(d.total_amount),                  // sudah termasuk kode unik dari gateway
    expiresAtMs: new Date(d.expires_at).getTime(),
  };
}

// GET /payments/{payment_id}  -> PENDING | PAID | EXPIRED | FAILED
async function gwStatus(paymentId) {
  const d = await gw('/payments/' + encodeURIComponent(paymentId));
  return { status: d.status, paid: d.status === 'PAID', amount: Number(d.total_amount) };
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

/* ===== action: create (Untuk Siswa Terdaftar / payment.html) ===== */
async function handleCreate(req, res, raw) {
  if (!db) return res.status(500).json({ error: 'Database belum dikonfigurasi' });
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
  let inv;
  if (process.env.KASKUY_API_KEY) {
    inv = await gwCreate({ orderId, amount, description: label });
  } else {
    // Fallback simulasi kode unik jika API KEY gateway belum diisi
    const uniqueCode = Math.floor(100 + Math.random() * 899);
    const totalAmount = amount + uniqueCode;
    inv = {
      gatewayId: 'SIM-' + Date.now(),
      qrString: `00020101021226670016ID.CO.QRIS.WWW01189360099800000000000215CA${Date.now().toString().slice(-8)}52045812530336054${String(totalAmount).length.toString().padStart(2, '0')}${totalAmount}5802ID5915CENDEKIA AKSARA6010TEMANGGUNG61055625262190115${orderId}6304ABCD`,
      qrImage: null,
      amount: totalAmount,
      expiresAtMs: Date.now() + 1800 * 1000
    };
  }

  const rec = { orderId, gatewayId: inv.gatewayId, stage, baseAmount: amount, amount: inv.amount,
                qrImage: inv.qrImage, qrString: inv.qrString, expiresAtMs: inv.expiresAtMs, label };

  await db.doc('payments/' + orderId).set({ uid, ...rec, status: 'pending', createdAt: FV.serverTimestamp() });
  await ref.update(sem >= 3
    ? { pendingInvoice: rec, sem3_paymentStatus: 'waiting', sem3_pendingAmount: inv.amount, sem3_pendingStage: stage }
    : { pendingInvoice: rec, paymentStatus: 'waiting', pendingAmount: inv.amount });

  res.json({ label, amount: inv.amount, qrImage: inv.qrImage, qrString: inv.qrString, expiresAtMs: inv.expiresAtMs });
}

/* ===== action: create-checkout (Untuk Form Checkout Siswa Baru / payment-checkout.html) ===== */
async function handleCreateCheckout(req, res, raw) {
  const body = JSON.parse(raw || '{}');
  const baseAmount = parseInt(body.amount) || 5000;
  const packageName = body.packageName || 'Paket Belajar Literasi';
  const userName = body.userName || 'Siswa Cendekia';
  const userEmail = body.userEmail || 'siswa@cendekia.id';
  const userPhone = body.userPhone || '-';
  const orderId = body.orderId || `CHK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 899)}`;

  let inv;
  let uniqueCode = 0;

  if (process.env.KASKUY_API_KEY) {
    try {
      inv = await gwCreate({ orderId, amount: baseAmount, description: `Cendekia: ${packageName}` });
      uniqueCode = Math.max(0, inv.amount - baseAmount);
    } catch (gwErr) {
      console.warn('Gateway create failed, using dynamic local QRIS:', gwErr.message);
      uniqueCode = Math.floor(100 + Math.random() * 899);
      const totalAmount = baseAmount + uniqueCode;
      inv = {
        gatewayId: 'SIM-' + Date.now(),
        qrString: `00020101021226670016ID.CO.QRIS.WWW01189360099800000000000215CA${Date.now().toString().slice(-8)}52045812530336054${String(totalAmount).length.toString().padStart(2, '0')}${totalAmount}5802ID5915CENDEKIA AKSARA6010TEMANGGUNG61055625262190115${orderId.replace(/[^a-zA-Z0-9]/g, '')}6304ABCD`,
        qrImage: null,
        amount: totalAmount,
        expiresAtMs: Date.now() + 15 * 60 * 1000
      };
    }
  } else {
    // Generate 3 digit unique code
    uniqueCode = Math.floor(100 + Math.random() * 899);
    const totalAmount = baseAmount + uniqueCode;
    inv = {
      gatewayId: 'SIM-' + Date.now(),
      qrString: `00020101021226670016ID.CO.QRIS.WWW01189360099800000000000215CA${Date.now().toString().slice(-8)}52045812530336054${String(totalAmount).length.toString().padStart(2, '0')}${totalAmount}5802ID5915CENDEKIA AKSARA6010TEMANGGUNG61055625262190115${orderId.replace(/[^a-zA-Z0-9]/g, '')}6304ABCD`,
      qrImage: null,
      amount: totalAmount,
      expiresAtMs: Date.now() + 15 * 60 * 1000
    };
  }

  const record = {
    orderId,
    gatewayId: inv.gatewayId,
    baseAmount,
    uniqueCode,
    amount: inv.amount,
    qrImage: inv.qrImage,
    qrString: inv.qrString,
    expiresAtMs: inv.expiresAtMs,
    packageName,
    userName,
    userEmail,
    userPhone,
    status: 'pending',
    createdAt: FV ? FV.serverTimestamp() : new Date()
  };

  if (db) {
    try {
      await db.doc('checkout_orders/' + orderId).set(record);
    } catch(err) {
      console.warn('Firestore write checkout_orders warning:', err.message);
    }
  }

  res.json({
    ok: true,
    orderId,
    gatewayId: inv.gatewayId,
    baseAmount,
    uniqueCode,
    totalAmount: inv.amount,
    amount: inv.amount,
    qrImage: inv.qrImage,
    qrString: inv.qrString,
    expiresAtMs: inv.expiresAtMs,
    label: packageName
  });
}

/* ===== action: check-checkout (Polling otomatis / manual cek checkout) ===== */
async function handleCheckCheckout(req, res, raw) {
  const body = JSON.parse(raw || '{}');
  const urlObj = new URL(req.url, 'http://x');
  const orderId = body.orderId || urlObj.searchParams.get('orderId');

  if (!orderId) return res.status(400).json({ error: 'orderId wajib' });

  if (db) {
    try {
      const snap = await db.doc('checkout_orders/' + orderId).get();
      if (snap.exists) {
        const order = snap.data();
        if (order.status === 'paid') return res.json({ paid: true, status: 'paid', amount: order.amount });

        if (order.gatewayId && process.env.KASKUY_API_KEY && !order.gatewayId.startsWith('SIM-')) {
          const st = await gwStatus(order.gatewayId);
          if (st.paid) {
            await db.doc('checkout_orders/' + orderId).update({
              status: 'paid',
              paidAt: FV ? FV.serverTimestamp() : new Date()
            });
            return res.json({ paid: true, status: 'PAID', amount: order.amount });
          }
          return res.json({ paid: false, status: st.status });
        }
      }
    } catch(e) {
      console.warn('Check checkout firestore err:', e.message);
    }
  }

  return res.json({ paid: false, status: 'pending' });
}

/* ===== settle: tandai lunas (idempoten, selalu konfirmasi ke gateway) ===== */
async function settle(orderId) {
  if (!db) return { error: 'Database belum aktif', code: 500 };
  const pRef = db.doc('payments/' + orderId);
  const p = (await pRef.get()).data();
  if (!p) {
    // Periksa apakah ini checkout order
    const cRef = db.doc('checkout_orders/' + orderId);
    const c = (await cRef.get()).data();
    if (c) {
      if (c.status === 'paid') return { paid: true };
      if (c.gatewayId && process.env.KASKUY_API_KEY && !c.gatewayId.startsWith('SIM-')) {
        const st = await gwStatus(c.gatewayId);
        if (st.paid) {
          await cRef.update({ status: 'paid', paidAt: FV.serverTimestamp() });
          return { paid: true };
        }
      }
      return { paid: false };
    }
    return { error: 'order tidak dikenal', code: 404 };
  }

  if (p.status === 'paid') return { paid: true };

  const st = await gwStatus(p.gatewayId);
  if (!st.paid || (Number.isFinite(st.amount) && st.amount !== p.amount)) return { paid: false, status: st.status };

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
  return { paid: true };
}

/* ===== action: webhook (dipanggil Kaskuy) ===== */
async function handleWebhook(req, res, raw) {
  const secret = process.env.KASKUY_WEBHOOK_SECRET;
  if (secret) {
    const sig = String(req.headers['x-signature'] || '');
    const exp = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp)))
      return res.status(401).json({ error: 'bad signature' });
  }
  const body = JSON.parse(raw || '{}');
  const d = body.data || body;
  let orderId = d.invoice || d.order_id;
  if (!orderId && d.payment_id && db) {
    const q = await db.collection('payments').where('gatewayId', '==', d.payment_id).limit(1).get();
    if (!q.empty) orderId = q.docs[0].id;
    else {
      const q2 = await db.collection('checkout_orders').where('gatewayId', '==', d.payment_id).limit(1).get();
      if (!q2.empty) orderId = q2.docs[0].id;
    }
  }
  if (!orderId) return res.status(400).json({ error: 'invoice/payment_id kosong' });
  const r = await settle(orderId);
  if (r.error) return res.status(r.code).json({ error: r.error });
  res.json({ ok: true });
}

/* ===== action: check (dipanggil halaman tiap 10 dtk sebagai cadangan webhook) ===== */
const lastCheck = new Map();
async function handleCheck(req, res) {
  if (!db) return res.json({ paid: false });
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { uid } = await admin.auth().verifyIdToken(token);
  if (Date.now() - (lastCheck.get(uid) || 0) < 8000) return res.json({ paid: false, throttled: true });
  lastCheck.set(uid, Date.now());
  const u = (await db.doc('users/' + uid).get()).data();
  const p = u && u.pendingInvoice;
  if (!p) return res.json({ paid: false });
  const r = await settle(p.orderId);
  res.json({ paid: !!r.paid, status: r.status || null });
}

/* ===== router ===== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const raw = await readRaw(req);
    const action = new URL(req.url, 'http://x').searchParams.get('action');
    if (action === 'create') return await handleCreate(req, res, raw);
    if (action === 'check') return await handleCheck(req, res);
    if (action === 'create-checkout') return await handleCreateCheckout(req, res, raw);
    if (action === 'check-checkout') return await handleCheckCheckout(req, res, raw);
    if (action === 'webhook') return await handleWebhook(req, res, raw);
    res.status(400).json({ error: 'action tidak dikenal' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'internal' });
  }
}
export const config = { api: { bodyParser: false } };
