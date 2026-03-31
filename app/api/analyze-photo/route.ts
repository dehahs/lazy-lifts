import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromAssistantText } from '@/lib/parse-assistant-json';

/** Haiku 4.5: vision + structured JSON; replaces retired claude-3-5-haiku-20241022 */
const CALORIE_VISION_MODEL = 'claude-haiku-4-5';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function normalizeImageMediaType(
  type: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const t = type.toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return 'image/jpeg';
  if (t === 'image/png') return 'image/png';
  if (t === 'image/gif') return 'image/gif';
  if (t === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key is not configured' },
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

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mediaType = normalizeImageMediaType(image.type || 'image/jpeg');

    const prompt = `Analyze this food image and provide nutritional information. Return ONLY a JSON object with this exact structure (no markdown, no code blocks, just the JSON):

{
  "description": "brief description of the food items visible",
  "calories": estimated total calories as a number,
  "protein": estimated protein in grams as a number,
  "carbs": estimated carbohydrates in grams as a number,
  "fat": estimated fat in grams as a number
}

If you cannot identify food in the image, return calories, protein, carbs, and fat as 0 and description as "No food detected in image".

Be as accurate as possible with portion sizes and nutritional estimates.`;

    const response = await anthropic.messages.create({
      model: CALORIE_VISION_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const content =
      textBlock && textBlock.type === 'text' ? textBlock.text : null;
    console.log('Anthropic Vision response:', content);

    if (!content) {
      throw new Error('No response from Anthropic');
    }

    const nutritionData = parseJsonFromAssistantText(content);

    return NextResponse.json(nutritionData);
  } catch (error) {
    console.error('Photo analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze photo' },
      { status: 500 }
    );
  }
}
