export type GameMeta = {
  id: string;
  title: string;
  description: string;
  /** Score is elapsed seconds (lower = better) — leaderboard shows "Time". */
  isTimeBased?: boolean;
};

/**
 * The class name a game module must export, derived from its id:
 * "space-invaders" → "SpaceInvadersGame". Game.tsx resolves the export by
 * this name and registry.test.ts enforces it.
 */
export function gameExportName(gameId: string) {
  return (
    gameId
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("") + "Game"
  );
}

export const games: GameMeta[] = [
  {
    id: "pong",
    title: "Pong",
    description:
      "Classic paddle game — beat the bot to 5! W/S, arrows, or the joystick.",
    isTimeBased: true,
  },
  {
    id: "space-invaders",
    title: "Space Invaders",
    description: "Defend Earth from endless waves of invading aliens.",
    isTimeBased: true,
  },
  {
    id: "whirlybird",
    title: "Whirlybird",
    description: "Navigate your plane through the skies and avoid obstacles.",
  },
  {
    id: "stacktower",
    title: "Stack Tower",
    description: "Build the tallest tower by stacking blocks without toppling.",
  },
];
