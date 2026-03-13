const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbH(prefer = 'return=representation') {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Prefer': prefer,
  };
}

function calculateTotal(denominations = {}) {
  return Object.entries(denominations).reduce((sum, [key, qty]) => {
    const value = parseFloat(
      String(key)
        .replace('bills_', '')
        .replace('coins_', '')
        .replace('050', '0.50')
        .replace('025', '0.25')
        .replace('010', '0.10')
        .replace('005', '0.05')
        .replace('001', '0.01')
    );
    return sum + ((Number(qty) || 0) * (Number.isFinite(value) ? value : 0));
  }, 0);
}

async function sbSelect(table, filter, select = '*') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=${select}`, {
    headers: sbH(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`SELECT ${table}: ${text}`);
  }
  return res.json();
}

async function sbInsert(table, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbH(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`INSERT ${table}: ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!SB_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

  try {
    const { denominations = {}, user = {}, tenantId = null } = req.body || {};
    const total = calculateTotal(denominations);
    const date = new Date().toISOString().split('T')[0];
    const openedBy = user?.full_name || user?.userName || user?.email || 'Sistema';
    const createdById = user?.id || user?.userId || 'system';
    const createdBy = user?.email || user?.userEmail || openedBy;

    const filter = tenantId
      ? `status=eq.open&tenant_id=eq.${encodeURIComponent(tenantId)}`
      : `status=eq.open&tenant_id=is.null`;
    const existing = await sbSelect('cash_register', filter, 'id').catch(() => []);
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe una caja abierta' });
    }

    const [drawer] = await sbInsert('cash_register', {
      date,
      opening_balance: total,
      status: 'open',
      opened_by: openedBy,
      final_count: { denominations, total },
      created_by_id: createdById,
      created_by: createdBy,
      tenant_id: tenantId,
    });

    try {
      await sbInsert('cash_drawer_movement', {
        drawer_id: drawer.id,
        type: 'opening',
        amount: total,
        description: `Apertura de caja - $${total.toFixed(2)}`,
        employee: openedBy,
        denominations,
        created_by_id: createdById,
        created_by: createdBy,
        tenant_id: tenantId,
      });
    } catch (movementError) {
      console.warn('open-cash-register movement warning:', movementError.message);
    }

    return res.status(200).json({ success: true, drawer });
  } catch (error) {
    console.error('open-cash-register error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
