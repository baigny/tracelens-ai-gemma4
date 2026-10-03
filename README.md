# TraceLens AI

Draw in the air or capture an object, then let Gemma 4 interpret one final image.

## Run locally

Use Node.js 24 (the tested version).

```powershell
npm ci
Copy-Item .env.example .env.local
# Set GEMINI_API_KEY in .env.local using your own Gemini API free-tier key.
npm run dev
```

Open http://localhost:3000 in Chrome or Edge. Restart the server after changing `.env.local`. Never put the key in a `NEXT_PUBLIC_` variable. `.env.local` is ignored by Git.

The model is configured only in `lib/gemma.ts`: `gemma-4-26b-a4b-it`. Get your own key from [Google AI Studio](https://aistudio.google.com/apikey). This project uses the Gemini API free tier; quota/access errors are shown without retries.

## Demo (under two minutes)

1. Enable camera, choose **Air Trace**, and hold one hand in view. Wait for the fingertip dot.
2. Press **Start Trace**. Slowly draw a simple bottle, cup, or house outline with your index finger. Press **Stop**.
3. Check the clean trace preview, then click **Analyze with Gemma**. Read the object, confidence, and description.
4. Choose **Scan Object**, hold up a cup or book, and click **Capture**. Click **Analyze with Gemma**. **Retake** restores the live view.

Trace and camera previews are mirrored to follow your movement. The exported trace matches that view; photographed objects are submitted unmirrored so writing remains readable. Hand loss pauses tracing and starts a separate stroke upon return.

## Data flow

Camera → browser-local MediaPipe landmark 8 → canvas trace, or camera → one captured frame → explicit Analyze click → Next.js `/api/interpret` → Gemma 4 → validated JSON result.

MediaPipe downloads its runtime and hand model from jsDelivr/Google on first use; inference runs locally. Network access is needed for those downloads and Gemma. No live frames, audio, conversation history, database, or saved images are used. Images stay in memory. Each Analyze click makes one request; controls lock while it runs, and SDK retries are disabled. Clear, Retake, and mode changes reset the result.

The API accepts `{ "mode": "trace" | "object", "image": "base64-image" }` (PNG/JPEG; data URLs also accepted). It returns `{ "object": "coffee mug", "confidence": "medium", "description": "A cup with a curved handle." }`. Confidence is low/medium/high; descriptions are fewer than 20 words. The request body is capped at 3 MiB.

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Automated checks passed: empty/disconnected trace rejection, centered white PNG export, separate strokes after hand loss, malformed model output, short-description enforcement, one SDK call with retries disabled, missing key/quota handling, and API request validation. The tests use mocked SDK responses and canvas operations; they do not consume API quota. Node may print an experimental warning for its built-in TypeScript test loader.

The production page and missing-key API handling were smoke-tested for both modes twice. A real webcam, successful model response, responsive visual layout, and browser network activity were **not** verified because no browser was connected to the automation tool and no API key was configured.

Before presenting, run this checklist twice with your webcam and key:

- Allow camera: see mirrored preview and fingertip marker; deny camera: see a recoverable permission error.
- Start tracing, move the finger, leave/re-enter the frame, stop, and confirm the exported trace has no camera background or connecting gap.
- Analyze and confirm object/confidence/description. Double-click Analyze and check only one `/api/interpret` request appears in DevTools Network.
- Capture a physical object; verify the frozen frame, Retake, and successful analysis.
- Verify there are no `/api/interpret` requests while drawing, capturing, clearing, switching modes, or waiting. Only Analyze sends one.
- Disconnect the camera and check recovery. Block MediaPipe model downloads and confirm Object Scan remains usable. Navigate away and verify the browser camera indicator turns off.
- Test at narrow/mobile widths and confirm all controls remain visible.

This is a localhost hackathon prototype. It has no authentication or public deployment controls.

## References

- [Saved implementation plan](docs/plan.md)
- [Gemma 4 challenge](https://github.com/reacthyderabad/hacktoberfest-hack-day-2026/blob/main/challenges/gemma-4.md)
- [Challenge brief](https://github.com/reacthyderabad/hacktoberfest-hack-day-2026/blob/main/challenges/briefs/gemma-4.pdf)
- [Gemma through the Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
