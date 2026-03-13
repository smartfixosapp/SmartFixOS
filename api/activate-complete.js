/**
 * POST /api/activate-complete
 * Saves all wizard data and activates the tenant account (uses service role key)
 */
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
};

async function sbPost(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function sbPatch(table, filters, data) {
  const q = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${q}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!SB_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration: missing service key' });
  }

  try {
    const {
      token, employeeId, tenantId, email,
      // Step 1 — Branding
      businessName, slogan, logoUrl, primaryColor,
      // Step 2 — Contact
      phone, whatsapp, address, city, state, zip, website,
      // Step 3 — Policies
      warrantyDays, retentionDays, receiptNote, schedule,
      // Step 4 — Dashboard widgets
      widgets,
      // Step 5 — PIN
      pin,
    } = req.body || {};

    if (!token || !employeeId || !tenantId || !pin) {
      return res.status(400).json({ success: false, error: 'Datos incompletos (token, employeeId, tenantId, pin requeridos)' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PIN debe ser 4 dígitos' });
    }

    // Verify token still valid before saving
    const checkRes = await fetch(
      `${SB_URL}/rest/v1/app_employee?id=eq.${employeeId}&activation_token=eq.${encodeURIComponent(token)}&select=id,status`,
      { headers: sbHeaders }
    );
    const checkRows = await checkRes.json();
    if (!checkRows.length) {
      return res.status(404).json({ success: false, error: 'Token inválido o ya fue usado' });
    }
    if (checkRows[0].status === 'active') {
      return res.status(409).json({ success: false, error: 'Cuenta ya activada' });
    }

    // 1. Save branding + policies to system_config
    const brandingValue = {
      business_name: businessName || '',
      slogan: slogan || '',
      logo_url: logoUrl || '',
      primary_color: primaryColor || '#0891b2',
      secondary_color: '#000000',
      phone: phone || '',
      whatsapp: whatsapp || '',
      address: address || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
      website: website || '',
      email: email || '',
      timezone: 'America/Puerto_Rico',
      tax_rate: 0.115,
      currency: 'USD',
      date_format: 'MM/dd/yyyy',
      warranty_days: warrantyDays || 90,
      retention_days: retentionDays || 30,
      receipt_note: receiptNote || '',
      schedule: schedule || {},
    };

    try {
      await sbPost('system_config', {
        key: 'settings.branding',
        value: JSON.stringify(brandingValue),
        category: 'general',
        description: 'Configuración de branding y negocio',
        tenant_id: tenantId,
      });
    } catch (e) { console.warn('system_config branding:', e.message); }

    // 2. Save dashboard widgets
    try {
      await sbPost('system_config', {
        key: 'settings.dashboard_widgets',
        value: JSON.stringify(widgets || {}),
        category: 'dashboard',
        description: 'Widgets visibles en el dashboard',
        tenant_id: tenantId,
      });
    } catch (e) { console.warn('system_config widgets:', e.message); }

    // 3. Activate app_employee — set PIN, status active, clear token
    await sbPatch('app_employee', { id: employeeId }, {
      pin,
      status: 'active',
      active: true,
      activation_token: null,
      activation_expires_at: null,
    });

    // 4. Update users table
    try {
      await sbPatch('users', { email }, { pin, active: true });
    } catch (e) { console.warn('users patch:', e.message); }

    // 5. Update tenant metadata
    try {
      // Get current metadata first
      const tRes = await fetch(
        `${SB_URL}/rest/v1/tenant?id=eq.${tenantId}&select=metadata,name`,
        { headers: sbHeaders }
      );
      if (tRes.ok) {
        const tRows = await tRes.json();
        const currentMeta = tRows[0]?.metadata || {};
        await sbPatch('tenant', { id: tenantId }, {
          name: businessName || tRows[0]?.name,
          metadata: { ...currentMeta, setup_complete: true },
        });
      }
    } catch (e) { console.warn('tenant patch:', e.message); }

    console.log(`✅ Cuenta activada: ${email} (employee: ${employeeId})`);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('activate-complete error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
