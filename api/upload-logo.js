/**
 * POST /api/upload-logo
 * Body: { base64: "data:image/png;base64,...", tenantId: "uuid", ext: "png" }
 * Uploads logo to Supabase Storage using service role key (bypasses RLS)
 */
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { base64, tenantId, ext = 'png', mimeType = 'image/png' } = req.body || {};
    if (!base64) return res.status(400).json({ success: false, error: 'No file data provided' });

    // Strip data URL prefix if present
    const b64data = base64.includes(',') ? base64.split(',')[1] : base64;
    const fileBuffer = Buffer.from(b64data, 'base64');

    // Limit 2MB
    if (fileBuffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'El logo debe ser menor a 2MB' });
    }

    const path = `logos/${tenantId || 'unknown'}-${Date.now()}.${ext}`;

    const uploadRes = await fetch(`${SB_URL}/storage/v1/object/uploads/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Storage error: ${uploadRes.status} ${err}`);
    }

    const publicUrl = `${SB_URL}/storage/v1/object/public/uploads/${path}`;
    return res.status(200).json({ success: true, url: publicUrl });

  } catch (e) {
    console.error('upload-logo error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
