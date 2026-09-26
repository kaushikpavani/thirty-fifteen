import { Platform } from 'react-native';
import { BED_VOLUME, DUCK_GAIN, type MusicBed } from './spirit';

const bedModules = {
  drive: require('../../assets/beds/drive.wav'),
  driveB: require('../../assets/beds/drive-b.wav'),
  recover: require('../../assets/beds/recover.wav'),
  recoverB: require('../../assets/beds/recover-b.wav'),
} as const;

const BEDS = ['drive', 'driveB', 'recover', 'recoverB'] as const;

type LockMeta = { title?: string; artist?: string };
type LockOptions = { showSeekForward?: boolean; showSeekBackward?: boolean };

type Player = {
  volume: number;
  loop: boolean;
  paused: boolean;
  playbackRate: number;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  remove: () => void;
  setActiveForLockScreen?: (active: boolean, metadata?: LockMeta, options?: LockOptions) => void;
};

type CreatePlayer = (source: number) => Player;

let ready = false;
let failed = false;
const players: Partial<Record<MusicBed, Player>> = {};

let active: MusicBed = 'recover';
let playing = false;
let enabled = true;
let duckUntil = 0;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
/** Workout is running, so a silent loop may hold the audio session when the bed is muted. */
let sessionHold = false;
let nowTitle = '30/15';
let lockKey = '';

function swallowPlay(run: () => void): void {
  if (typeof HTMLAudioElement === 'undefined') {
    run();
    return;
  }
  const proto = HTMLAudioElement.prototype;
  const original = proto.play;
  proto.play = function playWithCatch(this: HTMLAudioElement) {
    const result = original.call(this);
    if (result && typeof result.catch === 'function') result.catch(() => {});
    return result;
  };
  try {
    run();
  } finally {
    proto.play = original;
  }
}

function clearRestore(): void {
  if (restoreTimer) clearTimeout(restoreTimer);
  restoreTimer = null;
}

function audibleVolume(): number {
  const base = BED_VOLUME[active];
  return Date.now() < duckUntil ? base * DUCK_GAIN : base;
}

function applyVolume(): void {
  const heard = playing && enabled ? audibleVolume() : 0;
  for (const key of BEDS) {
    const player = players[key];
    if (!player) continue;
    try {
      player.volume = key === active ? heard : 0;
    } catch {
      // ignore
    }
  }
}

function clearLockScreen(): void {
  lockKey = '';
  for (const key of BEDS) {
    try {
      players[key]?.setActiveForLockScreen?.(false);
    } catch {
      // ignore
    }
  }
}

/**
 * Android sustained background audio needs a media session. Expo's docs require
 * setActiveForLockScreen, which itself requires doNotMix. iOS does not: the
 * playback category plus the looping bed is enough, and lock-screen controls
 * would force exclusive focus and pause the rider's other audio.
 */
function publishLockScreen(): void {
  if (Platform.OS !== 'android' || !sessionHold || !ready) return;
  const player = players[active];
  if (!player?.setActiveForLockScreen) return;
  const key = `${active}:${nowTitle}`;
  if (key === lockKey) return;
  for (const bed of BEDS) {
    if (bed === active) continue;
    try {
      players[bed]?.setActiveForLockScreen?.(false);
    } catch {
      // ignore
    }
  }
  try {
    player.setActiveForLockScreen(
      true,
      { title: nowTitle, artist: '30/15' },
      { showSeekForward: false, showSeekBackward: false },
    );
    lockKey = key;
  } catch {
    // ignore
  }
}

function startSilentHold(): void {
  const player = players[active] ?? players.recover;
  if (!player) return;
  try {
    player.loop = true;
    player.volume = 0;
    swallowPlay(() => {
      player.play();
    });
  } catch {
    // ignore
  }
  publishLockScreen();
}

/** Keep the session up after an audio-mode change. No-op when the ride is paused. */
export function kickBed(): void {
  if (!ready) return;
  if (playing && enabled) {
    const player = players[active];
    if (player?.paused) {
      swallowPlay(() => {
        player.play();
      });
    }
    publishLockScreen();
    return;
  }
  if (sessionHold) startSilentHold();
}

export function setSessionHold(hold: boolean): void {
  sessionHold = hold;
  if (!hold) clearLockScreen();
}

