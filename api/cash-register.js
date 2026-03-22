import { sendResendEmail } from '../lib/server/resend.js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';
const DEFAULT_LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";

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

async function sbGet(table, filter, select = '*') {
  const rows = await sbSelect(table, filter, select).catch(() => []);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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

async function sbPatch(table, filter, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbH(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.status);
    throw new Error(`PATCH ${table}: ${text}`);
  }
  return res.json();
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function normalizeOrderUpdateChanges(changes = {}) {
  if (!changes || typeof changes !== 'object') return {};

  const normalized = { ...changes };

  if (normalized.total_paid != null && normalized.amount_paid == null) {
    normalized.amount_paid = normalized.total_paid;
  }
  if (normalized.balance != null && normalized.balance_due == null) {
    normalized.balance_due = normalized.balance;
  }

  delete normalized.total_paid;
  delete normalized.balance;

  const allowedKeys = new Set([
    'amount_paid',
    'balance_due',
    'paid',
    'deposit_amount',
    'total',
    'subtotal',
    'tax_amount',
    'discount_amount',
    'discount_type',
    'discount_value',
    'pos_discount_value',
    'pos_discount_type',
    'pos_discount_applied_total',
    'tenant_id',
    'updated_date',
    'status',
  ]);

  return Object.fromEntries(
    Object.entries(normalized).filter(([key]) => allowedKeys.has(key))
  );
}

async function sendCashRegisterEmail({ type, tenantId, drawer, performedBy, difference = null, expectedCash = null, partsCost = null, realProfit = null, moneyToSetAside = null }) {
  if (!tenantId) return;

  const [tenant, mainSettings, brandingSettings] = await Promise.all([
    sbGet('tenant', `id=eq.${encodeURIComponent(tenantId)}`, 'id,name,email'),
    sbGet('app_settings', `slug=eq.app-main-settings`, 'payload'),
    sbGet('app_settings', `slug=eq.business-branding`, 'payload'),
  ]).catch(() => [null, null, null]);

  const ownerEmail = tenant?.email;
  if (!ownerEmail) return;

  const businessName = mainSettings?.payload?.business_name || tenant?.name || 'SmartFixOS';
  const logoUrl = brandingSettings?.payload?.logo_url || DEFAULT_LOGO_URL;
  const isOpening = type === 'opening';
  const subject = isOpening
    ? `🔓 Caja abierta — ${businessName}`
    : `🔒 Caja cerrada — ${businessName}`;
  const actionText = isOpening ? 'abrió' : 'cerró';
  const performedName = performedBy?.full_name || performedBy?.userName || performedBy?.email || 'Sistema';

  const detailsHtml = isOpening
    ? `
      <div style="background:#F0FDF4;border:2px solid #10B981;border-radius:16px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;color:#065F46;font-size:18px;font-weight:800;">Apertura de caja</p>
        <p style="margin:0;color:#047857;font-size:15px;">Monto inicial: <strong>$${formatMoney(drawer?.opening_balance)}</strong></p>
      </div>
    `
    : `
      <div style="background:#FEF2F2;border:2px solid #EF4444;border-radius:16px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;color:#991B1B;font-size:18px;font-weight:800;">Cierre de caja</p>
        <p style="margin:0;color:#7F1D1D;font-size:15px;">Total contado: <strong>$${formatMoney(drawer?.closing_balance)}</strong></p>
        <p style="margin:8px 0 0;color:#7F1D1D;font-size:15px;">Efectivo esperado: <strong>$${formatMoney(expectedCash)}</strong></p>
        <p style="margin:8px 0 0;color:#7F1D1D;font-size:15px;">Diferencia: <strong>$${formatMoney(difference)}</strong></p>
      </div>

      <div style="background:#F3F4F6;border:2px solid #D1D5DB;border-radius:16px;padding:20px;margin:24px 0;">
        <p style="margin:0 0 8px;color:#374151;font-size:18px;font-weight:800;">Resumen Financiero Real</p>
        <p style="margin:0;color:#4B5563;font-size:15px;">Entrada Bruta: <strong>$${formatMoney(drawer?.total_revenue)}</strong></p>
        <p style="margin:8px 0 0;color:#4B5563;font-size:15px;">Costo de Piezas: <strong>$${formatMoney(partsCost)}</strong></p>
        <p style="margin:8px 0 0;color:#4B5563;font-size:15px;">Ganancia Real Neta: <strong>$${formatMoney(realProfit)}</strong></p>
        <p style="margin:8px 0 0;color:#4B5563;font-size:15px;">Apartado para Gastos Fijos: <strong>$${formatMoney(moneyToSetAside)}</strong></p>
      </div>
    `;

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
    <div style="background:${isOpening ? 'linear-gradient(135deg,#10B981 0%,#059669 100%)' : 'linear-gradient(135deg,#EF4444 0%,#DC2626 100%)'};padding:32px;text-align:center;">
      <img src="${logoUrl}" alt="${businessName}" style="height:56px;width:auto;margin:0 auto 16px;display:block;" />
      <h1 style="margin:0;color:white;font-size:26px;font-weight:800;">${isOpening ? '🔓 Caja Abierta' : '🔒 Caja Cerrada'}</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0;color:#111827;font-size:16px;line-height:1.7;">
        El usuario <strong>${performedName}</strong> ${actionText} la caja el ${new Date().toLocaleString('es-PR')}.
      </p>
      ${detailsHtml}
      <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.6;">
        Notificación automática de SmartFixOS.
      </p>
    </div>
  </div>`;

  await sendResendEmail({
    to: ownerEmail,
    subject,
    html,
    fromName: 'SmartFixOS',
    fromEmail: FROM_EMAIL,
  });
}

async function handleOpen(req, res, body) {
  const { denominations = {}, user = {}, tenantId = null } = body || {};
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
    console.warn('cash-register open movement warning:', movementError.message);
  }

  try {
    await sendCashRegisterEmail({
      type: 'opening',
      tenantId,
      drawer,
      performedBy: user,
    });
  } catch (emailError) {
    console.warn('cash-register open email warning:', emailError.message);
  }

  return res.status(200).json({ success: true, drawer });
}

async function handleClose(req, res, body) {
  const { drawerId, denominations = {}, user = {}, summary = {}, tenantId = null } = body || {};
  if (!drawerId) return res.status(400).json({ success: false, error: 'drawerId es requerido' });

  const countedTotal = calculateTotal(denominations);
  const totalRevenue = Number(summary?.totalRevenue || 0);
  const partsCost = Number(summary?.partsCost || 0);
  const realProfit = Number(summary?.realProfit || 0);
  const moneyToSetAside = Number(summary?.moneyToSetAside || 0);
  const expectedCash = Number(summary?.expectedCash || 0);
  const difference = countedTotal - expectedCash;
  const closedBy = user?.full_name || user?.userName || user?.email || 'Sistema';
  const createdById = user?.id || user?.userId || 'system';
  const createdBy = user?.email || user?.userEmail || closedBy;

  const [drawer] = await sbPatch(
    'cash_register',
    `id=eq.${encodeURIComponent(drawerId)}`,
    {
      status: 'closed',
      closing_balance: countedTotal,
      total_revenue: totalRevenue,
      net_profit: realProfit > 0 ? realProfit : totalRevenue,
      closed_by: closedBy,
      final_count: {
        denominations,
        total: countedTotal,
        expectedCash,
        difference,
        overrides: summary,
      },
    }
  );

  try {
    await sbInsert('cash_drawer_movement', {
      drawer_id: drawerId,
      type: 'closing',
      amount: countedTotal,
      description: `Cierre de caja - $${countedTotal.toFixed(2)} (Diferencia: $${difference.toFixed(2)})`,
      employee: closedBy,
      denominations,
      created_by_id: createdById,
      created_by: createdBy,
      tenant_id: tenantId,
    });
  } catch (movementError) {
    console.warn('cash-register close movement warning:', movementError.message);
  }

  try {
    await sendCashRegisterEmail({
      type: 'closing',
      tenantId,
      drawer,
      performedBy: user,
      difference,
      expectedCash,
      partsCost,
      realProfit,
      moneyToSetAside,
    });
  } catch (emailError) {
    console.warn('cash-register close email warning:', emailError.message);
  }

  return res.status(200).json({ success: true, drawer, difference });
}

async function handleRecordSale(req, res, body) {
  const { sale, transactions = [], orderUpdate = null } = body || {};

  if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
    return res.status(400).json({ success: false, error: 'Payload de venta inválido' });
  }

  const createdSaleRows = await sbInsert('sale', sale);
  const createdSale = Array.isArray(createdSaleRows) ? createdSaleRows[0] : createdSaleRows;

  const createdTransactions = [];
  for (const tx of transactions) {
    const createdTxRows = await sbInsert('transaction', tx);
    createdTransactions.push(Array.isArray(createdTxRows) ? createdTxRows[0] : createdTxRows);
  }

  let updatedOrder = null;
  if (orderUpdate?.id && orderUpdate?.changes && typeof orderUpdate.changes === 'object') {
    const safeChanges = {
      ...normalizeOrderUpdateChanges(orderUpdate.changes),
      updated_date: new Date().toISOString(),
    };
    const updatedOrderRows = await sbPatch(
      'order',
      `id=eq.${encodeURIComponent(orderUpdate.id)}`,
      safeChanges
    );
    updatedOrder = Array.isArray(updatedOrderRows) ? updatedOrderRows[0] : updatedOrderRows;
  }

  return res.status(200).json({
    success: true,
    sale: createdSale,
    transactions: createdTransactions,
    order: updatedOrder,
  });
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
    const body = req.body || {};
    const action = String(body?.action || '').toLowerCase();
    if (action === 'open') return await handleOpen(req, res, body);
    if (action === 'close') return await handleClose(req, res, body);
    if (action === 'record_sale') return await handleRecordSale(req, res, body);
    return res.status(400).json({ success: false, error: 'Acción inválida' });
  } catch (error) {
    console.error('cash-register error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
