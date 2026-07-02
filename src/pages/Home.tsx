import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { games } from "@/games/registry";
import character from "@/assets/character.webp";
import "./Home.css";

const LeaderboardModal = lazy(() =>
  import("@/components/LeaderboardModal").then((m) => ({
    default: m.LeaderboardModal,
  })),
);

export function Home() {
  const [openGameId, setOpenGameId] = useState<string | null>(null);
  const openGame = games.find((g) => g.id === openGameId);

  return (
    <div className="home">
      <h1>
        Retr
        <img src={character} alt="o" className="home-title-o" /> Arcade
      </h1>
      <p>Welcome to the Retro Arcade!</p>
      <ul className="game-grid">
        {games.map((game) => (
          <li key={game.id} className="retro-panel game-card">
            <Link to={`/games/${game.id}`} className="game-card-link">
              <img
                src={`${import.meta.env.BASE_URL}images/game-placeholder.svg`}
                alt=""
                className="game-card-image"
              />
              <div className="game-card-info">
                <h2 className="game-card-title">{game.title}</h2>
                <p className="game-card-description">{game.description}</p>
              </div>
            </Link>
            <button
              type="button"
              className="default-btn game-card-leaderboard-btn"
              onClick={() => setOpenGameId(game.id)}
            >
              Leaderboard
            </button>
          </li>
        ))}
      </ul>
      {openGame && (
        <Suspense fallback={null}>
          <LeaderboardModal
            gameId={openGame.id}
            title={openGame.title}
            onClose={() => setOpenGameId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
