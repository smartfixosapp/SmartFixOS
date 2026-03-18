/**
 * processPayroll — Procesamiento de nómina server-side
 * Usa asServiceRole para:
 *  1. Crear EmployeePayment
 *  2. Crear Transaction (expense/payroll)
 *  3. Eliminar TimeEntry del periodo pagado (reset a cero)
 *  4. Enviar recibo por email al empleado
 */

import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

function buildReceiptHtml({ employee_name, employee_email, amount, type, payment_method, period_start, period_end, total_hours, hourly_rate, paid_by_name, paid_at }) {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const fmtAmt = (v) => `$${Number(v || 0).toFixed(2)}`;
  const methodLabel = { cash: "Efectivo", transfer: "Depósito Directo", check: "Cheque", ath_movil: "ATH Móvil" }[payment_method] || payment_method;
  const typeLabel = { salary: "Salario", bonus: "Bono", commission: "Comisión", advance: "Adelanto", other: "Otro" }[type] || type;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Recibo de Pago</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 0 auto; background: #111; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px 32px 24px; }
    .header h1 { margin: 0 0 4px; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; margin-bottom: 24px; color: #d1d5db; }
    .amount-card { background: #1a1a1a; border: 1px solid #10b981/30; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px; }
    .amount-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #6b7280; margin-bottom: 8px; }
    .amount-value { font-size: 48px; font-weight: 900; color: #10b981; letter-spacing: -2px; }
    .detail-grid { border-radius: 12px; border: 1px solid #222; overflow: hidden; margin-bottom: 24px; }
    .detail-row { display: flex; padding: 12px 16px; border-bottom: 1px solid #1a1a1a; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row.alt { background: #0d0d0d; }
    .detail-label { flex: 1; font-size: 12px; color: #6b7280; font-weight: 600; }
    .detail-value { font-size: 12px; font-weight: 700; color: #e5e7eb; }
    .footer { padding: 20px 32px; background: #0d0d0d; text-align: center; }
    .footer p { font-size: 11px; color: #4b5563; margin: 4px 0; }
    .badge { display: inline-block; background: #10b981/20; color: #10b981; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; border: 1px solid #10b98133; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>💳 Recibo de Pago</h1>
      <p>SmartFixOS · Sistema de Gestión</p>
    </div>
    <div class="body">
      <div class="badge">✅ Pago Confirmado</div>
      <p class="greeting">Hola <strong>${employee_name}</strong>, este es tu recibo de pago correspondiente al periodo indicado.</p>

      <div class="amount-card">
        <div class="amount-label">Total Pagado</div>
        <div class="amount-value">${fmtAmt(amount)}</div>
      </div>

      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">Empleado</span><span class="detail-value">${employee_name}</span></div>
        <div class="detail-row alt"><span class="detail-label">Periodo</span><span class="detail-value">${fmtDate(period_start)} — ${fmtDate(period_end)}</span></div>
        <div class="detail-row"><span class="detail-label">Horas trabajadas</span><span class="detail-value">${Number(total_hours || 0).toFixed(2)} h</span></div>
        <div class="detail-row alt"><span class="detail-label">Tarifa / hora</span><span class="detail-value">${fmtAmt(hourly_rate)}</span></div>
        <div class="detail-row"><span class="detail-label">Tipo de pago</span><span class="detail-value">${typeLabel}</span></div>
        <div class="detail-row alt"><span class="detail-label">Método</span><span class="detail-value">${methodLabel}</span></div>
        <div class="detail-row"><span class="detail-label">Procesado por</span><span class="detail-value">${paid_by_name || "Sistema"}</span></div>
        <div class="detail-row alt"><span class="detail-label">Fecha de pago</span><span class="detail-value">${fmtDate(paid_at)}</span></div>
      </div>
    </div>
    <div class="footer">
      <p>SmartFixOS · Recibo generado automáticamente</p>
      <p>Este documento es un comprobante oficial de pago.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function processPayrollHandler(req) {
  console.log("🦕 processPayroll called");
  try {
    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname,
    });

    const body = await req.json();
    const {
      employee_id,
      employee_name,
      employee_email,
      employee_code,
      amount,
      type,
      payment_method,
      notes,
      period_start,
      period_end,
      paid_by,
      paid_by_name,
      tenant_id,
      total_hours,
      hourly_rate,
    } = body;

    if (!employee_id || !amount || !period_start || !period_end) {
      return Response.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const paymentAmount = parseFloat(amount);
    const paid_at = new Date().toISOString();
    const normalizedMethod = payment_method === "ath_movil" ? "transfer" : payment_method;
    const normalizedNotes = payment_method === "ath_movil"
      ? [notes, "Método real: ATH Móvil"].filter(Boolean).join(" | ")
      : (notes || "");

    // 1. Crear EmployeePayment (service role)
    const paymentRecord = await base44.asServiceRole.entities.EmployeePayment.create({
      employee_id,
      employee_name,
      employee_code: employee_code || "",
      amount: paymentAmount,
      payment_type: type || "salary",
      payment_method: normalizedMethod,
      period_start,
      period_end,
      notes: normalizedNotes,
      paid_by: paid_by || null,
      paid_by_name: paid_by_name || "Sistema",
      tenant_id: tenant_id || null,
    });

    // 2. Crear Transaction como gasto de nómina
    const validExpenseCategories = new Set(["other_expense", "parts", "payroll", "repair_payment", "supplies", "refund"]);
    await base44.asServiceRole.entities.Transaction.create({
      type: "expense",
      amount: Math.abs(paymentAmount),
      category: "payroll",
      description: `Pago de nómina — ${employee_name} (${type || "salary"}) [${payment_method}] | Periodo: ${new Date(period_start).toLocaleDateString("es-PR")} — ${new Date(period_end).toLocaleDateString("es-PR")}`,
      payment_method: normalizedMethod,
      recorded_by: paid_by_name || "Sistema",
      tenant_id: tenant_id || null,
    });

    // 3. Obtener y eliminar TimeEntry del periodo pagado (usa service role para bypasear RLS)
    const { data: allEntries, error: fetchError } = await base44.asServiceRole.supabase
      .from("time_entry")
      .select("id, clock_in")
      .eq("employee_id", employee_id);

    let deletedCount = 0;
    let deleteErrors = [];

    if (!fetchError && Array.isArray(allEntries)) {
      const fromDate = new Date(period_start);
      const toDate = new Date(period_end);
      const entriesInPeriod = allEntries.filter((e) => {
        const d = new Date(e.clock_in);
        return d >= fromDate && d <= toDate;
      });

      for (const entry of entriesInPeriod) {
        const { error: delErr } = await base44.asServiceRole.supabase
          .from("time_entry")
          .delete()
          .eq("id", entry.id);

        if (delErr) {
          console.error(`Error deleting time_entry ${entry.id}:`, delErr.message);
          deleteErrors.push(entry.id);
        } else {
          deletedCount++;
        }
      }
    }

    // 4. Enviar recibo por email al empleado (si tiene email)
    let emailSent = false;
    let emailError = null;

    if (employee_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee_email)) {
      try {
        const receiptHtml = buildReceiptHtml({
          employee_name,
          employee_email,
          amount: paymentAmount,
          type: type || "salary",
          payment_method,
          period_start,
          period_end,
          total_hours: total_hours || 0,
          hourly_rate: hourly_rate || 0,
          paid_by_name,
          paid_at,
        });

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@smartfixos.com";

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `SmartFixOS <${FROM_EMAIL}>`,
            to: [employee_email],
            subject: `Recibo de Pago — ${new Date(period_start).toLocaleDateString("es-PR")} al ${new Date(period_end).toLocaleDateString("es-PR")}`,
            html: receiptHtml,
          }),
        });

        emailSent = emailRes.ok;
        if (!emailRes.ok) {
          const errBody = await emailRes.text();
          emailError = errBody;
          console.error("Email send error:", errBody);
        }
      } catch (e) {
        emailError = e.message;
        console.error("Email exception:", e);
      }
    }

    return Response.json({
      success: true,
      payment_id: paymentRecord?.id || null,
      deleted_entries: deletedCount,
      delete_errors: deleteErrors.length,
      email_sent: emailSent,
      email_error: emailError,
    });

  } catch (err) {
    console.error("processPayroll error:", err);
    return Response.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
