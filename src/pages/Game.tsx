import { useParams, Link, Navigate } from "react-router-dom";
import { lazy, useMemo, Suspense } from "react";
import { games } from "@/games/registry";
import { GameCanvas } from "@/components/GameCanvas";
import "./Game.css";

const gameModules = import.meta.glob<{
  start: (c: HTMLCanvasElement) => () => void;
}>("../games/*/index.ts");

function resolveLoader(gameId: string) {
  const key = `../games/${gameId}/index.ts`;
  return gameModules[key] ?? null;
}

function LazyGame({ gameId }: { gameId: string }) {
  const loader = resolveLoader(gameId);

  const GameModule = useMemo(() => {
    if (!loader) return null;
    return lazy(async () => {
      const mod = await loader();
      return {
        default: function Game() {
          return <GameCanvas start={mod.start} />;
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

  if (!gameId) return <Navigate to="/" replace />;

  return (
    <div className="game-panel">
      <div className="game-header">
        <Link to="/" className="game-back-link">
          ← Back
        </Link>
        <h2 className="game-title">{meta?.title ?? gameId}</h2>
      </div>
      <div className="game-viewport">
        <LazyGame gameId={gameId} />
      </div>
    </div>
  );
}
