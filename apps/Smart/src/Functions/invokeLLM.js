import OpenAI from 'npm:openai@^4.0.0';

const openai_api_key = Deno.env.get('OPENAI_API_KEY');
if (!openai_api_key) {
  console.warn('⚠️ Warning: OPENAI_API_KEY not found in environment variables');
}

const openai = openai_api_key ? new OpenAI({ apiKey: openai_api_key }) : null;

const gemini_api_key = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function stripForGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const { additionalProperties, ...rest } = schema;
  if (rest.properties) {
    const properties = {};
    for (const [key, value] of Object.entries(rest.properties)) {
      properties[key] = stripForGemini(value);
    }
    rest.properties = properties;
  }
  if (rest.items) rest.items = stripForGemini(rest.items);
  return rest;
}

/**
 * Intenta Gemini primero. Devuelve null (nunca lanza) para que el
 * caller siga con OpenAI sin interrumpir la respuesta al cliente —
 * Gemini es el motor preferido, no el unico.
 */
async function tryGemini(prompt, { responseJsonSchema } = {}) {
  if (!gemini_api_key) return null;

  const generationConfig = { temperature: 0.35, maxOutputTokens: 1200, topP: 0.95 };
  if (responseJsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = stripForGemini(responseJsonSchema);
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${gemini_api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`⚠️ Gemini respondio ${res.status}, cae a OpenAI`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    if (responseJsonSchema) {
      try {
        return { parsed: JSON.parse(text) };
      } catch {
        console.warn('⚠️ Gemini devolvio JSON invalido, cae a OpenAI');
        return null;
      }
    }
    return { text };
  } catch (error) {
    console.warn(`⚠️ Gemini fallo (${error.message}), cae a OpenAI`);
    return null;
  }
}

/**
 * Transcribe audio con Gemini (entiende audio nativo via inline_data).
 * Sin fallback a OpenAI — Whisper es otro flujo/costo, fuera de alcance
 * de este cambio. Si Gemini no responde, el caller devuelve error.
 */
async function tryGeminiAudio(prompt, audioBase64, mimeType) {
  if (!gemini_api_key) return null;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${gemini_api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: audioBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`⚠️ Gemini audio respondio ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (error) {
    console.warn(`⚠️ Gemini audio fallo (${error.message})`);
    return null;
  }
}

/**
 * Normalize JSON schema for OpenAI structured outputs
 */
function normalizeSchema(schema) {
  console.log('🔧 Normalizing schema...');
  if (!schema) {
    console.log('📋 No schema provided');
    return schema;
  }

  console.log(`📋 Schema type: ${schema.type || 'undefined'}`);
  console.log(`📋 Schema keys: ${Object.keys(schema)}`);

  const copy = { ...schema };
  if (copy.type === 'object' && !('additionalProperties' in copy)) {
    copy.additionalProperties = false;
    console.log('🔧 Added additionalProperties: false');
  }

  console.log('✅ Schema normalization completed');
  return copy;
}

/**
 * Parse response from OpenAI API
 */
function parseResponse(response, hasSchema = false) {
  console.log('🔍 Attempting to extract text from response...');

  let text = null;

  if (response.choices && response.choices[0] && response.choices[0].message) {
    text = response.choices[0].message.content;
    console.log('✅ Found text via choices[0].message.content');
  }

  if (!text) {
    console.error('❌ Could not extract text from response');
    console.log(`🔍 Response structure:`, Object.keys(response));
    throw new Error('Could not find model output in response');
  }

  console.log(`📝 Extracted text length: ${text.length} characters`);
  console.log(`📝 Text preview: ${text.substring(0, 200)}...`);

  // Parse JSON if schema was provided
  if (hasSchema) {
    console.log('🔄 Attempting to parse JSON...');
    try {
      const data = JSON.parse(text);
      console.log('✅ JSON parsing successful');
      return data;
    } catch (e) {
      console.error(`❌ JSON parsing failed: ${e}`);
      console.log(`📝 Raw text that failed to parse: ${text}`);
      throw new Error('Model output was not valid JSON');
    }
  }

  return text;
}

export async function invokeLLMHandler(req) {
  console.log('🚀 /ai/invoke endpoint called');

  try {
    const payload = await req.json();
    console.log(`📨 Received payload keys: ${Object.keys(payload)}`);

    // Transcripcion de audio (dictado) — Gemini nativo, sin pasar por
    // OpenAI en absoluto. Va PRIMERO, antes del guard de `openai`
    // abajo, porque este camino no lo necesita.
    const audioBase64 = payload.audio_base64;
    if (audioBase64) {
      const audioMimeType = payload.mime_type || 'audio/wav';
      const transcriptionPrompt = payload.prompt ||
        'Transcribe este audio a texto en español de Puerto Rico. Es una nota dictada por un técnico de un taller de reparación de celulares y computadoras. Devuelve SOLO la transcripción literal del audio, sin comentarios, sin comillas, sin formato adicional.';
      console.log(`🎙️ Transcripcion de audio solicitada (${audioMimeType}, ${audioBase64.length} chars base64)`);
      const transcript = await tryGeminiAudio(transcriptionPrompt, audioBase64, audioMimeType);
      if (transcript) {
        console.log('✅ Audio transcrito por Gemini');
        return Response.json({ response: transcript });
      }
      console.error('❌ Gemini no pudo transcribir el audio');
      return Response.json({ error: 'No se pudo transcribir el audio' }, { status: 502 });
    }

    if (!openai) {
      console.error('❌ Error: OpenAI client not initialized (missing API key)');
      return Response.json(
        { error: 'OpenAI API not configured' },
        { status: 500 }
      );
    }

    const prompt = payload.prompt;
    const addContextFromInternet = payload.add_context_from_internet || false;
    const responseJsonSchema = payload.response_json_schema;
    const fileUrls = payload.file_urls || [];

    console.log(`🔍 Extracted parameters:`);
    console.log(`  - Prompt length: ${prompt?.length || 0} characters`);
    console.log(`  - Context from internet: ${addContextFromInternet}`);
    console.log(`  - Has schema: ${responseJsonSchema !== null && responseJsonSchema !== undefined}`);
    console.log(`  - File URLs: ${fileUrls.length}`);

    if (!prompt) {
      console.error('❌ Error: No prompt provided');
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Gemini es el motor preferido — mas barato, sin depender de que
    // el iPhone del tecnico tenga Apple Intelligence. Solo para texto
    // (sin fileUrls): las imagenes siguen su camino de OpenAI sin
    // tocar, para no meter riesgo nuevo en ese flujo ya probado.
    if (fileUrls.length === 0) {
      const geminiResult = await tryGemini(prompt, { responseJsonSchema });
      if (geminiResult) {
        console.log('✅ Respondido por Gemini');
        if ('parsed' in geminiResult) {
          return Response.json({ data: { message: geminiResult.parsed } });
        }
        return Response.json({ response: geminiResult.text });
      }
      console.log('↪️ Gemini no disponible o fallo, sigue con OpenAI');
    }

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: responseJsonSchema
          ? 'You are a helpful assistant. Return your answer strictly as JSON that matches the provided schema. No prose outside JSON.'
          : 'You are a helpful assistant.'
      }
    ];

    // Build user message content
    const userContent = [];
    userContent.push({
      type: 'text',
      text: prompt
    });

    // Add file URLs as image_url content if provided
    for (const fileUrl of fileUrls) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: fileUrl,
          detail: 'high'
        }
      });
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    // If we have a schema, use structured outputs
    if (responseJsonSchema) {
      console.log('🔧 Using structured outputs with schema');
      const normalizedSchema = normalizeSchema(responseJsonSchema);
      console.log(`📋 Normalized schema keys: ${Object.keys(normalizedSchema)}`);

      try {
        console.log('🤖 Attempting OpenAI Chat Completion API call with JSON mode...');
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'assessment_response',
              schema: normalizedSchema,
              strict: false
            }
          }
        });

        console.log('✅ OpenAI Chat Completion API call successful');

        const parsedContent = parseResponse(response, true);
        console.log('✅ Successfully parsed JSON');
        console.log(`📊 Result keys: ${typeof parsedContent === 'object' ? Object.keys(parsedContent) : 'Not an object'}`);

        const responseData = {
          data: {
            message: parsedContent
          }
        };
        console.log('🎯 Returning structured response');
        return Response.json(responseData);
      } catch (error) {
        console.error(`⚠️ Structured output failed, trying fallback: ${error.message}`);
        console.log('🤖 Attempting OpenAI Chat Completion API call with json_object mode...');

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
          response_format: { type: 'json_object' }
        });

        console.log('✅ OpenAI Chat Completion API call successful');
        const content = response.choices[0].message.content;
        console.log(`📝 Received content length: ${content.length} characters`);

        try {
          console.log('🔄 Attempting to parse JSON response...');
          const parsedContent = JSON.parse(content);
          console.log('✅ Successfully parsed JSON');

          const responseData = {
            data: {
              message: parsedContent
            }
          };
          console.log('🎯 Returning fallback structured response');
          return Response.json(responseData);
        } catch (jsonError) {
          console.warn(`⚠️ JSON parsing failed: ${jsonError.message}`);
          console.log('📝 Returning raw content');
          return Response.json({
            data: {
              message: content
            }
          });
        }
      }
    } else {
      // Regular text response
      console.log('💬 Using regular text response (no schema)');
      console.log('🤖 Making OpenAI Chat Completion API call...');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages
      });

      console.log('✅ OpenAI API call successful');
      const content = response.choices[0].message.content;
      console.log(`📝 Received response length: ${content.length} characters`);

      const responseData = {
        response: content
      };
      console.log('🎯 Returning text response');
      return Response.json(responseData);
    }
  } catch (error) {
    console.error('💥 Unexpected error in LLM invocation:', error);
    console.error(`🔍 Error type: ${error.constructor.name}`);
    return Response.json(
      { error: `LLM invocation failed: ${error.message}` },
      { status: 500 }
    );
  }
}
