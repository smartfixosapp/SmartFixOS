const SB_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://idntuvtabecwubzswpwi.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(prefer = "return=representation") {
  return {
    "Content-Type": "application/json",
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    Prefer: prefer,
  };
}

async function sbInsert(table, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`INSERT ${table}: ${text}`);
  }

  return res.json();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!SB_KEY) {
    return res.status(500).json({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY no configurado" });
  }

  try {
    const { sale, transactions = [] } = req.body || {};

    if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
      return res.status(400).json({ success: false, error: "Payload de venta inválido" });
    }

    const createdSaleRows = await sbInsert("sale", sale);
    const createdSale = Array.isArray(createdSaleRows) ? createdSaleRows[0] : createdSaleRows;

    const createdTransactions = [];
    for (const tx of transactions) {
      const createdTxRows = await sbInsert("transaction", tx);
      createdTransactions.push(Array.isArray(createdTxRows) ? createdTxRows[0] : createdTxRows);
    }

    return res.status(200).json({
      success: true,
      sale: createdSale,
      transactions: createdTransactions,
    });
  } catch (error) {
    console.error("record-sale error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "No se pudo registrar la venta",
    });
  }
}
