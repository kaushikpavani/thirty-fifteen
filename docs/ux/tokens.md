# Design tokens — 30/15

Use system fonts (SF Pro). Prefer Dynamic Type where practical; lock ride hero digits to a fixed large size so they stay glanceable on the bike.

## Type

| Role | Approx | Notes |
| --- | --- | --- |
| Ride watts | 64–80 pt, semibold, monospaced digits | Top of ride stack |
| Ride BPM | 28–34 pt, regular, monospaced | Directly under watts; hide or show "—" when no HR |
| Countdown | 40–48 pt, medium, monospaced | Below BPM / watts block |
| Phase label | 15–17 pt, semibold | HARD / EASY / Warm-up |
| Home Start | 20 pt semibold on large filled button | Min height 56 pt |
| Settings title | Large Title | System |
| Body / list | 17 pt | System |
| Caption / chip | 13–15 pt | Sensor status |

## Color (semantic)

| Token | Use |
| --- | --- |
| `phase.warmup` | Calm blue-gray wash |
| `phase.hard` | Hot coral / orange wash |
| `phase.easy` | Cool teal / blue wash |
| `metric.primary` | Label color (watts) |
| `metric.secondary` | Secondary label (BPM, countdown) |
| `fill.primary` | Start / Resume button |
| `fill.destructive` | End (after pause) |
| `separator` | Grouped list separators |
| `bg.grouped` | Settings background |

Exact hex may follow the live theme; hierarchy matters more than brand palette.

## Spacing and hit targets

- Minimum tappable height **44 pt** (Apple HIG). Prefer **52–56 pt** for sensor rows and primary buttons.
- Screen horizontal inset **16–20 pt**.
- Grouped list corner radius ~10–12 pt (system inset grouped style).
- Ride stack vertical rhythm: watts → 8 pt → BPM → 16–24 pt → countdown → flexible spacer → Pause.

## Motion

- Phase color transitions soft; respect Reduce Motion (static wash).
- No competing animations on the watt number itself.


---

## Carbon & Ember (Sept 2026) — current values

Source of truth in code: `src/theme/tokens.ts`.

| Token | Value | Use |
| --- | --- | --- |
| ground | `#000000` | every screen |
| surface / grouped / raised | `#111113` / `#1C1C1E` / `#2C2C2E` | cards / lists / controls |
| ink / secondary / tertiary | `#F5F5F2` / `#9B9BA1` / `#7A7A80` | text |
| ember | `#FF5A1F` | Start, Resume, HARD accents (black label on top) |
| glacier | `#5CC8E6` | EASY accents |
| signal | `#32D74B` (gauge `#34E05A`) | live sensor, on target |
| field.hard / easy / warmup / rest | `#E0410F` / `#0B5569` / `#1B2330` / `#141A33` | full-bleed ride color |

Ride type: watts 132–150 pt semibold tabular inside the gauge, bpm 50 pt, countdown 88 pt, count-in digit 124 pt, phase word 17 pt heavy +3 tracking.

Motion: phase color cross-fades 300 ms; a shade falls from the top as the segment runs out; in the last 3 s before HARD, ember rises from the bottom edge; phase word slides up 8 pt; count-in digit settles from 1.14×; press scale 0.96 with a light haptic; Hold to end fills over 1.2 s. Reduce Motion cuts instead.
