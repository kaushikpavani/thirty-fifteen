#!/usr/bin/env node
/**
 * Generate the coach voices with ElevenLabs and wire them into the app.
 *
 *   ELEVENLABS_API_KEY=sk_... node scripts/gen-voice-elevenlabs.mjs
 *
 * Reads every assets/voice/script.<lang>.json (one per language: the lines,
 * the two coaches and their ElevenLabs voice ids), writes one MP3 per take to
 * assets/voice/<lang>/<coach>/<clip>.<take>.mp3, then rewrites the two
 * generated files the app imports:
 *
 *   src/audio/voiceClips.ts   which audio file plays for each clip
 *   src/audio/coachLines.ts   the words, for the on-device fallback voice
 *
 * It only generates what is missing, so it is safe to re-run after a failure
 * or after adding lines. The API key is read from the environment and never
 * written anywhere.
 *
 * Options
 *   --dry-run          show what would be generated and the character count; no API calls
 *   --manifest         only rewrite the two generated .ts files from what is on disk
 *   --force            regenerate even if the file exists
 *   --lang=en          one language
 *   --coach=female     one coach
 *   --only=hard,easy   only clips starting with these prefixes
 *   --model=eleven_v4  override the model in the script file
 *   --no-post          skip trimming and loudness matching (needs ffmpeg)
 *   --format=mp3_44100_128   force one output format instead of trying the best first
 *
 * To add a language: copy script.en.json to script.<code>.json, translate the
 * "text" of each line, set "language"/"name", choose voice ids, run this.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = join(ROOT, 'assets', 'voice');
const API = 'https://api.elevenlabs.io/v1/text-to-speech';
/**
 * Best first. ElevenLabs gates the higher bitrate by plan (192 kbps needs Creator or above),
 * so if the account can't have it the script drops to the next one and says so.
 */
const FORMATS = ['mp3_44100_192', 'mp3_44100_128'];
let formatIndex = 0;
const CONCURRENCY = 3;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);

/** Clips recorded before this script existed. Used only until the new take is generated. */
const LEGACY_COACH = { female: 'direct', male: 'calm' };
function legacyClip(clip) {
  if (/^warmup\d+$/.test(clip)) return 'welcome';
  if (/^rest\d+$/.test(clip)) return 'round0';
  if (/^cooldown\d+$/.test(clip)) return 'finish0';
  return clip;
}

export function loadScripts(dir = VOICE_DIR) {
  return readdirSync(dir)
    .filter((name) => /^script\.[a-z-]+\.json$/i.test(name))
    .sort()
    .map((name) => {
      const doc = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (!doc.language || !doc.name || !doc.coaches || !Array.isArray(doc.lines)) {
        throw new Error(`${name}: needs "language", "name", "coaches" and "lines"`);
      }
      const seen = new Set();
      for (const line of doc.lines) {
        if (!/^[a-z0-9]+$/i.test(line.clip)) throw new Error(`${name}: bad clip name "${line.clip}"`);
        if (seen.has(line.clip)) throw new Error(`${name}: clip "${line.clip}" appears twice`);
        if (!line.text?.trim()) throw new Error(`${name}: clip "${line.clip}" has no text`);
        seen.add(line.clip);
      }
      return doc;
    });
}

/** Every file the scripts call for. */
export function plan(scripts, filter = {}) {
  const jobs = [];
  for (const doc of scripts) {
    if (filter.lang && doc.language !== filter.lang) continue;
    for (const [coach, info] of Object.entries(doc.coaches)) {
      if (filter.coach && coach !== filter.coach) continue;
      for (const line of doc.lines) {
        if (filter.only && !filter.only.some((prefix) => line.clip.startsWith(prefix))) continue;
        const style = doc.styles?.[line.style] ?? '';
        for (let take = 1; take <= (line.takes ?? 1); take++) {
          jobs.push({
            language: doc.language,
            coach,
            voiceId: info.voiceId,
            model: filter.model ?? doc.model ?? 'eleven_v4',
            clip: line.clip,
            take,
            text: `${style} ${line.text}`.trim(),
            file: join(VOICE_DIR, doc.language, coach, `${line.clip}.${take}.mp3`),
          });
        }
      }
    }
  }
  return jobs;
}