function scheduleRestore(): void {
  clearRestore();
  const wait = Math.max(0, duckUntil - Date.now());
  restoreTimer = setTimeout(() => {
    if (Date.now() + 20 < duckUntil) {
      scheduleRestore();
      return;
    }
    duckUntil = 0;
    applyVolume();
  }, wait);
}

/** Called once expo-audio is up. Failures stay quiet; the ride still runs. */
export function attachMusicPlayers(create: CreatePlayer): void {
  if (ready || failed) return;
  try {
    for (const key of BEDS) {
      const player = create(bedModules[key]);
      player.loop = true;
      player.volume = 0;
      players[key] = player;
    }
    ready = true;
  } catch {
    failed = true;
    for (const key of BEDS) {
      try {
        players[key]?.remove();
      } catch {
        // ignore
      }
      delete players[key];
    }
  }
}

/**
 * Web only. Play both beds inside the Start gesture so a later volume rise
 * and the drive handoff are allowed. Recover stays running at silence until
 * the clock takes the real level.
 */
export function armMusicFromGesture(musicEnabled: boolean): void {
  if (!ready || !musicEnabled) return;
  enabled = true;
  active = 'recover';
  playing = true;
  duckUntil = 0;
  for (const key of BEDS) {
    const player = players[key];
    if (!player) continue;
    try {
      player.loop = true;
      player.volume = 0;
      swallowPlay(() => {
        player.play();
      });
    } catch {
      // ignore
    }
  }
  setTimeout(() => {
    for (const key of BEDS) {
      if (key === active) continue;
      try {
        players[key]?.pause();
        void players[key]?.seekTo(0);
      } catch {
        // ignore
      }
    }
  }, 80);
}

function ensurePlaying(restart: boolean): void {
  for (const key of BEDS) {
    if (key === active) continue;
    try {
      players[key]?.pause();
    } catch {
      // ignore
    }
  }
  playing = true;
  applyVolume();
  const player = players[active];
  if (!player) return;
  const run = () => {
    swallowPlay(() => {
      player.play();
    });
  };
  if (restart) {
    void player.seekTo(0).then(run).catch(run);
    return;
  }
  run();
}

/** Keep the bed on the phase. Restarts the loop when the bed changes so the downbeat meets the chirp. */
export function syncMusic(bed: MusicBed, musicEnabled: boolean, rate = 1, title?: string): void {
  if (title) nowTitle = title;
  if (!ready) return;
  if (!musicEnabled) {
    enabled = false;
    pauseMusic();
    if (sessionHold) startSilentHold();
    return;
  }
  enabled = true;
  const next = bed;
  const changed = next !== active;
  active = next;
  const playerNow = players[active];
  if (playerNow) {
    try {
      playerNow.playbackRate = rate;
    } catch {
      // ignore
    }
  }
  if (!playing || changed) {
    ensurePlaying(changed && playing);
    publishLockScreen();
    return;
  }
  applyVolume();
  publishLockScreen();
  // A Start-tap play() can be rejected before the file is ready. Retry while
  // the element is still paused; never call play() on a bed that is already running.
  const player = players[active];
  if (player?.paused) {
    swallowPlay(() => {
      player.play();
    });
  }
}

export function pauseMusic(): void {
  playing = false;
  clearRestore();
  for (const key of BEDS) {
    try {
      players[key]?.pause();
    } catch {
      // ignore
    }
  }
  if (!sessionHold) clearLockScreen();
}

export function duckMusic(ms: number): void {
  if (!ready || !enabled || !playing || ms <= 0) return;
  duckUntil = Math.max(duckUntil, Date.now() + ms);
  applyVolume();
  scheduleRestore();
}

export function releaseDuck(): void {
  duckUntil = 0;
  clearRestore();
  if (playing && enabled) applyVolume();
}

export function stopMusic(): void {
  playing = false;
  enabled = true;
  active = 'recover';
  duckUntil = 0;
  nowTitle = '30/15';
  clearRestore();
  clearLockScreen();
  for (const key of BEDS) {
    const player = players[key];
    if (!player) continue;
    try {
      player.pause();
      player.volume = 0;
      void player.seekTo(0);
    } catch {
      // ignore
    }
  }
}

export function releaseMusicPlayers(): void {
  stopMusic();
  for (const key of BEDS) {
    try {
      players[key]?.remove();
    } catch {
      // ignore
    }
    delete players[key];
  }
  ready = false;
  failed = false;
}
