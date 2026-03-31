import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { parseJsonFromAssistantText } from '@/lib/parse-assistant-json';

/** Haiku 4.5: vision + text, fast; replaces retired claude-3-5-haiku-20241022 */
const CALORIE_TEXT_MODEL = 'claude-haiku-4-5';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Anthropic API key is not set');
      return NextResponse.json(
        { error: 'Anthropic API key is not configured' },
        { status: 500 }
      );
    }

    const { description } = await request.json();
    console.log('Analyzing food description:', description);

    const prompt = `Analyze the following food description and provide a JSON response with estimated calories and macronutrients:
Description: "${description}"
Please provide:
1. Total calories
2. Grams of protein
3. Grams of carbohydrates
4. Grams of fat
Format the response as a JSON object with these exact keys: calories, protein, carbs, fat. Return only valid JSON, no markdown.`;

    const response = await anthropic.messages.create({
      model: CALORIE_TEXT_MODEL,
      max_tokens: 500,
      system:
        'You are a nutrition expert that analyzes food descriptions and provides calorie and macronutrient estimates. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text =
      textBlock && textBlock.type === 'text' ? textBlock.text : null;
    console.log('Anthropic response:', text);

    if (!text) {
      throw new Error('No response from Anthropic');
    }

    return NextResponse.json(parseJsonFromAssistantText(text));
  } catch (error) {
    console.error('Error analyzing food:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food description' },
      { status: 500 }
    );
  }
}
