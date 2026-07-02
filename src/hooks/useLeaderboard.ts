import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Score = {
  id: number;
  game_id: string;
  username: string;
  score: number;
  created_at: string;
};

export const LEADERBOARD_USERNAME_KEY = "retro-arcade:username";

export function getStoredUsername() {
  return localStorage.getItem(LEADERBOARD_USERNAME_KEY) ?? "";
}

function fetchScores(gameId: string) {
  try {
    return getSupabase()
      .from("scores")
      .select("*")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(30);
  } catch (e) {
    return Promise.resolve({
      data: null,
      error: { message: (e as Error).message },
    });
  }
}

async function insertScore(gameId: string, username: string, score: number) {
  try {
    return await getSupabase()
      .from("scores")
      .insert({ game_id: gameId, username, score });
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

export function useLeaderboard(gameId: string) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchScores(gameId).then(({ data, error }) => {
      if (ignore) return;
      if (error) {
        setError(error.message);
      } else {
        setError(null);
        setScores(data ?? []);
      }
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [gameId]);

  async function refresh() {
    setLoading(true);
    const { data, error } = await fetchScores(gameId);

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setScores(data ?? []);
    }
    setLoading(false);
  }

  /** Returns true when the score was stored, false on error. */
  async function submitScore(username: string, score: number) {
    const { error } = await insertScore(gameId, username, score);

    if (error) {
      setError(error.message);
      return false;
    }

    localStorage.setItem(LEADERBOARD_USERNAME_KEY, username);
    await refresh();
    return true;
  }

  return { scores, loading, error, submitScore, refresh };
}
