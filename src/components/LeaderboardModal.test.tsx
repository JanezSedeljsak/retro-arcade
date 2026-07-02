import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaderboardModal } from "@/components/LeaderboardModal";
import { useLeaderboard } from "@/hooks/useLeaderboard";

vi.mock("@/hooks/useLeaderboard", () => ({
  useLeaderboard: vi.fn(),
  getStoredUsername: vi.fn(() => ""),
}));

const mockedUseLeaderboard = vi.mocked(useLeaderboard);

function mockLeaderboard(
  overrides: Partial<ReturnType<typeof useLeaderboard>> = {},
) {
  const submitScore = vi.fn().mockResolvedValue(true);
  mockedUseLeaderboard.mockReturnValue({
    scores: [],
    loading: false,
    error: null,
    submitScore,
    refresh: vi.fn(),
    ...overrides,
  });
  return { submitScore };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LeaderboardModal", () => {
  it("shows a loading message while scores are loading", () => {
    mockLeaderboard({ loading: true });
    render(<LeaderboardModal gameId="pong" title="Pong" onClose={vi.fn()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the error message when loading fails", () => {
    mockLeaderboard({ loading: false, error: "network down" });
    render(<LeaderboardModal gameId="pong" title="Pong" onClose={vi.fn()} />);
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("shows an empty state when there are no scores", () => {
    mockLeaderboard({ scores: [] });
    render(<LeaderboardModal gameId="pong" title="Pong" onClose={vi.fn()} />);
    expect(screen.getByText("No scores yet.")).toBeInTheDocument();
  });

  it("renders scores for a points-based game", () => {
    mockLeaderboard({
      scores: [
        {
          id: 1,
          game_id: "whirlybird",
          username: "Neo",
          score: 99,
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    });
    render(
      <LeaderboardModal
        gameId="whirlybird"
        title="Whirlybird"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Neo")).toBeInTheDocument();
    expect(screen.getByText("99")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
  });

  it("renders elapsed time for a time-based game", () => {
    mockLeaderboard({
      scores: [
        {
          id: 1,
          game_id: "pong",
          username: "Trinity",
          score: -37,
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    });
    render(<LeaderboardModal gameId="pong" title="Pong" onClose={vi.fn()} />);
    expect(screen.getByText("37s")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
  });

  it("calls onClose on Escape and on overlay click, not on panel click", () => {
    mockLeaderboard();
    const onClose = vi.fn();
    render(<LeaderboardModal gameId="pong" title="Pong" onClose={onClose} />);

    fireEvent.click(screen.getByText("Pong Leaderboard"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByLabelText("Close").closest(".leaderboard-overlay")!,
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("submits a score with the entered username and hides the form on success", async () => {
    const user = userEvent.setup();
    const { submitScore } = mockLeaderboard();
    render(
      <LeaderboardModal
        gameId="whirlybird"
        title="Whirlybird"
        onClose={vi.fn()}
        score={42}
      />,
    );

    expect(screen.getByText("You scored 42!")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Enter your name"), "Neo");
    await user.click(screen.getByRole("button", { name: "Submit Score" }));

    expect(submitScore).toHaveBeenCalledWith("Neo", 42);
    expect(
      screen.queryByPlaceholderText("Enter your name"),
    ).not.toBeInTheDocument();
  });

  it("keeps the form visible after a failed submit so it can be retried", async () => {
    const user = userEvent.setup();
    mockLeaderboard({ submitScore: vi.fn().mockResolvedValue(false) });
    render(
      <LeaderboardModal
        gameId="pong"
        title="Pong"
        onClose={vi.fn()}
        score={7}
      />,
    );

    await user.type(screen.getByPlaceholderText("Enter your name"), "Neo");
    await user.click(screen.getByRole("button", { name: "Submit Score" }));

    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });
});
