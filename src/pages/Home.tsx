import { Link } from "react-router-dom";
import { games } from "@/games/registry";

export function Home() {
  return (
    <div className="home">
      <h1>Retro Arcade</h1>
      <p>Welcome to the Retro Arcade!</p>
      <ul className="game-grid">
        {games.map((game) => (
          <li key={game.id} className="game-card">
            <Link to={`/games/${game.id}`} className="game-card-link">
              <h3 className="game-card-title">{game.title}</h3>
              <p className="game-card-description">{game.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
