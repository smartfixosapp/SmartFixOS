import { dataClient } from "@/components/api/dataClient";

export function resolveActiveTenantId() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.tenant_id) return session.tenant_id;
      if (session?.user?.tenant_id) return session.user.tenant_id;
      if (session?.session?.tenant_id) return session.session.tenant_id;
    }
  } catch {
    // no-op
  }

  return (
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id") ||
    sessionStorage.getItem("current_tenant_id") ||
    null
  );
}

export async function recordSaleAndTransactions({ sale, transactions = [] }) {
  const tenantId = sale?.tenant_id || resolveActiveTenantId();
  const salePayload = tenantId ? { ...sale, tenant_id: tenantId } : { ...sale };
  const transactionPayloads = (transactions || []).map((tx) =>
    tenantId && !tx?.tenant_id ? { ...tx, tenant_id: tenantId } : tx
  );

  const response = await fetch("/api/cash-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "record_sale",
      sale: salePayload,
      transactions: transactionPayloads,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || "No se pudo registrar la venta");
  }

  return {
    sale: payload.sale,
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
  };
}
