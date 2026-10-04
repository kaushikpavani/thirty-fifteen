#!/usr/bin/env node
/**
 * Generate the built-in ride music with ElevenLabs Music and wire it into the app.
 *
 *   ELEVENLABS_API_KEY=sk_... node scripts/gen-music-elevenlabs.mjs
 *
 * Reads assets/music/genres.json (one prompt per genre for the HARD track and
 * one for the EASY track), writes assets/music/<genre>/high.mp3 and low.mp3,
 * then rewrites src/audio/musicTracks.ts so the genre shows up in
 * Settings › Sound. A genre only appears once both of its tracks exist.
 *
 * It only generates what is missing, so it is safe to re-run. The API key is
 * read from the environment and never written anywhere.
 *
 * Options
 *   --dry-run            show what would be generated, the minutes and the credits; no API calls
 *   --manifest           only rewrite src/audio/musicTracks.ts from what is on disk
 *   --force              regenerate even if the file exists
 *   --genre=edm,opera    only these genres
 *   --seconds=180        override the track length in genres.json (3–600)
 *   --format=mp3_44100_128   force one output format instead of trying the best first
 *   --no-post            skip loudness matching and the loop fade (needs ffmpeg)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC_DIR = join(ROOT, 'assets', 'music');
const API = 'https://api.elevenlabs.io/v1/music';
/** Best first; the higher bitrate is gated by plan, so the script steps down if it has to. */
const FORMATS = ['mp3_44100_192', 'mp3_44100_128'];
const CREDITS_PER_MINUTE = 900;
let formatIndex = 0;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);

export function loadSpec(file = join(MUSIC_DIR, 'genres.json')) {
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  const seen = new Set();
  for (const genre of spec.genres ?? []) {
    if (!/^[a-z0-9]+$/.test(genre.id)) throw new Error(`genres.json: bad genre id "${genre.id}"`);
    if (seen.has(genre.id)) throw new Error(`genres.json: genre "${genre.id}" appears twice`);
    if (!genre.name || !genre.high || !genre.low) throw new Error(`genres.json: "${genre.id}" needs name, high and low`);
    seen.add(genre.id);
  }
  return spec;
}

export function plan(spec, filter = {}) {
  const jobs = [];
  for (const genre of spec.genres) {
    if (filter.genres && !filter.genres.includes(genre.id)) continue;
    for (const role of ['high', 'low']) {
      const seconds = Math.min(600, Math.max(3, Number(filter.seconds ?? spec.seconds?.[role] ?? 90)));
      jobs.push({ genre: genre.id, role, seconds, prompt: genre[role], instrumental: !genre.vocals, model: spec.model ?? 'music_v2_5', file: join(MUSIC_DIR, genre.id, `${role}.mp3`) });
    }
  }
  return jobs;
}

async function compose(job, apiKey) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const format = typeof args.format === 'string' ? args.format : FORMATS[formatIndex];
    const response = await fetch(`${API}?output_format=${format}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: job.prompt, music_length_ms: job.seconds * 1000, model_id: job.model, force_instrumental: job.instrumental }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const detail = (await response.text()).slice(0, 500);
    if (typeof args.format !== 'string' && formatIndex < FORMATS.length - 1 && response.status === 403 && /output_format/i.test(detail)) {
      console.log(`  ${format} isn't available on this plan; using ${FORMATS[formatIndex + 1]} instead.`);
      formatIndex += 1;
      attempt -= 1;
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${response.status} for ${job.genre}/${job.role}: ${detail}`);
  }
  throw new Error('unreachable');
}

const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

/** One loudness for every genre, and a short fade at each end so the loop point doesn't click. */
function postProcess(file, seconds) {
  const tmp = `${file}.tmp.mp3`;
  const filter = `loudnorm=I=-14:TP=-1.0:LRA=9,afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, seconds - 1.2)}:d=1.2`;
  const run = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-af', filter, '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', tmp], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  if (run.status === 0) {
    renameSync(tmp, file);
    return true;
  }
  if (existsSync(tmp)) unlinkSync(tmp);
  return false;
}

export function writeManifest(spec) {
  const out = ['/* Generated by scripts/gen-music-elevenlabs.mjs from assets/music/genres.json. Do not edit. */', ''];
  out.push('/** A genre appears here once both of its tracks have been generated. */');
  out.push('export const MUSIC_GENRES: { id: string; name: string }[] = [');
  const ready = spec.genres.filter((genre) => ['high', 'low'].every((role) => existsSync(join(MUSIC_DIR, genre.id, `${role}.mp3`))));
  for (const genre of ready) out.push(`  { id: ${JSON.stringify(genre.id)}, name: ${JSON.stringify(genre.name)} },`);
  out.push('];', '', '/** genre → the HARD track and the EASY track. */');
  out.push('export const MUSIC_TRACKS: Record<string, { high: number; low: number }> = {');
  for (const genre of ready) {
    out.push(`  ${genre.id}: { high: require('../../assets/music/${genre.id}/high.mp3'), low: require('../../assets/music/${genre.id}/low.mp3') },`);
  }
  out.push('};', '');
  writeFileSync(join(ROOT, 'src', 'audio', 'musicTracks.ts'), out.join('\n'));
  return ready.length;
}

async function main() {
  const spec = loadSpec();
  if (!args.manifest) {
    const filter = {
      genres: typeof args.genre === 'string' ? args.genre.split(',') : undefined,
      seconds: typeof args.seconds === 'string' ? Number(args.seconds) : undefined,
    };
    const all = plan(spec, filter);
    const todo = args.force ? all : all.filter((job) => !existsSync(job.file));
    const minutes = todo.reduce((sum, job) => sum + job.seconds, 0) / 60;
    console.log(`${all.length} tracks in genres.json, ${all.length - todo.length} already on disk, ${todo.length} to generate (${minutes.toFixed(1)} min, about ${Math.round(minutes * CREDITS_PER_MINUTE).toLocaleString()} credits).`);

    if (args['dry-run']) {
      for (const job of todo) console.log(`  ${job.genre}/${job.role}  ${job.seconds}s  ${job.prompt.slice(0, 70)}…`);
      console.log('Dry run: nothing was generated and nothing was charged.');
      return;
    }

    if (todo.length) {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY (ElevenLabs → Developers → API keys). It is only read from the environment.');
      const post = !args['no-post'] && hasFfmpeg();
      if (!post && !args['no-post']) console.log('ffmpeg not found: tracks are saved as ElevenLabs returns them (not loudness-matched). `brew install ffmpeg` and re-run with --force to fix.');
      let failed = 0;
      // One at a time: each track takes about a minute and they are the expensive calls.
      for (const job of todo) {
        try {
          process.stdout.write(`  ${job.genre}/${job.role} (${job.seconds}s)… `);
          const audio = await compose(job, apiKey);
          mkdirSync(dirname(job.file), { recursive: true });
          writeFileSync(job.file, audio);
          if (post) postProcess(job.file, job.seconds);
          console.log('done');
        } catch (error) {
          failed += 1;
          console.log('failed');
          console.error(`  ✗ ${error.message}`);
          if (/ 40[123] /.test(error.message)) break; // a key, plan or credit problem fails every call the same way
        }
      }
      if (failed) process.exitCode = 1;
    }
  }
  const ready = writeManifest(spec);
  console.log(`Wrote src/audio/musicTracks.ts: ${ready} of ${spec.genres.length} genres ready.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
