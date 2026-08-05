// geminiCategorizeExpense — sugiere categoría para un gasto según su
// descripción, monto e historial reciente. Usado por AIExpenseCategorizor.jsx
// dentro de ExpenseDialog.jsx. Antes esto pasaba por /ai/invoke (OpenAI, de
// pago); se separó a su propio endpoint con Gemini (gratis) para no tocar
// /ai/invoke, que otras pantallas (notificaciones, inventario, diagnóstico
// de órdenes) siguen usando con OpenAI.
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const VALID_CATEGORIES = ['repair_payment', 'parts', 'supplies', 'other_expense', 'refund'];

export async function geminiCategorizeExpenseHandler(req) {
  if (!GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { description, amount = 0, recentExpenses = [] } = await req.json();

    if (!description || String(description).trim().length < 3) {
      return Response.json({ error: 'description is required' }, { status: 400 });
    }

    const history = recentExpenses
      .slice(0, 20)
      .map((e) => `"${e.description}" → ${e.category} ($${e.amount})`)
      .join('\n');

    const prompt = `
Categoriza este gasto de un taller de reparación de electrónicos, basándote en el historial.

NUEVO GASTO:
Descripción: "${description}"
Monto: $${Number(amount).toFixed(2)}

HISTORIAL DE GASTOS PREVIOS:
${history || '(sin historial todavía)'}

CATEGORÍAS DISPONIBLES:
- repair_payment: Pagos de reparaciones
- parts: Piezas y componentes
- supplies: Suministros generales
- other_expense: Otros gastos
- refund: Reembolsos

Responde con la categoría más probable, tu nivel de confianza, una razón breve (1 oración,
en español), y hasta 2 categorías alternativas si aplica.
`.trim();

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: VALID_CATEGORIES },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reasoning: { type: 'string' },
            alternative_categories: { type: 'array', items: { type: 'string', enum: VALID_CATEGORIES } },
          },
          required: ['category', 'confidence', 'reasoning'],
        },
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
      return Response.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json({ error: 'Gemini returned invalid JSON' }, { status: 502 });
    }

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = 'other_expense';
    }

    return Response.json(parsed);
  } catch (error) {
    console.error('💥 geminiCategorizeExpense error:', error);
    return Response.json({ error: error.message || 'Categorization failed' }, { status: 500 });
  }
}
