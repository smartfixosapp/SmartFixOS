/**
 * JENAI AI utility for SmartFixOS
 * Primary: Gemini 2.0 Flash | Fallback: Groq Llama 3.1 8B
 */

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

// ── Gemini call ──────────────────────────────────────────────────────────────
async function tryGemini(prompt, { maxTokens, temperature, systemPrompt }) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) return null;

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Entendido. Estoy lista para ayudar." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const res = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.95 },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });

  if (!res.ok) return null; // fallback to Groq

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── Groq fallback ────────────────────────────────────────────────────────────
async function tryGroq(prompt, { maxTokens, temperature, systemPrompt }) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
  if (!GROQ_KEY) throw new Error("Ni VITE_GEMINI_API_KEY ni VITE_GROQ_API_KEY estan configuradas");

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(data?.error?.message || "Sin respuesta de IA");
  return text;
}

// ── Public API: Gemini first, Groq fallback ──────────────────────────────────
export async function callGeminiAI(prompt, { maxTokens = 600, temperature = 0.35, systemPrompt = "" } = {}) {
  const opts = { maxTokens, temperature, systemPrompt };

  // Try Gemini first
  try {
    const geminiResult = await tryGemini(prompt, opts);
    if (geminiResult) return geminiResult;
  } catch { /* fall through */ }

  // Fallback to Groq
  return tryGroq(prompt, opts);
}
