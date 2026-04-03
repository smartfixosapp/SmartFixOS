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

// ── Convert File to base64 (browser) ─────────────────────────────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Resize image before sending to AI (max 1024px, saves tokens) ─────────────
async function resizeImageFile(file, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(file);
        return;
      }
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// ── Gemini Vision call ───────────────────────────────────────────────────────
async function tryGeminiVision(prompt, { maxTokens, temperature, systemPrompt, images }) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) return null;

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Entendido. Estoy lista para ayudar." }] });
  }

  // Build parts: text + images
  const parts = [{ text: prompt }];
  for (const img of images) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    });
  }
  contents.push({ role: "user", parts });

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

  if (!res.ok) return null;

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── Public API: Gemini first, Groq fallback ──────────────────────────────────
export async function callGeminiAI(prompt, { maxTokens = 600, temperature = 0.35, systemPrompt = "" } = {}) {
  const opts = { maxTokens, temperature, systemPrompt };

  try {
    const geminiResult = await tryGemini(prompt, opts);
    if (geminiResult) return geminiResult;
  } catch { /* fall through */ }

  return tryGroq(prompt, opts);
}

// ── Public API: Vision (Gemini only, Groq fallback text-only) ────────────────
export async function callGeminiAIWithVision(prompt, { maxTokens = 1200, temperature = 0.2, systemPrompt = "", images = [] } = {}) {
  // Resize images first
  const processedImages = [];
  for (const file of images.slice(0, 4)) {
    const resized = await resizeImageFile(file);
    const img64 = await fileToBase64(resized);
    processedImages.push(img64);
  }

  // Try Gemini with vision
  if (processedImages.length > 0) {
    try {
      const result = await tryGeminiVision(prompt, { maxTokens, temperature, systemPrompt, images: processedImages });
      if (result) return result;
    } catch { /* fall through */ }
  }

  // Fallback: text-only (Gemini or Groq)
  const textPrompt = processedImages.length > 0
    ? `${prompt}\n\n(NOTA: Se adjuntaron ${processedImages.length} foto(s) del dispositivo pero no pudieron ser analizadas. Llena photo_analysis como null.)`
    : prompt;

  return callGeminiAI(textPrompt, { maxTokens, temperature, systemPrompt });
}
