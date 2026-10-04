import { Platform } from 'react-native';
import {
  INITIAL_REMOTE_STATE,
  isSuppressedEcho,
  reduceRemoteTransport,
  type RemoteState,
  type RemoteStatus,
} from './remoteTransport';
import { MUSIC_GENRES, MUSIC_TRACKS } from './musicTracks';
import { BED_VOLUME, DUCK_GAIN, type MusicBed } from './spirit';

const bedModules = {
  drive: require('../../assets/beds/drive.wav'),
  driveB: require('../../assets/beds/drive-b.wav'),
  recover: require('../../assets/beds/recover.wav'),
  recoverB: require('../../assets/beds/recover-b.wav'),
  ambient: require('../../assets/beds/ambient.wav'),
} as const;

const BEDS = ['drive', 'driveB', 'recover', 'recoverB', 'ambient'] as const;

/** The original synthesised score. Only used until generated genres are installed. */
export const PULSE = 'pulse';

/** What the picker offers: the generated genres, or Pulse alone while there are none. */
export function musicGenres(): { id: string; name: string }[] {
  return MUSIC_GENRES.length ? MUSIC_GENRES : [{ id: PULSE, name: 'Pulse' }];
}

/** The genre that will actually play for a stored choice: itself if installed, else the first installed one. */
export function resolveGenre(choice: string | null | undefined): string {
  const list = musicGenres();
  return list.some((entry) => entry.id === choice) ? (choice as string) : list[0]!.id;
}

/**
 * The file behind each bed for a genre. A generated genre has two tracks:
 * `high` for HARD, `low` for everything else (EASY, warm-up, rest, cool-down;
 * the quieter parts just play it softer).
 */
function sourcesFor(genre: string): Record<MusicBed, number> {
  const tracks = MUSIC_TRACKS[genre];
  if (!tracks) return bedModules;
  return { drive: tracks.high, driveB: tracks.high, recover: tracks.low, recoverB: tracks.low, ambient: tracks.low };
}

type LockMeta = { title?: string; artist?: string };
type LockOptions = { showSeekForward?: boolean; showSeekBackward?: boolean };

type PlaybackEvent = {
  playing?: boolean;
  didJustFinish?: boolean;
};

type StatusSubscription = { remove: () => void };

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
  addListener?: (event: 'playbackStatusUpdate', listener: (status: PlaybackEvent) => void) => StatusSubscription;
};

type CreatePlayer = (source: number) => Player;

let ready = false;
let failed = false;
const players: Partial<Record<MusicBed, Player>> = {};
let genre = PULSE;
let createPlayer: CreatePlayer | null = null;

let active: MusicBed = 'recover';
let playing = false;
let enabled = true;
let duckUntil = 0;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
/** Workout is running, so a silent loop may hold the audio session when the bed is muted. */
let sessionHold = false;
let nowTitle = '30/15';
let lockKey = '';
let suppressRemoteUntil = 0;
let suppressExpect: boolean | null = null;
let remoteState: RemoteState = INITIAL_REMOTE_STATE;
let statusSub: StatusSubscription | null = null;
let transportHandler: ((intent: 'pause' | 'resume') => void) | null = null;

const REMOTE_SUPPRESS_MS = 800;

function suppressRemote(expectPlaying: boolean): void {
  suppressRemoteUntil = Date.now() + REMOTE_SUPPRESS_MS;
  suppressExpect = expectPlaying;
}

function clearStatusListener(): void {
  try {
    statusSub?.remove();
  } catch {
    // ignore
  }
  statusSub = null;
  remoteState = INITIAL_REMOTE_STATE;
  suppressExpect = null;
}

function remoteStatus(event: PlaybackEvent): RemoteStatus | null {
  if (typeof event.playing !== 'boolean') return null;
  return {
    playing: event.playing,
    didJustFinish: event.didJustFinish,
  };
}

function listenForRemote(player: Player): void {
  clearStatusListener();
  if (!player.addListener) return;
  statusSub = player.addListener('playbackStatusUpdate', (event) => {
    const status = remoteStatus(event);
    if (!status) return;
    const echo = isSuppressedEcho(Date.now(), suppressRemoteUntil, suppressExpect, status.playing);
    const step = reduceRemoteTransport(remoteState, status, echo);
    remoteState = step.state;
    if (!step.intent || !transportHandler) return;
    suppressRemote(step.intent === 'play');
    transportHandler(step.intent === 'pause' ? 'pause' : 'resume');
  });
}

/** Android notification play/pause. iOS has no lock-screen session. */
export function setBedTransportHandler(handler: ((intent: 'pause' | 'resume') => void) | null): void {
  transportHandler = handler;
}

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
      player.volume = player === players[active] ? heard : 0;
    } catch {
      // ignore
    }
  }
}

function clearLockScreen(): void {
  lockKey = '';
  clearStatusListener();
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
    listenForRemote(player);
  } catch {
    // ignore
  }
}

function startSilentHold(): void {
  const player = players[active] ?? players.recover;
  if (!player) return;
  suppressRemote(true);
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
      suppressRemote(true);
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
  createPlayer = create;
  if (ready || failed) return;
  try {
    const sources = sourcesFor(genre);
    // A generated genre uses one track for two beds; share the player so it carries on rather than restarting.
    const bySource = new Map<number, Player>();
    for (const key of BEDS) {
      const player = bySource.get(sources[key]) ?? create(sources[key]);
      bySource.set(sources[key], player);
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

/** Switch the built-in music style. Takes effect straight away; a no-op if it is already loaded. */
export function setMusicGenre(choice: string | null | undefined): void {
  const next = resolveGenre(choice);
  if (next === genre) return;
  genre = next;
  if (!ready || !createPlayer) return;
  const create = createPlayer;
  releaseMusicPlayers();
  attachMusicPlayers(create);
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
      if (key === active || players[key] === players[active]) continue;
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
    if (key === active || players[key] === players[active]) continue;
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
    suppressRemote(true);
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
    // Pulse loops are cut to the phase, so they restart on the downbeat. Generated tracks are
    // full pieces: each one picks up where it left off, so a ride moves through the music.
    ensurePlaying(changed && playing && genre === PULSE);
    publishLockScreen();
    return;
  }
  applyVolume();
  publishLockScreen();
  // Web only. A Start tap can be rejected before the file is ready.
  // On native, retrying play() every tick fights a phone-call interruption
  // and a lock-screen pause. Those recover on the next foreground or resume.
  const player = players[active];
  if (Platform.OS === 'web' && player?.paused) {
    suppressRemote(true);
    swallowPlay(() => {
      player.play();
    });
  }
}

export function pauseMusic(): void {
  playing = false;
  suppressRemote(false);
  clearRestore();
  for (const key of BEDS) {
    try {
      players[key]?.pause();
    } catch {
      // ignore
    }
  }
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
  suppressRemote(false);
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
