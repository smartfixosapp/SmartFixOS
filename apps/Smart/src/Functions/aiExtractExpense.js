// AI Expense Extraction - Reads receipts, bank statements, payroll screenshots, and invoices
// Uses Gemini Vision (free tier) to extract structured financial data from uploaded documents.
// Used by JenaiExpenseCapture.jsx (finanzas) y POInvoiceScannerDialog.jsx (inventario/compras).
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const REQUEST_TIMEOUT = 60000;

// Prompts specialized per document type
const PROMPTS = {
  receipt: `Eres un sistema experto en leer recibos y facturas (Luma, AAA, compras, servicios).
Extrae los datos del recibo en la imagen.

Responde SOLO con un objeto JSON valido con esta estructura:
{
  "document_type": "receipt",
  "amount": 123.45,
  "vendor": "Luma Energy",
  "date": "2026-04-13",
  "category": "utilities",
  "description": "Pago de luz",
  "payment_method": "cash|card|ath_movil|check|other",
  "confidence": "high|medium|low",
  "notes": "opcional, detalles adicionales"
}

Categorias validas:
- utilities: Luma, AAA, internet, gas
- rent: Renta del local
- supplies: Materiales/suministros de oficina
- parts: Piezas, componentes, inventario
- maintenance: Reparaciones, mantenimiento
- insurance: Seguros
- taxes: Impuestos
- payroll: Pagos a empleados
- other_expense: Otros

Si no puedes determinar algo con certeza, pon "confidence": "low".`,

  statement: `Eres un sistema experto en leer estados de cuenta bancarios.
Extrae TODAS las transacciones visibles del estado de cuenta en la imagen/PDF.

Responde SOLO con un objeto JSON valido:
{
  "document_type": "statement",
  "account_name": "Banco Popular",
  "period": "01/04/2026 - 30/04/2026",
  "transactions": [
    {
      "date": "2026-04-05",
      "amount": 45.67,
      "type": "expense|income",
      "vendor": "Luma Energy",
      "description": "Pago automatico",
      "category": "utilities",
      "suggested_import": true
    }
  ],
  "total_expenses": 456.78,
  "total_income": 1234.56,
  "confidence": "high|medium|low"
}

Ignora transferencias internas. Solo incluye gastos e ingresos reales.
suggested_import: false si es transferencia entre cuentas propias o cargos duplicados.`,

  payroll: `Eres un sistema experto en leer screenshots de pagos a empleados via ATH Movil, Zelle, Venmo, transferencias.
Extrae los datos del pago.

Responde SOLO con un objeto JSON valido:
{
  "document_type": "payroll",
  "amount": 500.00,
  "employee_name": "Juan Perez",
  "employee_phone": "787-555-1234",
  "date": "2026-04-13",
  "payment_method": "ath_movil|zelle|transfer|cash|check",
  "description": "Pago de nomina",
  "confidence": "high|medium|low",
  "notes": "opcional"
}

Si no identificas el nombre del empleado, ponlo como null.`,

  invoice: `Eres un sistema experto en leer facturas de proveedores (invoices de piezas, accesorios, inventario).
Extrae los items de la factura.

Responde SOLO con un objeto JSON valido:
{
  "document_type": "invoice",
  "supplier_name": "PR Mobile Parts",
  "invoice_number": "INV-12345",
  "date": "2026-04-13",
  "subtotal": 450.00,
  "tax_amount": 51.75,
  "shipping_cost": 15.00,
  "total_amount": 516.75,
  "line_items": [
    {
      "product_name": "Pantalla iPhone 13",
      "quantity": 5,
      "unit_cost": 85.00,
      "line_total": 425.00
    }
  ],
  "confidence": "high|medium|low",
  "notes": "opcional"
}`,
};

async function streamDownload(url, maxBytes = MAX_DOWNLOAD_BYTES) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    const contentType = response.headers.get('Content-Type') || '';
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > maxBytes) throw new Error('File too large');
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > maxBytes) throw new Error('File too large');
      chunks.push(value);
    }
    const allBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      allBytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { data: allBytes, contentType };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('Request timeout');
    throw error;
  }
}

function uint8ArrayToBase64(bytes) {
  // Chunk to avoid "Maximum call stack size exceeded" on large files
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function extractFromImage(fileData, contentType, documentType) {
  if (!GEMINI_API_KEY) throw new Error('Gemini API not configured');

  const prompt = PROMPTS[documentType];
  if (!prompt) throw new Error(`Unknown document_type: ${documentType}`);

  const base64 = uint8ArrayToBase64(fileData);

  console.log(`🤖 Extracting ${documentType} with Gemini Vision...`);
  const body = {
    contents: [{
      parts: [
        { text: prompt + '\n\nAnaliza este documento y extrae los datos en el formato JSON especificado.' },
        { inlineData: { mimeType: contentType, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2000,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Gemini error:', err);
    throw new Error('Gemini API error extracting document');
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('✅ Extraction complete');
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('❌ JSON parse error. Raw response:', text);
    // Try to extract JSON from markdown wrapper if present
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI returned invalid JSON');
  }
}

export async function aiExtractExpenseHandler(req) {
  console.log('💰 /ai/extract-expense endpoint called');
  try {
    const payload = await req.json();
    const fileUrl = payload.file_url;
    const documentType = payload.document_type || 'receipt';

    if (!fileUrl) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }
    if (!PROMPTS[documentType]) {
      return Response.json(
        { error: `Invalid document_type. Must be one of: ${Object.keys(PROMPTS).join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`📨 Extracting ${documentType} from ${fileUrl}`);

    // Download file
    const { data: fileData, contentType } = await streamDownload(fileUrl);
    console.log(`✅ Downloaded ${fileData.length} bytes (${contentType})`);

    // Only images supported for now (PDFs need conversion)
    if (!contentType.startsWith('image/')) {
      return Response.json(
        { error: 'Por ahora solo imagenes son soportadas (PNG, JPG, WEBP). Para PDFs, conviertelos a imagen primero.' },
        { status: 400 }
      );
    }

    const result = await extractFromImage(fileData, contentType, documentType);
    return Response.json(result);
  } catch (error) {
    console.error('💥 Error in aiExtractExpense:', error);
    return Response.json(
      { error: error.message || 'AI extraction failed' },
      { status: 500 }
    );
  }
}
