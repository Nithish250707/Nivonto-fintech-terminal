import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getQuote } from "@/lib/finnhub";
import { getTickerNews } from "@/lib/massive";
import { buildSystemPrompt } from "@/lib/prompts";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const { messages, ticker } = (await request.json()) as {
      messages: ChatMessage[];
      ticker: string;
    };

    const [quote, news] = await Promise.all([
      getQuote(ticker),
      getTickerNews(ticker),
    ]);

    const { open, high, low, current: price, change, changePercent, prevClose } = quote;

    const systemPrompt = buildSystemPrompt({
      ticker,
      price,
      open,
      high,
      low,
      prevClose,
      change,
      changePercent,
      news,
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response("internal server error", { status: 500 });
  }
}
