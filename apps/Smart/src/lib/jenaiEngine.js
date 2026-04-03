/**
 * JENAI Engine — Motor de IA unificado para SmartFixOS
 * Primary: OpenAI GPT-4o-mini | Fallback: Groq Llama 3.1 8B
 * powered by SmartFixOS
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export async function resizeImageFile(file, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(file); return; }
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

// ── OpenAI Chat (primary) ────────────────────────────────────────────────────

async function tryOpenAI(messages, { maxTokens, temperature, jsonMode = false }) {
  const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  if (!API_KEY || API_KEY === "your-openai-api-key") return null;

  const body = {
    model: OPENAI_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429 || res.status === 402) return null; // quota/billing → fallback
    const err = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

// ── Groq fallback ────────────────────────────────────────────────────────────

async function tryGroq(messages, { maxTokens, temperature, jsonMode = false }) {
  const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
  if (!GROQ_KEY) throw new Error("Ni VITE_OPENAI_API_KEY ni VITE_GROQ_API_KEY configuradas");

  const body = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(data?.error?.message || "Sin respuesta de IA");
  return text;
}

// ── Build messages array ─────────────────────────────────────────────────────

function buildMessages(prompt, { systemPrompt = "", imageDataList = [] }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  if (imageDataList.length > 0) {
    // Vision: multi-content message
    const content = [{ type: "text", text: prompt }];
    for (const img of imageDataList) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "low" },
      });
    }
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  return messages;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Text generation — OpenAI primary, Groq fallback
 */
export async function callJENAI(prompt, { maxTokens = 500, temperature = 0.35, systemPrompt = "" } = {}) {
  const messages = buildMessages(prompt, { systemPrompt });

  try {
    const result = await tryOpenAI(messages, { maxTokens, temperature });
    if (result) return result;
  } catch { /* fall through */ }

  return tryGroq(messages, { maxTokens, temperature });
}

/**
 * JSON mode — guarantees valid JSON response (OpenAI native, Groq supported)
 */
export async function callJENAIJSON(prompt, { maxTokens = 800, temperature = 0.15, systemPrompt = "" } = {}) {
  const messages = buildMessages(prompt, { systemPrompt });

  try {
    const result = await tryOpenAI(messages, { maxTokens, temperature, jsonMode: true });
    if (result) return result;
  } catch { /* fall through */ }

  return tryGroq(messages, { maxTokens, temperature, jsonMode: true });
}

/**
 * Vision — OpenAI with images, Groq text-only fallback
 */
export async function callJENAIWithVision(prompt, { maxTokens = 1000, temperature = 0.2, systemPrompt = "", images = [] } = {}) {
  // Process images: resize + convert to base64
  const imageDataList = [];
  for (const file of images.slice(0, 4)) {
    const resized = await resizeImageFile(file);
    const data = await fileToBase64(resized);
    imageDataList.push(data);
  }

  const messages = buildMessages(prompt, { systemPrompt, imageDataList });

  // Try OpenAI with vision
  if (imageDataList.length > 0) {
    try {
      const result = await tryOpenAI(messages, { maxTokens, temperature });
      if (result) return result;
    } catch { /* fall through */ }
  }

  // Fallback: text-only
  const textMessages = buildMessages(
    imageDataList.length > 0
      ? `${prompt}\n\n(NOTA: Se adjuntaron ${imageDataList.length} foto(s) pero no pudieron ser analizadas. Llena photo_analysis como null.)`
      : prompt,
    { systemPrompt }
  );

  try {
    const result = await tryOpenAI(textMessages, { maxTokens, temperature });
    if (result) return result;
  } catch { /* fall through */ }

  return tryGroq(textMessages, { maxTokens, temperature });
}