async function synthesize(job, apiKey) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const format = typeof args.format === 'string' ? args.format : FORMATS[formatIndex];
    const response = await fetch(`${API}/${job.voiceId}?output_format=${format}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: job.text, model_id: job.model, language_code: job.language }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const detail = (await response.text()).slice(0, 400);
    // The plan doesn't include this bitrate: step down for the whole run and try again. Several
    // requests are in flight at once, so one that was sent before the step-down just retries.
    const formatRefused = typeof args.format !== 'string' && response.status === 403 && /output_format/i.test(detail);
    if (formatRefused && (format !== FORMATS[formatIndex] || formatIndex < FORMATS.length - 1)) {
      if (format === FORMATS[formatIndex]) {
        console.log(`  ${format} isn't available on this plan; using ${FORMATS[formatIndex + 1]} instead.`);
        formatIndex += 1;
      }
      attempt -= 1;
      continue;
    }
    // Busy or rate-limited: wait and try again. Anything else is a real error.
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${response.status} for ${job.clip}.${job.take}: ${detail}`);
  }
  throw new Error('unreachable');
}

const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

/** Trim the silence at each end and match loudness, so cues land on time and at one level. */
function postProcess(file) {
  const tmp = `${file}.tmp.mp3`;
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02';
  const filter = `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.005`;
  const run = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-i', file, '-af', filter, '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '192k', tmp],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (run.status === 0) {
    renameSync(tmp, file);
    return true;
  }
  if (existsSync(tmp)) unlinkSync(tmp);
  return false;
}

/** The app's two generated files, from what is actually on disk. */
export function writeManifest(scripts) {
  const rel = (file) => relative(join(ROOT, 'src', 'audio'), file).split('\\').join('/');
  const clipsOut = ['/* Generated by scripts/gen-voice-elevenlabs.mjs. Do not edit. */', '', '/** language → coach → clip → takes. */'];
  clipsOut.push('export const VOICE_CLIPS: Record<string, Record<string, Record<string, number[]>>> = {');
  let fresh = 0;
  let legacy = 0;
  let missing = 0;
  for (const doc of scripts) {
    clipsOut.push(`  ${JSON.stringify(doc.language)}: {`);
    for (const coach of Object.keys(doc.coaches)) {
      clipsOut.push(`    ${coach}: {`);
      for (const line of doc.lines) {
        const takes = [];
        for (let take = 1; take <= (line.takes ?? 1); take++) {
          const file = join(VOICE_DIR, doc.language, coach, `${line.clip}.${take}.mp3`);
          if (existsSync(file)) takes.push(file);
        }
        if (takes.length) fresh += 1;
        else {
          const old = join(VOICE_DIR, LEGACY_COACH[coach] ?? '', `${legacyClip(line.clip)}.mp3`);
          if (doc.language === 'en' && LEGACY_COACH[coach] && existsSync(old)) {
            takes.push(old);
            legacy += 1;
          } else missing += 1;
        }
        if (takes.length) {
          clipsOut.push(`      ${line.clip}: [${takes.map((file) => `require(${JSON.stringify(rel(file))})`).join(', ')}],`);
        }
      }
      clipsOut.push('    },');
    }
    clipsOut.push('  },');
  }
  clipsOut.push('};', '');
  writeFileSync(join(ROOT, 'src', 'audio', 'voiceClips.ts'), clipsOut.join('\n'));

  const linesOut = ['/* Generated by scripts/gen-voice-elevenlabs.mjs from assets/voice/script.*.json. Do not edit. */', ''];
  linesOut.push('export const COACH_LANGUAGES: { id: string; name: string; coaches: Record<string, string> }[] = [');
  for (const doc of scripts) {
    const coaches = Object.fromEntries(Object.entries(doc.coaches).map(([id, info]) => [id, info.name]));
    linesOut.push(`  { id: ${JSON.stringify(doc.language)}, name: ${JSON.stringify(doc.name)}, coaches: ${JSON.stringify(coaches)} },`);
  }
  linesOut.push('];', '', '/** language → clip → the words. Spoken only; never shown on screen. */');
  linesOut.push('export const COACH_LINES: Record<string, Record<string, string>> = {');
  for (const doc of scripts) {
    linesOut.push(`  ${JSON.stringify(doc.language)}: {`);
    for (const line of doc.lines) linesOut.push(`    ${line.clip}: ${JSON.stringify(line.text)},`);
    linesOut.push('  },');
  }
  linesOut.push('};', '');
  writeFileSync(join(ROOT, 'src', 'audio', 'coachLines.ts'), linesOut.join('\n'));
  return { fresh, legacy, missing };
}

async function main() {
  const scripts = loadScripts();
  if (scripts.length === 0) throw new Error('No assets/voice/script.<lang>.json found.');

  if (!args.manifest) {
    const filter = {
      lang: typeof args.lang === 'string' ? args.lang : undefined,
      coach: typeof args.coach === 'string' ? args.coach : undefined,
      only: typeof args.only === 'string' ? args.only.split(',') : undefined,
      model: typeof args.model === 'string' ? args.model : undefined,
    };
    const all = plan(scripts, filter);
    const todo = args.force ? all : all.filter((job) => !existsSync(job.file));
    const chars = todo.reduce((sum, job) => sum + job.text.length, 0);
    console.log(`${all.length} takes in the script, ${all.length - todo.length} already on disk, ${todo.length} to generate (${chars.toLocaleString()} characters).`);

    if (args['dry-run']) {
      for (const job of todo.slice(0, 12)) console.log(`  ${job.language}/${job.coach}/${job.clip}.${job.take}  ${job.text}`);
      if (todo.length > 12) console.log(`  … and ${todo.length - 12} more`);
      console.log('Dry run: nothing was generated and nothing was charged.');
      return;
    }

    if (todo.length) {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY (ElevenLabs → Developers → API keys). It is only read from the environment.');
      const post = !args['no-post'] && hasFfmpeg();
      if (!post && !args['no-post']) console.log('ffmpeg not found: clips are saved as ElevenLabs returns them (not trimmed or loudness-matched). `brew install ffmpeg` and re-run with --force to fix.');
      let done = 0;
      let failed = 0;
      const queue = todo.slice();
      const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          try {
            const audio = await synthesize(job, apiKey);
            mkdirSync(dirname(job.file), { recursive: true });
            writeFileSync(job.file, audio);
            if (post) postProcess(job.file);
            done += 1;
            if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
          } catch (error) {
            failed += 1;
            console.error(`  ✗ ${error.message}`);
            // A bad key, model or plan fails every call the same way: stop instead of repeating it.
            if (/ 40[123] /.test(error.message) && !/output_format/i.test(error.message)) queue.length = 0;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      console.log(`Generated ${done}${failed ? `, ${failed} failed (re-run to retry just those)` : ''}.`);
      if (failed) process.exitCode = 1;
    }
  }

  const { fresh, legacy, missing } = writeManifest(scripts);
  console.log(`Wrote src/audio/voiceClips.ts and coachLines.ts: ${fresh} clips from new takes, ${legacy} still on the old recordings, ${missing} with no audio.`);
  if (legacy === 0 && missing === 0) console.log('All clips are new. The old folders assets/voice/direct, calm and numbers are no longer used and can be deleted.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
