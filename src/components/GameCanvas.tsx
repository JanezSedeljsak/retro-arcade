import { useEffect, useRef, type CSSProperties } from "react";

const styles: { canvas: CSSProperties } = {
  canvas: {
    maxWidth: "100%",
    maxHeight: "100%",
  },
};

export function GameCanvas({
  start,
}: {
  start: (c: HTMLCanvasElement) => () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // StrictMode double-invokes this effect in dev (mount, cleanup, mount)
    // synchronously before the next paint. kaplay() can't be safely called
    // twice in a row - it leaves stale global state and its GL teardown is
    // deferred to the next frame - so defer the real init past that paint.
    // A genuine StrictMode remount cancels this rAF before it fires, and a
    // real single mount just runs one frame later.
    let cleanup: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      cleanup = start(canvas);
    });

    return () => {
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [start]);
  return <canvas ref={ref} style={styles.canvas} />;
}
