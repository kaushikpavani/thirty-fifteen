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
  /** Unused for speech. The cue clock beeps at T−3 and chirps at the flip. */
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

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface WorkoutRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  plannedDurationMs: number;
  ftpWatts: number;
  hardWatts: number;
  easyWatts: number;
  completed: boolean;
  completionPct: number;
}

export type NewWorkoutRecord = Omit<WorkoutRecord, 'id'>;

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  provider: string;
}
