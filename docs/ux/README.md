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

## How to use in a Cursor cloud agent

1. Open every file in `docs/ux/` first.
2. Implement hierarchy and copy from the ASCII frames, not from memory of old PNGs.
3. Do not invent gym-HIIT chrome (tab bars, ROUND/EXERCISE labels, streak Finish, remind-tomorrow).
4. Never use the words *honest*, *honesty*, or *honestly* in UI, store, or docs.

## Product locks (do not regress)

- Forever free. No Pro, paywall, or entitlement UI.
- Offline-first. Start and Done never wait on network or sync.
- Start never gated on power meter, heart rate, or login.
- Live watts on top during warm-up / HARD / EASY; countdown secondary below.
- BPM under watts only while a watch is sending beats; dash when empty; never invent values.
- Default workout **2 × 13**. FTP default **120 W**. FTP and hard/easy targets live in Settings, not Home.
- Pause is the only control while the clock runs. Resume + End after pause.
- Done always persists on phone; signed-in also syncs `summary` to this app’s Supabase.
