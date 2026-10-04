/**
 * The session as one continuous line: warm-up ramp, each hard effort as a
 * pulse, the rest between sets, the cool-down. Shape only, never watts
 * (targets live in Settings), and not to time scale: a 30-second rep would
 * vanish next to a 12-minute warm-up, so each part gets a fixed visual
 * weight instead.
 */
export type TracePoint = { x: number; y: number };

type Seg = { kind: string };

const LEVEL = { hard: 1, accel: 0.72, easy: 0.22, rest: 0.1, floor: 0.16 };

/** Points from left (0) to right (1); y is effort from 0 (floor) to 1 (HARD). */
export function tracePoints(segments: readonly Seg[]): TracePoint[] {
  const pts: { x: number; y: number }[] = [];
  let x = 0;
  const flat = (w: number, y: number) => {
    pts.push({ x, y }, { x: x + w, y });
    x += w;
  };
  const ramp = (w: number, from: number, to: number) => {
    pts.push({ x, y: from }, { x: x + w, y: to });
    x += w;
  };
  let first = true;
  for (const seg of segments) {
    switch (seg.kind) {
      case 'warmup':
        if (first) ramp(26, LEVEL.floor, 0.46);
        else flat(4, 0.44);
        break;
      case 'accel':
        flat(3, LEVEL.accel);
        break;
      case 'hard':
        flat(3.2, LEVEL.hard);
        break;
      case 'easy':
        flat(1.8, LEVEL.easy);
        break;
      case 'set_rest':
        flat(12, LEVEL.rest);
        break;
      case 'cooldown':
        ramp(20, 0.4, LEVEL.floor);
        break;
      default:
        break;
    }
    first = false;
  }
  if (x === 0) return [];
  return pts.map((p) => ({ x: p.x / x, y: p.y }));
}

/** SVG path for the trace inside a width × height box, with `pad` kept clear at the top for the stroke. */
export function tracePath(points: readonly TracePoint[], width: number, height: number, pad = 3): string {
  if (points.length === 0 || width <= 0 || height <= 0) return '';
  const px = (p: TracePoint) => (p.x * width).toFixed(1);
  const py = (p: TracePoint) => (height - pad - p.y * (height - 2 * pad)).toFixed(1);
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p)} ${py(p)}`).join(' ');
}
