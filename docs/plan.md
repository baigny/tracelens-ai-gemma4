# TraceLens AI MVP

## Summary

Build a lightweight camera-first app that identifies an air-drawn object or a photographed object using Gemma 4 through the Gemini API free tier.

Problem: let users describe an object visually without typing.

Core loop: **Draw or capture → explicitly analyze → Gemma interprets → display object, confidence, and description.**

## Implementation

1. Create `docs/plan.md` containing this plan before implementing the app.
2. **Step 1:** Scaffold Next.js, TypeScript, and Tailwind. Build a dark, responsive camera/result layout and reusable webcam component. Handle permission denial, unavailable camera, mirrored preview, and media-track cleanup. Pass TypeScript and build checks before proceeding.
3. **Step 2:** Add browser-local MediaPipe Hand Landmarker for one hand. Display index fingertip landmark `8`, correcting mirrored coordinates.
4. **Step 3:** Implement Start Trace, Stop, and Clear. Record points only while tracing, ignore movements under several pixels, and render smooth canvas lines.
5. **Step 4:** Export a centered trace as PNG with a white background and dark line, excluding webcam imagery.
6. **Step 5:** Implement `POST /api/interpret` using server-side `@google/genai`.
7. **Step 6:** Connect explicit trace analysis, disabling duplicate submissions while a request runs.
8. **Step 7:** Implement object Capture and Retake. Capture exactly one frame and compress it to JPEG with a maximum dimension of 960 pixels.
9. **Step 8:** Complete idle, ready, thinking, complete, and error states.
10. **Step 9:** Validate both full demo flows twice.

Keep the project small using the requested component/lib structure. Add no optional features or unnecessary libraries. Run type checks after each stage and production builds at meaningful integration checkpoints; fix failures before proceeding.

## API and Model

- Request: `{ "mode": "trace" | "object", "image": "base64-image" }`.
- Response: `{ "object": string, "confidence": "low" | "medium" | "high", "description": string }`.
- Use a short, mode-aware prompt requiring JSON only and a description under 20 words. Validate the returned structure.
- Keep the model ID in `lib/gemma.ts`, defaulting to `gemma-4-26b-a4b-it`.
- Use **your own Gemini API free-tier key**, stored as server-only `GEMINI_API_KEY`.
- Send only the final image after clicking **Analyze with Gemma**. Send no live frames or conversation history.
- Configure the SDK for one attempt. No automatic retries, fallback model calls, or background analysis.
- Show understandable errors for missing credentials, quota limits, failed requests, and invalid responses.

## Acceptance and Defaults

- Desktop Chrome/Edge on localhost is the primary demo environment.
- Air Trace: allow camera → start → draw with index finger → stop → analyze → see interpretation.
- Object Scan: switch mode → capture → preview → analyze → see interpretation; Retake restores live preview.
- Verify camera cleanup, temporary hand loss, MediaPipe initialization failure, empty trace, duplicate-click prevention, and API failure handling.
- Confirm through browser network inspection that only explicit Analyze clicks submit images.
- Actual camera and model results require manual verification with a webcam and configured key; do not report these as tested without running them.
- Keep the demo under two minutes, with Gemma’s interpretation clearly visible.
