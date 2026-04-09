import { NextRequest, NextResponse } from "next/server";
import { runBacktest, type Strategy } from "@/lib/backtest";
import { getHistoricalCandles } from "@/lib/massive";

type BacktestRequestBody = {
  ticker: string;
  rules: Strategy;
  from?: string;
  to?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BacktestRequestBody;
    const ticker = body.ticker;
    const rules = body.rules;

    const defaultFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const defaultTo = new Date().toISOString().split("T")[0];

    const from = body.from ?? defaultFrom;
    const to = body.to ?? defaultTo;

    const candles = await getHistoricalCandles(ticker, from, to);

    if (candles.length < 30) {
      return NextResponse.json({ error: "Not enough historical data" }, { status: 400 });
    }

    const result = runBacktest(candles, rules);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
