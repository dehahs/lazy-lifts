import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not set');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
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
Format the response as a JSON object with these exact keys: calories, protein, carbs, fat`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a nutrition expert that analyzes food descriptions and provides calorie and macronutrient estimates. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content;
    console.log('OpenAI response:', response);
    return NextResponse.json(JSON.parse(response));
  } catch (error) {
    console.error('Error analyzing food:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food description' },
      { status: 500 }
    );
  }
}
