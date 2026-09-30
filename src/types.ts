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
  /** Looping bed under the ride. Default on. Spoken cues and beeps still duck it. */
  musicEnabled: boolean;
  /** Which recorded coach speaks. 'off' keeps ticks and haptics only. */
  coachVoice: CoachVoice;
  /** The coach counts "Three, two, one" into every HARD. */
  spokenCount: boolean;
  /** Optional profile fields, entered once, used only for the VO2max estimate. */
  ageYears?: number | null;
  sex?: 'male' | 'female' | null;
  weightLb?: number | null;
  restingHr?: number | null;
  /** True once the rider has seen the post-sign-in "tell us about you" prompt, whether they filled it in or skipped. */
  profilePromptSeen?: boolean;
}

export type CoachVoice = 'calm' | 'direct' | 'numbers' | 'off';

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

/** Aggregates saved with a finished ride. Sensor fields stay empty when nothing was connected. */
export interface RideSummary {
  setsDone: number;
  setsPlanned: number;
  durationMs: number;
  hardMs: number;
  easyMs: number;
  avgWatts: number | null;
  peakWatts: number | null;
  avgHardWatts: number | null;
  avgEasyWatts: number | null;
  workKj: number | null;
  sparkline: number[];
  avgBpm: number | null;
  maxBpm: number | null;
  avgHardBpm: number | null;
  avgEasyBpm: number | null;
  /** Average watts for each HARD rep that had samples, in ride order. Empty without a meter. */
  repWatts?: number[];
  /** Average heart rate for each HARD rep that had samples, in ride order. Empty without a strap. */
  repBpm?: number[];
  /** Hard-effort watts per heartbeat (avgHardWatts / avgHardBpm). Needs both a power meter and a strap. */
  efficiencyFactor?: number | null;
  /**
   * How much watts-per-heartbeat fell from the first half of hard reps to the
   * second half, as a percent of the first half. Positive means your heart
   * worked harder for the same watts as the ride went on. Null without
   * enough paired reps to split in half.
   */
  decouplingPct?: number | null;
}

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
  summary?: RideSummary;
}

export type NewWorkoutRecord = Omit<WorkoutRecord, 'id'>;

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  provider: string;
}
