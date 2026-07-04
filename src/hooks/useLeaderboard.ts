import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

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

async function fetchScores(gameId: string) {
  try {
    const { data, error } = await getSupabase().rpc("top_scores", {
      p_game_id: gameId,
    });

    if (error) {
      console.error("Error loading scores:", error);
      return { data: null, error };
    }

    return { data: (data ?? []) as Score[], error: null };
  } catch (e) {
    return {
      data: null,
      error: { message: getErrorMessage(e) },
    };
  }
}

async function insertScore(gameId: string, username: string, score: number) {
  try {
    return await getSupabase()
      .from("scores")
      .insert({ game_id: gameId, username, score });
  } catch (e) {
    return { error: { message: getErrorMessage(e) } };
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
