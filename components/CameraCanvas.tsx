"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { drawTrace, exportTrace } from "@/lib/trace";
import type { CameraStatus, Mode, TracePoint } from "@/types";

export type CameraHandle = { start: () => void; stop: () => string | null; clear: () => void; capture: () => string };
type Props = { mode: Mode; capturedImage?: string | null; onStatus: (status: CameraStatus) => void };

const CameraCanvas = forwardRef<CameraHandle, Props>(function CameraCanvas({ mode, capturedImage, onStatus }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useRef<TracePoint[]>([]);
  const tracing = useRef(false);
  const breakStroke = useRef(true);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState("Camera is off");

  function clear() {
    tracing.current = false; points.current = []; breakStroke.current = true;
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }
  useImperativeHandle(ref, () => ({
    start() { clear(); tracing.current = true; },
    stop() { tracing.current = false; return exportTrace(points.current); },
    capture() {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) throw new Error("Camera is not ready. Please try again.");
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture this frame. Please try again.");
      // One frame only. Keep the submitted photo unmirrored so text remains readable.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    },
    clear,
  }), []);
  useEffect(() => { onStatus({ ready, tracking, message }); }, [ready, tracking, message, onStatus]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    async function open() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getVideoTracks().forEach(t => t.addEventListener("ended", () => {
          if (!cancelled) { setReady(false); setEnabled(false); setError("Camera disconnected. Reconnect it and try again."); }
        }));
        if (video) { video.srcObject = stream; await video.play(); }
        if (!cancelled) { setReady(true); setError(""); }
      } catch (cause) {
        if (cancelled) return;
        stream?.getTracks().forEach(t => t.stop());
        const name = cause instanceof Error ? cause.name : "";
        setError(name === "NotAllowedError" ? "Camera access was denied. Allow camera access in your browser, then try again."
          : name === "NotFoundError" ? "No webcam found. Connect a camera and try again."
          : "Could not open the camera. Close other camera apps and use localhost or HTTPS.");
        setReady(false); setEnabled(false);
      }
    }
    void open();
    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); if (video) video.srcObject = null; };
  }, [enabled]);

  useEffect(() => {
    if (!ready || mode !== "trace") { setTracking(false); return; }
    let disposed = false, frame = 0, lastTime = -1;
    let tracker: HandLandmarker | undefined;
    setMessage("Loading hand tracker…");
    async function init() {
      try {
        const { createHandLandmarker } = await import("@/lib/mediapipe");
        const created = await createHandLandmarker();
        if (disposed) { created.close(); return; }
        tracker = created; setTracking(true);
        function tick() {
          if (disposed) return;
          try {
            const video = videoRef.current, canvas = canvasRef.current;
            if (video && canvas && video.readyState >= 2 && video.currentTime !== lastTime) {
              lastTime = video.currentTime;
              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
              }
              const ctx = canvas.getContext("2d");
              const tip = tracker!.detectForVideo(video, performance.now()).landmarks[0]?.[8];
              setMessage(tip ? "Index finger detected" : "Hold one hand in view · trace pauses when your hand leaves");
              const point = tip ? { x: (1 - tip.x) * canvas.width, y: tip.y * canvas.height } : null;
              if (!point) breakStroke.current = true;
              if (point && tracing.current) {
                const last = points.current[points.current.length - 1];
                if (!last || breakStroke.current || Math.hypot(last.x - point.x, last.y - point.y) >= 4) {
                  points.current.push({ ...point, breakBefore: breakStroke.current }); breakStroke.current = false;
                }
              }
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height); drawTrace(ctx, points.current);
                if (point) { ctx.fillStyle = "#a0f0ce"; ctx.beginPath(); ctx.arc(point.x, point.y, 9, 0, Math.PI * 2); ctx.fill(); }
              }
            }
            frame = requestAnimationFrame(tick);
          } catch { setTracking(false); setMessage("Hand tracking stopped. Switch to Scan Object, or reload to try again."); }
        }
        tick();
      } catch { if (!disposed) { setTracking(false); setMessage("Hand tracker could not load. Check your connection and reload. Object scan is still available."); } }
    }
    void init();
    return () => { disposed = true; cancelAnimationFrame(frame); tracker?.close(); setTracking(false); };
  }, [ready, mode]);

  return <div className={`relative flex ${ready ? "" : "min-h-80 sm:min-h-96"} items-center justify-center overflow-hidden rounded-2xl bg-[#080b10]`}>
    <video ref={videoRef} autoPlay playsInline muted className={`w-full -scale-x-100 ${ready ? "" : "hidden"}`} />
    {mode === "object" && capturedImage && <img src={capturedImage} alt="Captured object" className="absolute inset-0 h-full w-full -scale-x-100 bg-[#080b10] object-contain" />}
    <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${mode === "trace" && ready ? "" : "hidden"}`} />
    {ready && <span role="status" className="absolute left-3 top-3 max-w-[90%] rounded-lg bg-black/70 px-3 py-2 text-xs text-emerald-200">{mode === "trace" ? message : capturedImage ? "Frame captured · Ready to analyze" : "Live camera · Position your object"}</span>}
    {!ready && <div className="relative max-w-sm p-8 text-center">
      <div className="mb-5 text-5xl text-emerald-200" aria-hidden="true">◎</div>
      <h2 className="text-xl font-semibold">Your camera. Your canvas.</h2>
      <p className="my-4 text-sm leading-6 text-slate-400">Open your camera to begin. Your live video stays in your browser.</p>
      {error && <p role="alert" className="mb-4 text-sm text-rose-300">{error}</p>}
      <button className="button primary" disabled={enabled} onClick={() => { setError(""); setEnabled(true); }}>{enabled ? "Opening camera…" : "Enable camera"}</button>
    </div>}
  </div>;
});
export default CameraCanvas;

