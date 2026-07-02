import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useLeaderboard,
  getStoredUsername,
  LEADERBOARD_USERNAME_KEY,
} from "@/hooks/useLeaderboard";
import { getSupabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(),
}));

const mockedGetSupabase = vi.mocked(getSupabase);

function mockSupabase({
  rpcResult = { data: [], error: null },
  insertResult = { error: null },
}: {
  rpcResult?: { data: unknown; error: unknown };
  insertResult?: { error: unknown };
} = {}) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const from = vi.fn().mockReturnValue({ insert });
  mockedGetSupabase.mockReturnValue({ rpc, from } as never);
  return { rpc, from, insert };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("getStoredUsername", () => {
  it("returns an empty string when nothing is stored", () => {
    expect(getStoredUsername()).toBe("");
  });

  it("returns the stored username", () => {
    localStorage.setItem(LEADERBOARD_USERNAME_KEY, "Neo");
    expect(getStoredUsername()).toBe("Neo");
  });
});

describe("useLeaderboard", () => {
  it("starts loading and populates scores on success", async () => {
    const scores = [
      {
        id: 1,
        game_id: "pong",
        username: "Neo",
        score: 10,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    const { rpc } = mockSupabase({ rpcResult: { data: scores, error: null } });

    const { result } = renderHook(() => useLeaderboard("pong"));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.scores).toEqual(scores);
    expect(result.current.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("top_scores", { p_game_id: "pong" });
  });

  it("surfaces an error message when the fetch fails", async () => {
    mockSupabase({ rpcResult: { data: null, error: { message: "boom" } } });

    const { result } = renderHook(() => useLeaderboard("pong"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("boom");
    expect(result.current.scores).toEqual([]);
  });

  it("submitScore stores the username and refreshes on success", async () => {
    const { from } = mockSupabase();
    const { result } = renderHook(() => useLeaderboard("pong"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = false;
    await act(async () => {
      ok = await result.current.submitScore("Neo", 42);
    });

    expect(ok).toBe(true);
    expect(getStoredUsername()).toBe("Neo");
    expect(from).toHaveBeenCalledWith("scores");
  });

  it("submitScore fails without storing the username", async () => {
    mockSupabase({ insertResult: { error: { message: "insert failed" } } });
    const { result } = renderHook(() => useLeaderboard("pong"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.submitScore("Neo", 42);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe("insert failed");
    expect(getStoredUsername()).toBe("");
  });
});
