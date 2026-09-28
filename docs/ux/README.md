# 30/15 UX source of truth

**Agents and humans: read this folder before changing UI.**

PNG mocks are reference only. They are easy for cloud agents to miss or misread.
These markdown wireframes are the contract. If a pixel mock and this text disagree,
**this text wins**.

## Files

| File | Purpose |
| --- | --- |
| [NORTH_STAR.md](NORTH_STAR.md) | Product spirit, Apple HIG bar, keep/kill list |
| [tokens.md](tokens.md) | Type, color, spacing, hit targets |
| [screens.md](screens.md) | Welcome, Home, Ride, Pause, Done, Settings, Why |
| [sensors.md](sensors.md) | Power + heart-rate connect / scan lists (iOS list cells) |
| [sound.md](sound.md) | Pulse music, coach voices, count-in, ticks, haptics |
| [voice-script.md](voice-script.md) | Every spoken line, for re-recording with a human voice |

Design canvas (mockups, Sept 2026 redesign “Carbon & Ember”): see the shared Claude artifact
“30/15 — Redesign”. Code in `src/theme/tokens.ts` is the living source for values.

## How to use in a Cursor cloud agent

1. Open every file in `docs/ux/` first.
2. Implement hierarchy and copy from the ASCII frames, not from memory of old PNGs.
3. Do not invent gym-HIIT chrome (tab bars, ROUND/EXERCISE labels, streak Finish, remind-tomorrow).
4. Never use the words *honest*, *honesty*, or *honestly* in UI, store, or docs.

## Product locks (do not regress)

- Forever free. No Pro, paywall, or entitlement UI.
- Offline-first. Start and Done never wait on network or sync.
- Start never gated on power meter, heart rate, or login.
- Live watts on top during warm-up / HARD / EASY, inside the analog power gauge; countdown secondary below.
- The gauge shows the target as a notch with its number (no words). Under target: dashed, pulsing gap. On target (±3%): green arc + check.
- BPM under watts only while a watch is sending beats; dash when empty; never invent values.
- Default workout **2 × 13**. FTP default **120 W**. FTP and hard/easy targets live in Settings, not Home.
- Pause is the only control while the main set runs. In warm-up only: Halve (cuts what is left in half) and Skip (lands 8 s before the first HARD so the count-in still plays).
- After pause: Resume + press-and-hold to End.
- Done always persists on phone; signed-in also syncs `summary` to this app’s Supabase.
