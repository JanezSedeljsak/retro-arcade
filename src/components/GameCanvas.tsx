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
    if (!ref.current) return;
    return start(ref.current);
  }, [start]);
  return <canvas ref={ref} style={styles.canvas} />;
}
