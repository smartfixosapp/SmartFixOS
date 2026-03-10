import OpenAI from 'npm:openai@^4.0.0';

const openai_api_key = Deno.env.get('OPENAI_API_KEY');
if (!openai_api_key) {
  console.warn('⚠️ Warning: OPENAI_API_KEY not found in environment variables');
}

const openai = openai_api_key ? new OpenAI({ apiKey: openai_api_key }) : null;

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

  if (!openai) {
    console.error('❌ Error: OpenAI client not initialized (missing API key)');
    return Response.json(
      { error: 'OpenAI API not configured' },
      { status: 500 }
    );
  }

  try {
    const payload = await req.json();
    console.log(`📨 Received payload keys: ${Object.keys(payload)}`);

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
