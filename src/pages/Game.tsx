import { useParams, Link, Navigate } from "react-router-dom";
import {
  lazy,
  useEffect,
  useMemo,
  useState,
  useCallback,
  Suspense,
} from "react";
import { games, gameExportName } from "@/games/registry";
import { GameCanvas } from "@/components/GameCanvas";
import { TouchJoystick } from "@/components/TouchJoystick";
import type { BaseGame, GameConstructor } from "@/games/base";
import "./Game.css";

// Coarse pointer = touch-first device (phone/tablet) — gets on-screen controls.
const IS_TOUCH_DEVICE =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

const gameModules = import.meta.glob<Record<string, GameConstructor>>(
  "../games/*/index.ts",
);

const LeaderboardModal = lazy(() =>
  import("@/components/LeaderboardModal").then((m) => ({
    default: m.LeaderboardModal,
  })),
);

function resolveLoader(gameId: string) {
  const key = `../games/${gameId}/index.ts`;
  return gameModules[key] ?? null;
}

function LazyGame({
  gameId,
  onGameOver,
  onGameReady,
}: {
  gameId: string;
  onGameOver: (score: number) => void;
  onGameReady: (game: BaseGame | null) => void;
}) {
  const loader = resolveLoader(gameId);

  const GameModule = useMemo(() => {
    if (!loader) return null;
    return lazy(async () => {
      const mod = await loader();
      const GameClass = mod[gameExportName(gameId)];
      if (!GameClass) {
        throw new Error(
          `src/games/${gameId}/index.ts must export class ${gameExportName(gameId)}`,
        );
      }
      return {
        default: function GameHost() {
          return (
            <GameCanvas
              Game={GameClass}
              onGameOver={onGameOver}
              onGameReady={onGameReady}
            />
          );
        },
      };
    });
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!GameModule) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<p className="game-loading">Loading game…</p>}>
      <GameModule />
    </Suspense>
  );
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const meta = games.find((g) => g.id === gameId);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [game, setGame] = useState<BaseGame | null>(null);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
  }, []);

  const handleGameReady = useCallback((g: BaseGame | null) => {
    setGame(g);
  }, []);

  // kaplay's key handler is bound to the canvas, which the leaderboard modal's
  // autofocus input steals focus from. While the modal is open, listen for "r"
  // at the window level so the run can be restarted without first clicking the
  // canvas. Closes the modal and hands focus back so the canvas handler takes
  // over again for subsequent restarts.
  useEffect(() => {
    if (finalScore === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "r" && e.key !== "R") return;
      e.preventDefault();
      game?.restart();
      game?.focus();
      setFinalScore(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finalScore, game]);

  const closeLeaderboard = useCallback(() => {
    setFinalScore(null);
    game?.focus();
  }, [game]);

  if (!gameId) return <Navigate to="/" replace />;

  const showJoystick =
    IS_TOUCH_DEVICE && game !== null && game.controls.joystick;

  return (
    <div className="game-panel">
      <div className="game-header">
        <Link to="/" className="game-back-link">
          ← Back
        </Link>
        <h2 className="game-title">{meta?.title ?? gameId}</h2>
        <button
          type="button"
          className="game-reset-btn"
          onClick={() => game?.restart()}
          disabled={game === null}
        >
          Reset
        </button>
      </div>
      <div className="game-viewport">
        <LazyGame
          gameId={gameId}
          onGameOver={handleGameOver}
          onGameReady={handleGameReady}
        />
      </div>
      {showJoystick && (
        <div className="game-controls">
          <TouchJoystick onChange={(x, y) => game.setJoystickDirection(x, y)} />
        </div>
      )}
      {finalScore !== null && (
        <Suspense fallback={null}>
          <LeaderboardModal
            gameId={gameId}
            title={meta?.title ?? gameId}
            score={finalScore}
            onClose={closeLeaderboard}
          />
        </Suspense>
      )}
    </div>
  );
}
