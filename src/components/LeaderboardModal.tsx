import { useEffect, useState, type FormEvent } from "react";
import { getStoredUsername, useLeaderboard } from "@/hooks/useLeaderboard";
import { games } from "@/games/registry";
import "./LeaderboardModal.css";

function formatTimestamp(isoDate: string) {
  const d = new Date(isoDate);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.toLocaleDateString("sl")} ${hours}:${minutes}`;
}

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  const showForm = score !== undefined && !submitted;

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
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
            ×
          </button>
        </div>

        {showForm && (
          <form className="leaderboard-submit" onSubmit={handleSubmit}>
            <p className="leaderboard-score">
              {isTimeBased
                ? `You finished in ${Math.abs(score)}s!`
                : `You scored ${Math.abs(score)}!`}
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
                    {formatTimestamp(s.created_at)}
                  </span>
                  <span className="leaderboard-points">
                    {Math.abs(s.score)}
                    {isTimeBased ? "s" : ""}
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
