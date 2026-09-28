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
