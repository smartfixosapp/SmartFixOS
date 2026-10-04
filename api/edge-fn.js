const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const ALLOWED = new Set(['owner-pin', 'send-owner-push', 'archi-vision']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const name = String(req.query?.name || '');
  if (!ALLOWED.has(name)) {
    return res.status(404).json({ error: 'Unknown function' });
  }

  const apikey = String(req.headers.apikey || SB_ANON || '');
  if (!apikey) {
    return res.status(500).json({ error: 'Missing API key' });
  }

  const headers = { 'Content-Type': 'application/json', apikey };
  const auth = req.headers.authorization;
  if (auth) headers.Authorization = String(auth);

  try {
    const upstream = await fetch(`${SB_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(text);
  } catch {
    return res.status(502).json({ error: 'Upstream unreachable' });
  }
}
