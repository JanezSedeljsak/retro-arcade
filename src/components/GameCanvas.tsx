import { useEffect, useRef } from "react";

export function GameCanvas({
  start,
}: {
  start: (c: HTMLCanvasElement) => () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return start(ref.current);
  }, [start]);
  return <canvas ref={ref} className="game-canvas" />;
}
