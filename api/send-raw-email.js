import { ensureResendConfigured, sendResendEmail } from '../lib/server/resend.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    ensureResendConfigured();
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  const { to, subject, body, html, from_name } = req.body || {};
  const htmlContent = html || body;

  if (!to)          return res.status(400).json({ success: false, error: 'to es requerido' });
  if (!subject)     return res.status(400).json({ success: false, error: 'subject es requerido' });
  if (!htmlContent) return res.status(400).json({ success: false, error: 'body/html es requerido' });

  try {
    const data = await sendResendEmail({
      to,
      subject,
      html: htmlContent,
      fromName: from_name || 'SmartFixOS',
    });
    console.log(`✅ Raw email sent — "${subject}"`);
    return res.status(200).json({ success: true, id: data.id });
  } catch (e) {
    console.error('send-raw-email error:', e.message);
    return res.status(200).json({ success: false, error: e.message });
  }
}
