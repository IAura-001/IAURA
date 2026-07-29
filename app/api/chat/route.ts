import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      input: prompt,
    });

    return NextResponse.json({
      content: response.output_text,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "IAURA could not generate a response.",
      },
      {
        status: 500,
      }
    );
  }
}