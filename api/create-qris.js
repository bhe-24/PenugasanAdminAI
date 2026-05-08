import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    // Menerima data dari frontend
    const { paymentAmount, productDetails, customerDetail, uid } = req.body;

    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;
    
    // Gunakan URL Production jika sudah live, atau Sandbox jika masih testing
    const duitkuUrl = 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'; 

    // PENTING: Kita selipkan UID siswa ke dalam Order ID agar saat Duitku 
    // mengirim Callback, kita tahu siapa yang bayar. Format: UID-Timestamp
    const merchantOrderId = `${uid}-${Date.now()}`;

    const signatureString = merchantCode + merchantOrderId + paymentAmount + apiKey;
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    const payload = {
        merchantCode: merchantCode,
        paymentAmount: paymentAmount,
        paymentMethod: 'SP', // SP = ShopeePay / QRIS
        merchantOrderId: merchantOrderId,
        productDetails: productDetails,
        additionalParam: '',
        merchantUserInfo: '',
        customerVaName: customerDetail.name,
        email: customerDetail.email,
        phoneNumber: customerDetail.phone,
        itemDetails: [{ name: productDetails, price: paymentAmount, quantity: 1 }],
        callbackUrl: 'https://cendekia-aksara.vercel.app/api/callback', // <--- Callback ke domainmu
        returnUrl: 'https://cendekia-aksara.vercel.app/dashboard/index.html',
        signature: signature,
        expiryPeriod: 60 // 60 menit expired
    };

    try {
        const response = await fetch(duitkuUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.statusCode === '00') {
            res.status(200).json({ success: true, qrString: data.qrString });
        } else {
            res.status(400).json({ success: false, message: data.statusMessage });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
