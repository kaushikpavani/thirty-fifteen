# Coach voices

Each language has two coaches, one female and one male, who speak the same lines.
English ships today: **Sarah** and **Chris**, generated with ElevenLabs (model `eleven_v4`).

## Where things live

| What | Where |
| --- | --- |
| The words, the coaches and their voice ids | `assets/voice/script.<lang>.json` |
| The audio, one file per take | `assets/voice/<lang>/<coach>/<clip>.<take>.mp3` |
| Generated: which file plays for each clip | `src/audio/voiceClips.ts` |
| Generated: the words, for the on-device fallback voice | `src/audio/coachLines.ts` |

## Generate or update the audio

```
ELEVENLABS_API_KEY=sk_... node scripts/gen-voice-elevenlabs.mjs
```

It only generates what is missing, so re-running after a failure or after adding a line is safe.
`--dry-run` shows what would be generated and the character count without calling the API.
Generate while on a paid ElevenLabs plan: that is what makes the clips usable commercially.

## Add a language

1. Copy `assets/voice/script.en.json` to `script.<code>.json`.
2. Translate the `text` of each line. Keep every `clip` name as it is.
3. Set `language`, `name`, and a native-speaking voice id for each coach.
4. Run the script. The language appears in Settings › Sound & haptics.

## The lines

- **Length lines** say how long the next part lasts, from the rider's settings: warm-up (5–30 min),
  rest between sets (1–10 min) and cool-down (3–20 min). One clip per possible length.
- **One minute of warm-up left**, a minute before the first hard rep.
- **Count-in** "Three. Two. One." then "Go!", with three takes each so they don't sound identical every rep.
- **Hard and easy reps**: a pool of short lines, two takes each. At most one line per rep; some reps are quiet.
- **Milestones**: Halfway, Three to go, Last one.

Direction: a real coach at your shoulder. Certain, warm, never shouting. Short lines land fast.
