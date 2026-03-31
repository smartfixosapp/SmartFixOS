const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function geminiSummaryHandler(req) {
  if (!GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const {
      totalIncome = 0,
      totalExpenses = 0,
      netProfit = 0,
      period = 'hoy',
      salesCount = 0,
      topCategories = [],
      paymentBreakdown = [],
      avgTicket = 0,
    } = await req.json();

    const prompt = `
Eres el asistente financiero de SmartFixOS, un sistema para talleres de reparación.
Analiza los siguientes datos financieros y dame un resumen ejecutivo en ESPAÑOL, directo y útil para el dueño del negocio.
El tono debe ser profesional pero amigable. Usa emojis con moderación.

PERÍODO: ${period}

DATOS:
- Ingresos totales: $${totalIncome.toFixed(2)}
- Gastos totales: $${totalExpenses.toFixed(2)}
- Ganancia neta: $${netProfit.toFixed(2)}
- Número de ventas/cobros: ${salesCount}
- Ticket promedio: $${avgTicket.toFixed(2)}
${topCategories.length > 0 ? `- Top categorías de gastos: ${topCategories.map(c => `${c.label} ($${c.amount.toFixed(0)})`).join(', ')}` : ''}
${paymentBreakdown.length > 0 ? `- Métodos de pago: ${paymentBreakdown.map(p => `${p.method} ($${p.total.toFixed(0)})`).join(', ')}` : ''}

Responde con:
1. Un párrafo resumen de 2-3 oraciones sobre el desempeño del período
2. Un punto positivo concreto (si aplica)
3. Una recomendación o alerta concreta (si aplica)

Sé breve y directo. Máximo 120 palabras en total.
`.trim();

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 300,
      }
    };

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini error:', err);
      return Response.json({ error: 'Gemini API error', details: err }, { status: 500 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return Response.json({ summary: text });
  } catch (error) {
    console.error('geminiSummary error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
