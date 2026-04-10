import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/finnhub";

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

const MARKET_OPEN_STALE_MS = 15 * 60 * 1000;

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { ticker } = await context.params;

    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const quote = await getQuote(ticker);
    const ageMs = Date.now() - quote.updatedAt;
    const isMarketOpen = ageMs < MARKET_OPEN_STALE_MS;

    return NextResponse.json(
      {
        price: quote.current,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        prevClose: quote.prevClose,
        updatedAt: quote.updatedAt,
        isMarketOpen,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
