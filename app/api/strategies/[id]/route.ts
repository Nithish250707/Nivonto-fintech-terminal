import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

function getStrategyIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];
  return id || null;
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const strategyId = getStrategyIdFromPath(request.nextUrl.pathname);
    if (!strategyId) {
      return NextResponse.json({ error: "Strategy id is required" }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("strategies")
      .delete()
      .eq("id", strategyId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
