import { NextRequest, NextResponse } from "next/server";
import { getHistoricalCandles } from "@/lib/massive";

export async function GET(request: NextRequest) {
  try {
    const ticker = request.nextUrl.searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const defaultFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const defaultTo = new Date().toISOString().split("T")[0];

    const from = request.nextUrl.searchParams.get("from") ?? defaultFrom;
    const to = request.nextUrl.searchParams.get("to") ?? defaultTo;

    const candles = await getHistoricalCandles(ticker, from, to);
    return NextResponse.json(candles);
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
