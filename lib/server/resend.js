const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';
const DEFAULT_FROM_NAME = process.env.FROM_NAME || 'SmartFixOS';

export function ensureResendConfigured() {
  if (!RESEND_KEY) {
    throw new Error('Email service not configured');
  }
}

export async function sendResendEmail({
  to,
  subject,
  html,
  fromName = DEFAULT_FROM_NAME,
  fromEmail = FROM_EMAIL,
  replyTo = null,
}) {
  ensureResendConfigured();

  const recipients = Array.isArray(to) ? to : [to];
  if (!recipients.length) throw new Error('Recipient is required');
  if (!subject) throw new Error('Subject is required');
  if (!html) throw new Error('HTML body is required');

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: recipients,
    subject,
    html,
  };

  if (replyTo) {
    payload.reply_to = Array.isArray(replyTo) ? replyTo : [replyTo];
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text().catch(() => emailRes.status);
    throw new Error(`Resend error: ${err}`);
  }

  return emailRes.json();
}
