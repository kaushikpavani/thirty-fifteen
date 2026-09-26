import { cuesDue, type DueCue } from './cueCatchup';
import { stepPlayhead, type PlayheadStep } from './wallClock';
import type { RockySegment } from '../audio/rocky';

export type CatchUpPlan = {
  step: PlayheadStep;
  cues: DueCue[];
};

/**
 * Cues for one wall-clock sample. The timer and a foreground return both use this.
 * Fired keys passed in are not returned again.
 */
export function planCatchUp(args: {
  segments: RockySegment[];
  fromMs: number;
  wallMs: number;
  totalMs: number;
  firedClock: ReadonlySet<string>;
  firedRocky: ReadonlySet<string>;
  salt?: number;
}): CatchUpPlan {
  const step = stepPlayhead(args.fromMs, args.wallMs, args.totalMs);
  if (!step.deliver) return { step, cues: [] };
  return {
    step,
    cues: cuesDue({
      segments: args.segments,
      fromMs: step.fromMs,
      toMs: step.toMs,
      firedClock: args.firedClock,
      firedRocky: args.firedRocky,
      salt: args.salt,
    }),
  };
}
