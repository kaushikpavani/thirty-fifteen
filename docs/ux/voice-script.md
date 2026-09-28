# Voice script — for a human recording

The app ships neural-voice takes (Kokoro, local). A real voice actor is better. Record each line below as its own file,
mono, any sample rate, a little room tone before and after, and save it as
`assets/voice-src/<voice>/<clip>.wav`. Then run:

```
python3 scripts/gen-voice.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
```

The script prefers your recording for every clip it finds, and trims, cleans and loudness-matches it the same way.
Direction: a real coach at your shoulder on a hard morning. Warm, certain, never shouting. Short lines land fast.


## Coach (direct) — `assets/voice-src/direct/`

| clip | line |
| --- | --- |
| `welcome` | Let's ride! Easy spin to warm up. |
| `go` | Go! |
| `hard0` | Drive it! |
| `hard1` | Strong legs! Stay on it! |
| `hard2` | Quick feet! Keep it smooth! |
| `hard3` | That's it! Hold the power! |
| `hard4` | Push! You own this! |
| `halfway` | Halfway! Looking strong! |
| `three` | Three to go! Dig in! |
| `last` | Last one! Everything you have! |
| `easy0` | Breathe. Nice work. |
| `easy1` | Spin it out. |
| `easy2` | Good! Recover. |
| `round0` | Set done! Spin easy and drink. |
| `finish0` | That is how it is done! Cool down, easy spin. |
| `count3` | Three! |
| `count2` | Two! |
| `count1` | One! |
| `preview` | Halfway! Looking strong! |

## Calm — `assets/voice-src/calm/`

| clip | line |
| --- | --- |
| `welcome` | Warm-up. Easy spin to start. |
| `go` | Go. |
| `hard0` | Hold it. |
| `hard1` | Smooth and strong. |
| `hard2` | Quick feet. |
| `hard3` | Relax your shoulders. |
| `hard4` | Stay on it. |
| `halfway` | Halfway. |
| `three` | Three to go. |
| `last` | Last one. Empty it. |
| `easy0` | Breathe. |
| `easy1` | Spin easy. |
| `easy2` | Good. |
| `round0` | Set done. Spin easy, and drink. |
| `finish0` | That's the work. Cool down, easy spin. |
| `count3` | Three. |
| `count2` | Two. |
| `count1` | One. |
| `preview` | Halfway. Smooth and strong. |

## Numbers only — `assets/voice-src/numbers/`

| clip | line |
| --- | --- |
| `welcome` | Warm-up. |
| `go` | Go. |
| `halfway` | Halfway. |
| `three` | Three to go. |
| `last` | Last one. |
| `round0` | Set done. |
| `finish0` | Done. |
| `count3` | Three. |
| `count2` | Two. |
| `count1` | One. |
| `preview` | Rep seven. Halfway. |

Numbers only also records `rep1` … `rep20`: “Rep one.” … “Rep twenty.”
