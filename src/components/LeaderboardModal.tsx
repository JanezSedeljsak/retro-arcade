import { useEffect, useState, type FormEvent } from "react";
import { getStoredUsername, useLeaderboard } from "@/hooks/useLeaderboard";
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
  const [username, setUsername] = useState(getStoredUsername);
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
    if (!username.trim() || score === undefined) return;
    await submitScore(username.trim(), score);
    setSubmitted(true);
  }

  const showForm = score !== undefined && !submitted;

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
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
            <p className="leaderboard-score">You scored {Math.abs(score)}!</p>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              required
              autoFocus
            />
            <button type="submit">Submit Score</button>
          </form>
        )}

        {loading ? (
          <p className="leaderboard-status">Loading…</p>
        ) : error ? (
          <p className="leaderboard-status">{error}</p>
        ) : scores.length === 0 ? (
          <p className="leaderboard-status">No scores yet.</p>
        ) : (
          <ol className="leaderboard-list">
            {scores.map((s, i) => (
              <li key={s.id}>
                <span className="leaderboard-rank">{i + 1}</span>
                <span className="leaderboard-name">{s.username}</span>
                <span className="leaderboard-points">{Math.abs(s.score)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
