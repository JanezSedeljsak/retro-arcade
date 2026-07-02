import { Link } from "react-router-dom";
import { games } from "@/games/registry";
import "./Home.css";

export function Home() {
  return (
    <div className="home">
      <h1>Retro Arcade</h1>
      <p>Welcome to the Retro Arcade!</p>
      <ul className="game-grid">
        {games.map((game) => (
          <li key={game.id} className="game-card">
            <Link to={`/games/${game.id}`} className="game-card-link">
              <img
                src={`${import.meta.env.BASE_URL}images/game-placeholder.svg`}
                alt=""
                className="game-card-image"
              />
              <div className="game-card-info">
                <h3 className="game-card-title">{game.title}</h3>
                <p className="game-card-description">{game.description}</p>
              </div>
            </Link>
            <button type="button" className="game-card-leaderboard-btn">
              Leaderboard
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
