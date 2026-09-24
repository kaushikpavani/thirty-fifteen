export type PhaseKind =
  | 'warmup'
  | 'accel'
  | 'hard'
  | 'easy'
  | 'set_rest'
  | 'cooldown'
  | 'done';

export interface WorkoutSettings {
  ftpWatts: number;
  hardPct: number;
  easyPct: number;
  warmupMin: number;
  sets: number;
  reps: number;
  workSec: number;
  recoverSec: number;
  betweenSetRestMin: number;
  cooldownMin: number;
  speechEnabled: boolean;
  voiceRate: number;
  cueLeadMs: number;
  beepsEnabled: boolean;
  hapticsEnabled: boolean;
}

export interface Segment {
  id: string;
  kind: PhaseKind;
  durationMs: number;
  label: string;
  /** Spoken when this segment starts (or shortly after) */
  startCue?: string;
  /** Spoken ~cueLeadMs before this segment ends, announcing what's next */
  endCue?: string;
  setNumber?: number;
  repNumber?: number;
  targetWatts?: number;
  targetHint?: string;
}

export interface BuiltWorkout {
  segments: Segment[];
  totalMs: number;
  hardWatts: number;
  easyWatts: number;
}

export type AppScreen = 'home' | 'active' | 'settings' | 'about';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';
