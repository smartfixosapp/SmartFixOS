/**
 * Shared Groq AI utility for SmartFixOS
 * Uses Llama 3.3 70B via Groq (free tier, no expiry)
 */

const GROQ_MODEL = "llama-3.1-8b-instant"; // reemplazo oficial de llama3-8b-8192
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroqAI(prompt, { maxTokens = 300, temperature = 0.4 } = {}) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
  if (!GROQ_KEY) throw new Error("VITE_GROQ_API_KEY no configurada");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(data?.error?.message || "Sin respuesta de la IA");
  return text;
}
