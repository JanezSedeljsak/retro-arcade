import { useRef, useState, type PointerEvent } from "react";
import "./TouchJoystick.css";

// How far (px) the knob travels from center; tilt normalizes against this.
const TRAVEL_RADIUS = 32;

/**
 * Drag joystick for touch devices. Reports normalized tilt (-1..1 per
 * axis) through onChange, and (0, 0) when released.
 */
export function TouchJoystick({
  onChange,
}: {
  onChange: (x: number, y: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function updateFromPointer(e: PointerEvent<HTMLDivElement>) {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const clamp = distance > TRAVEL_RADIUS ? TRAVEL_RADIUS / distance : 1;
    const x = dx * clamp;
    const y = dy * clamp;
    setKnob({ x, y });
    onChange(x / TRAVEL_RADIUS, y / TRAVEL_RADIUS);
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromPointer(e);
  }

  function release(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <div
      ref={baseRef}
      className="touch-joystick"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="touch-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
