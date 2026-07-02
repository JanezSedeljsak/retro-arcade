import { useParams, Link, Navigate } from "react-router-dom";
import { lazy, useMemo, useState, useCallback, Suspense } from "react";
import { games, gameExportName } from "@/games/registry";
import { GameCanvas } from "@/components/GameCanvas";
import type { GameConstructor } from "@/games/base";
import "./Game.css";

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
}: {
  gameId: string;
  onGameOver: (score: number) => void;
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
          return <GameCanvas Game={GameClass} onGameOver={onGameOver} />;
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

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
  }, []);

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
        <LazyGame gameId={gameId} onGameOver={handleGameOver} />
      </div>
      {finalScore !== null && (
        <Suspense fallback={null}>
          <LeaderboardModal
            gameId={gameId}
            title={meta?.title ?? gameId}
            score={finalScore}
            onClose={() => setFinalScore(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
