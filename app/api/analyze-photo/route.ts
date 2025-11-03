import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    console.log('Analyzing food photo:', image.name, 'Size:', image.size, 'bytes');

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = image.type;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this food image and provide nutritional information. Return ONLY a JSON object with this exact structure (no markdown, no code blocks, just the JSON):

{
  "description": "brief description of the food items visible",
  "calories": estimated total calories as a number,
  "protein": estimated protein in grams as a number,
  "carbs": estimated carbohydrates in grams as a number,
  "fat": estimated fat in grams as a number
}

If you cannot identify food in the image, return calories, protein, carbs, and fat as 0 and description as "No food detected in image".

Be as accurate as possible with portion sizes and nutritional estimates.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    console.log('OpenAI Vision response:', content);

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const nutritionData = JSON.parse(content.trim());

    return NextResponse.json(nutritionData);
  } catch (error) {
    console.error('Photo analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze photo' },
      { status: 500 }
    );
  }
}
