// Email sending function with support for multiple providers
// Supports: Resend, Mailjet, and Mailgun

/**
 * Send email using Resend
 */
async function sendWithResend({ to, subject, body, from_name, from_email }) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  const fromEmail = from_email || Deno.env.get('FROM_EMAIL') || 'noreply@yourdomain.com';
  const fromName = from_name || Deno.env.get('FROM_NAME') || 'Peace Adventures';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: subject,
      html: body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    status: 'sent',
    message_id: data.id,
    provider: 'resend',
  };
}

/**
 * Send email using Mailjet
 */
async function sendWithMailjet({ to, subject, body, from_name, from_email }) {
  const mailjetApiKeyPublic = Deno.env.get('MJ_APIKEY_PUBLIC');
  const mailjetApiKeyPrivate = Deno.env.get('MJ_APIKEY_PRIVATE');
  
  if (!mailjetApiKeyPublic || !mailjetApiKeyPrivate) {
    throw new Error('MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE environment variables are required');
  }

  const fromEmail = from_email || Deno.env.get('FROM_EMAIL') || 'pilot@mailjet.com';
  const fromName = from_name || Deno.env.get('FROM_NAME') || 'Mailjet Pilot';

  // Create basic auth header
  const credentials = btoa(`${mailjetApiKeyPublic}:${mailjetApiKeyPrivate}`);

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: fromName,
          },
          To: [
            {
              Email: to,
              Name: to.split('@')[0], // Use email prefix as name
            },
          ],
          Subject: subject,
          HTMLPart: body,
          TextPart: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mailjet API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    status: 'sent',
    message_id: data.Messages?.[0]?.To?.[0]?.MessageID || data.Messages?.[0]?.To?.[0]?.MessageUUID || `mailjet_${Date.now()}`,
    provider: 'mailjet',
  };
}

/**
 * Send email using Mailgun
 */
async function sendWithMailgun({ to, subject, body, from_name, from_email }) {
  const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
  const mailgunDomain = Deno.env.get('MAILGUN_DOMAIN');
  
  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables are required');
  }

  const fromEmail = from_email || Deno.env.get('FROM_EMAIL') || `postmaster@${mailgunDomain}`;
  const fromName = from_name || Deno.env.get('FROM_NAME') || 'Mailgun Sandbox';

  // Create basic auth header (username is always 'api')
  const credentials = btoa(`api:${mailgunApiKey}`);

  // Determine API endpoint (EU vs US)
  const mailgunUrl = Deno.env.get('MAILGUN_URL') || `https://api.mailgun.net/v3/${mailgunDomain}/messages`;

  const formData = new FormData();
  formData.append('from', `${fromName} <${fromEmail}>`);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', body);
  formData.append('text', body.replace(/<[^>]*>/g, '')); // Strip HTML for text version

  const response = await fetch(mailgunUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mailgun API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    status: 'sent',
    message_id: data.id || `mailgun_${Date.now()}`,
    provider: 'mailgun',
  };
}

/**
 * Main handler for sendEmail function
 */
export async function sendEmailInternalHandler(req) {
  console.log('📧 /sendEmailInternal endpoint called');

  try {
    const payload = await req.json();
    console.log(`📨 Received email request:`, {
      to: payload.to,
      subject: payload.subject,
      provider: payload.provider || 'default',
    });

    const { to, subject, body, from_name, from_email, provider = 'resend' } = payload;

    // Validate required fields
    if (!to || !subject || !body) {
      return Response.json(
        { error: 'Missing required fields: to, subject, and body are required' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['resend', 'mailjet', 'mailgun'];
    if (!validProviders.includes(provider.toLowerCase())) {
      return Response.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    let result;
    const providerLower = provider.toLowerCase();

    try {
      switch (providerLower) {
        case 'resend':
          result = await sendWithResend({ to, subject, body, from_name, from_email });
          break;
        case 'mailjet':
          result = await sendWithMailjet({ to, subject, body, from_name, from_email });
          break;
        case 'mailgun':
          result = await sendWithMailgun({ to, subject, body, from_name, from_email });
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      console.log(`✅ Email sent successfully via ${providerLower}:`, result.message_id);
      return Response.json(result);
    } catch (providerError) {
      console.error(`❌ Error sending email via ${providerLower}:`, providerError);
      return Response.json(
        { 
          error: `Failed to send email via ${providerLower}: ${providerError.message}`,
          provider: providerLower,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('💥 Unexpected error in sendEmail:', error);
    return Response.json(
      { error: `Email sending failed: ${error.message}` },
      { status: 500 }
    );
  }
}
