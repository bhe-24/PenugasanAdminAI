// api/event-config.js
// Versi publik dari action "config" di instagram-publish.js.
// Hanya mengirim cloudName + uploadPreset (unsigned), yang memang sudah terlihat di browser admin saat unggah.
// TIDAK mengirim token Instagram, API secret, atau variabel rahasia lain.

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Gunakan metode GET.' });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    return res.status(500).json({ error: 'Variabel Cloudinary belum lengkap di Vercel.' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ cloudName, uploadPreset });
}
