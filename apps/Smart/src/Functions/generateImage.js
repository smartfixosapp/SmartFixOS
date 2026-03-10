import OpenAI from 'npm:openai@^4.0.0';

const openai_api_key = Deno.env.get('OPENAI_API_KEY');
if (!openai_api_key) {
  console.warn('⚠️ Warning: OPENAI_API_KEY not found in environment variables');
}

const openai = openai_api_key ? new OpenAI({ apiKey: openai_api_key }) : null;

export async function generateImageHandler(req) {
  console.log('🎨 /ai/generate-image endpoint called');

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

    console.log(`🔍 Extracted parameters:`);
    console.log(`  - Prompt length: ${prompt?.length || 0} characters`);
    console.log(`  - Prompt preview: ${prompt?.substring(0, 100) || 'None'}...`);

    if (!prompt) {
      console.error('❌ Error: No prompt provided');
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🤖 Making OpenAI DALL-E API call...');
    console.log('  - Model: dall-e-3');
    console.log('  - Size: 1024x1024');
    console.log('  - Quality: standard');

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1
    });

    console.log('✅ OpenAI DALL-E API call successful');
    const imageUrl = response.data[0].url;
    console.log(`🖼️ Generated image URL: ${imageUrl.substring(0, 50)}...`);

    const responseData = { url: imageUrl };
    console.log('🎯 Returning image response');
    return Response.json(responseData);
  } catch (error) {
    console.error('💥 Unexpected error in image generation:', error);
    console.error(`🔍 Error type: ${error.constructor.name}`);
    return Response.json(
      { error: `Image generation failed: ${error.message}` },
      { status: 500 }
    );
  }
}
