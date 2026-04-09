import { NextRequest, NextResponse } from "next/server";
import { getLatestPrice, getTickerDetails, getTickerNews } from "@/lib/massive";

export async function GET(request: NextRequest) {
  try {
    const ticker = request.nextUrl.searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }

    const [snapshot, news, details] = await Promise.all([
      getLatestPrice(ticker),
      getTickerNews(ticker),
      getTickerDetails(ticker),
    ]);

    return NextResponse.json({ snapshot, news, details });
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
