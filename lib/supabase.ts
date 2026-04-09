import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not set");
  }

  if (!supabaseAnonKey) {
    throw new Error("SUPABASE_ANON_KEY is not set");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
