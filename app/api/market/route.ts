import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/finnhub";
import { getTickerDetails, getTickerNews } from "@/lib/massive";

export async function GET(request: NextRequest) {
  try {
    const ticker = request.nextUrl.searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const [quote, news, details] = await Promise.all([
      getQuote(ticker),
      getTickerNews(ticker),
      getTickerDetails(ticker),
    ]);

    const snapshot = {
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.current,
      change: quote.change,
      changePct: quote.changePercent,
      prevClose: quote.prevClose,
      updatedAt: quote.updatedAt,
    };

    return NextResponse.json({ snapshot, news, details });
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
