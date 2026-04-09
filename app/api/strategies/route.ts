import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

type CreateStrategyBody = {
  name?: string;
  ticker?: string;
  rules?: unknown;
};

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("strategies")
      .select("id, name, rules, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data ?? []).map((strategy) => ({
      // ticker is stored inside rules payload for now
      ticker:
        typeof (strategy.rules as { ticker?: unknown } | null)?.ticker === "string"
          ? ((strategy.rules as { ticker: string }).ticker ?? "AAPL")
          : "AAPL",
      id: strategy.id,
      name: strategy.name,
      rules: strategy.rules,
      createdAt: strategy.created_at,
    }));

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateStrategyBody;
    const name = body.name?.trim();
    const ticker = body.ticker?.trim().toUpperCase();
    const rules = body.rules;

    if (!name || !ticker || !rules) {
      return NextResponse.json(
        { error: "name, ticker and rules are required" },
        { status: 400 },
      );
    }

    const rulesPayload =
      typeof rules === "object" && rules !== null
        ? { ...(rules as Record<string, unknown>), ticker }
        : { ticker };

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("strategies")
      .insert({
        user_id: userId,
        name,
        rules: rulesPayload,
      })
      .select("id, name, rules, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: data.id,
        name: data.name,
        ticker,
        rules,
        createdAt: data.created_at,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
