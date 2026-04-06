import OpenAI from 'npm:openai@^4.0.0';

const openai_api_key = Deno.env.get('OPENAI_API_KEY');
const groq_api_key = Deno.env.get('GROQ_API_KEY');

const openai = openai_api_key ? new OpenAI({ apiKey: openai_api_key }) : null;
const groq = groq_api_key ? new OpenAI({ apiKey: groq_api_key, baseURL: "https://api.groq.com/openai/v1" }) : null;

/**
 * /ai/chat — Proxied chat endpoint for JEANI
 * Accepts: { messages, system, tools, model? }
 * Returns: OpenAI-compatible response
 */
export async function aiChatHandler(req) {
  try {
    const body = await req.json();
    const { messages = [], system = "", tools = [], model } = body;

    if (!messages.length) {
      return Response.json({ error: "No messages provided" }, { status: 400 });
    }

    const chatMessages = [
      { role: "system", content: system },
      ...messages,
    ];

    const params = {
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 600,
    };

    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    // Try OpenAI first, fallback to Groq
    let client = openai;
    let useModel = model || "gpt-4o-mini";

    if (!client) {
      client = groq;
      useModel = "llama-3.1-8b-instant";
    }

    if (!client) {
      return Response.json({ error: "No AI API key configured on server" }, { status: 500 });
    }

    try {
      params.model = useModel;
      const response = await client.chat.completions.create(params);
      return Response.json(response);
    } catch (err) {
      // If OpenAI fails, try Groq as fallback
      if (client === openai && groq) {
        console.warn(`[aiChat] OpenAI failed (${err.message}), trying Groq...`);
        params.model = "llama-3.1-8b-instant";
        // Groq may not support all tools, strip if needed
        const groqResponse = await groq.chat.completions.create(params);
        return Response.json(groqResponse);
      }
      throw err;
    }
  } catch (err) {
    console.error("[aiChat] Error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
