# Credits and licenses

Every third-party asset that ships in the app, with its license. The same
credits appear in the app under Settings → Credits and beside each photo.

## Photos

Downloaded from Vecteezy under the Vecteezy **Free License**, which requires
attribution. The app ships graded, resized copies; originals stay out of git.

| In app | File | Credit | Source |
| --- | --- | --- | --- |
| Welcome hero | `assets/photos/welcome-road.jpg` | Photo: Marco Guidi · Vecteezy | https://www.vecteezy.com/photo/27082148-a-man-riding-a-bike |
| Why 30/15 header | `assets/photos/why-climb.jpg` | Photo: Erwin Pieloor · Vecteezy (AI-generated) | https://www.vecteezy.com/photo/74210911-dedicated-male-cyclist-wearing-black-gear-aggressively |

Before adding a photo: confirm the page says **Free License** (not Pro), record
the contributor and page URL here, add it to `src/content/photos.ts`, and show
the credit wherever the photo appears.

## Voice

Coach clips in `assets/voice/` are rendered locally with Kokoro-82M
(https://github.com/hexgrad/kokoro), Apache License 2.0. Human recordings in
`assets/voice-src/` replace them clip by clip (see `docs/ux/voice-script.md`).

## Original to 30/15

Pulse music and cue sounds (`scripts/gen-pulse.py`), the road-bike
illustration (`src/components/bike/RoadBike.tsx`), and all UI.
