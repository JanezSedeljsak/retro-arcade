import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
    );
  }
  return client;
}

/**
 * Fire a minimal HEAD query to wake Supabase's free-tier container so the
 * first real leaderboard fetch doesn't pay the cold-start delay. Errors are
 * ignored — this is purely best-effort warmup.
 */
export async function pingSupabase() {
  try {
    await getSupabase()
      .from("scores")
      .select("id", { head: true, count: "exact" })
      .limit(1);
  } catch {
    // Missing .env config or network issues — nothing to do.
  }
}
