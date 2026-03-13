/**
 * POST /api/send-raw-email
 * Sends a raw HTML email via Resend.
 * Used by base44.integrations.Core.SendEmail() and any component
 * that needs to send a pre-built HTML email.
 *
 * Body: {
 *   to:         string | string[],   recipient(s)
 *   subject:    string,              email subject
 *   body:       string,              HTML body (alias: html)
 *   html:       string,              HTML body (alias: body)
 *   from_name:  string,              sender display name (optional)
 * }
 */

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  if (!RESEND_KEY) return res.status(500).json({ success: false, error: 'Email service not configured' });

  const { to, subject, body, html, from_name } = req.body || {};
  const htmlContent = html || body;

  if (!to)          return res.status(400).json({ success: false, error: 'to es requerido' });
  if (!subject)     return res.status(400).json({ success: false, error: 'subject es requerido' });
  if (!htmlContent) return res.status(400).json({ success: false, error: 'body/html es requerido' });

  const recipients = Array.isArray(to) ? to : [to];
  const fromLabel  = from_name ? `${from_name} <${FROM_EMAIL}>` : `SmartFixOS <${FROM_EMAIL}>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    fromLabel,
        to:      recipients,
        subject,
        html:    htmlContent,
      }),
    });

    if (emailRes.ok) {
      const data = await emailRes.json();
      console.log(`✅ Raw email sent to ${recipients.join(', ')} — "${subject}"`);
      return res.status(200).json({ success: true, id: data.id });
    } else {
      const err = await emailRes.text().catch(() => emailRes.status);
      console.error('Resend error:', err);
      return res.status(200).json({ success: false, error: String(err) });
    }
  } catch (e) {
    console.error('send-raw-email error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
