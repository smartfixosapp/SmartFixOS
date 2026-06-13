import crypto from 'crypto';
import http2 from 'http2';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const APNS_KEY_ID = process.env.APNS_KEY_ID;
const APNS_TEAM_ID = process.env.APNS_TEAM_ID;
const APNS_AUTH_KEY = process.env.APNS_AUTH_KEY;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.archillastudios.SmartFixOS';

function sbH() {
  return { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function apnsJWT() {
  const header = { alg: 'ES256', kid: APNS_KEY_ID };
  const payload = { iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: APNS_AUTH_KEY,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${sig.toString('base64url')}`;
}

function sendOne(token, isSandbox, jwt, payload) {
  return new Promise((resolve) => {
    const host = isSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const client = http2.connect(`https://${host}`);
    client.on('error', (e) => resolve({ token, status: 0, body: String(e) }));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (d) => { body += d; });
    req.on('end', () => { try { client.close(); } catch (_) {} resolve({ token, status, body }); });
    req.on('error', (e) => { try { client.close(); } catch (_) {} resolve({ token, status: 0, body: String(e) }); });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const orderId = String(body.orderId || '').trim();
    const tenantId = String(body.tenantId || '').trim();
    if (!orderId || !tenantId) { res.status(400).json({ error: 'missing_params' }); return; }

    if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
      res.status(200).json({ sent: 0, reason: 'apns_not_configured' });
      return;
    }

    const ordRes = await fetch(
      `${SB_URL}/rest/v1/order?id=eq.${orderId}&tenant_id=eq.${tenantId}&select=order_number,customer_name,customer_approval_status`,
      { headers: sbH() }
    );
    const orders = await ordRes.json().catch(() => []);
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) { res.status(404).json({ error: 'order_not_found' }); return; }

    const decision = String(order.customer_approval_status || '').toLowerCase();
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(200).json({ sent: 0, reason: 'not_decided' });
      return;
    }

    const tokRes = await fetch(
      `${SB_URL}/rest/v1/device_token?tenant_id=eq.${tenantId}&platform=eq.ios&notifications_enabled=eq.true&select=token,is_sandbox`,
      { headers: sbH() }
    );
    const tokens = await tokRes.json().catch(() => []);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      res.status(200).json({ sent: 0, reason: 'no_tokens' });
      return;
    }

    const num = order.order_number || 'Orden';
    const decided = decision === 'approved' ? 'aprobó' : 'rechazó';
    const payload = {
      aps: {
        alert: { title: `Cliente ${decided} la cotización`, body: `${num} · toca para ver los detalles` },
        sound: 'default',
        badge: 1,
      },
      order_id: orderId,
      kind: 'customer_approval',
    };

    const jwt = apnsJWT();
    const results = await Promise.all(
      tokens.map((t) => sendOne(t.token, !!t.is_sandbox, jwt, payload))
    );
    const sent = results.filter((r) => r.status === 200).length;

    res.status(200).json({ sent, total: tokens.length });
  } catch (e) {
    res.status(500).json({ error: 'internal', detail: String(e && e.message ? e.message : e) });
  }
}
