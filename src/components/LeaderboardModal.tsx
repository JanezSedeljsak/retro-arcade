import { useEffect, useState, type FormEvent } from "react";
import { getStoredUsername, useLeaderboard } from "@/hooks/useLeaderboard";
import { games } from "@/games/registry";
import { CloseIcon } from "@/components/Icons";
import { formatDateTime } from "@/lib/utils";
import "./LeaderboardModal.css";

type LeaderboardModalProps = {
  gameId: string;
  title: string;
  onClose: () => void;
  score?: number;
};

export function LeaderboardModal({
  gameId,
  title,
  onClose,
  score,
}: LeaderboardModalProps) {
  const { scores, loading, error, submitScore } = useLeaderboard(gameId);
  // Time-based games store negated elapsed seconds — shown as "Time".
  const isTimeBased = games.find((g) => g.id === gameId)?.isTimeBased ?? false;
  const [username, setUsername] = useState(getStoredUsername);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // An unsubmitted score is easy to lose to a stray tap or keypress right
  // after a game ends — while the form is up, only the X button closes.
  const showForm = score !== undefined && !submitted;

  useEffect(() => {
    if (showForm) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showForm]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || submitted) return;
    if (!username.trim() || score === undefined) return;
    setSubmitting(true);
    const ok = await submitScore(username.trim(), score);
    setSubmitting(false);
    // Stay on the form after a failed submit so the score can be retried.
    setSubmitted(ok);
  }

  return (
    <div
      className="leaderboard-overlay"
      onClick={showForm ? undefined : onClose}
    >
      <div
        className="retro-panel leaderboard-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leaderboard-modal-header">
          <h2>{title} Leaderboard</h2>
          <button
            type="button"
            className="leaderboard-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {showForm && (
          <form className="leaderboard-submit" onSubmit={handleSubmit}>
            <p className="leaderboard-score">
              {isTimeBased
                ? `You finished in ${Math.abs(score)}s!`
                : `You scored ${score}!`}
            </p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={12}
              required
              autoFocus
            />
            <button type="submit" className="default-btn" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Score"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="leaderboard-status">Loading…</p>
        ) : error ? (
          <p className="leaderboard-status">{error}</p>
        ) : scores.length === 0 ? (
          <p className="leaderboard-status">No scores yet.</p>
        ) : (
          <>
            <div className="leaderboard-list-header">
              <span className="leaderboard-rank">#</span>
              <span className="leaderboard-name">Player</span>
              <span className="leaderboard-date">Date</span>
              <span className="leaderboard-points">
                {isTimeBased ? "Time" : "Score"}
              </span>
            </div>
            <ol className="leaderboard-list">
              {scores.map((s, i) => (
                <li key={s.id}>
                  <span className="leaderboard-rank">{i + 1}</span>
                  <span className="leaderboard-name">{s.username}</span>
                  <span className="leaderboard-date">
                    {formatDateTime(s.created_at)}
                  </span>
                  <span className="leaderboard-points">
                    {isTimeBased ? `${Math.abs(s.score)}s` : s.score}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
