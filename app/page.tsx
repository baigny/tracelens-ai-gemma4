"use client";
import { useRef, useState } from "react";
import CameraCanvas, { type CameraHandle } from "@/components/CameraCanvas";
import ResultPanel from "@/components/ResultPanel";
import ModeSwitcher from "@/components/ModeSwitcher";
import Controls from "@/components/Controls";
import { isInterpretation, type Interpretation, type CameraStatus, type Mode } from "@/types";

export default function Home() {
  const camera = useRef<CameraHandle>(null);
  const requestInFlight = useRef(false);
  const [mode, setMode] = useState<Mode>("trace");
  const [status, setStatus] = useState<CameraStatus>({ ready: false, tracking: false, message: "Camera is off" });
  const [isTracing, setIsTracing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<Interpretation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function reset() { camera.current?.clear(); setIsTracing(false); setImage(null); setResult(null); setError(""); }
  function start() { reset(); camera.current?.start(); setIsTracing(true); }
  function capture() {
    setError(""); setResult(null);
    try { setImage(camera.current?.capture() ?? null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not capture a frame. Please try again."); }
  }
  function stop() {
    setIsTracing(false);
    try {
      const finalImage = camera.current?.stop() ?? null;
      setImage(finalImage);
      if (!finalImage) setError("No trace yet. Keep your hand in view and draw a longer line.");
    } catch { setError("Could not create the trace image. Clear and try again."); }
  }
  async function analyze() {
    if (!image || isTracing || requestInFlight.current) return;
    requestInFlight.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/interpret", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, image: image.split(",")[1] }),
        signal: AbortSignal.timeout(55000),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Could not analyze the image. Please try again.";
        throw new Error(message);
      }
      if (!isInterpretation(data)) throw new Error("Gemma returned an unreadable result. Please try again.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "The request timed out. Click Analyze to try again.");
    } finally { requestInFlight.current = false; setBusy(false); }
  }
  return <main className="mx-auto max-w-7xl px-5 py-8 sm:px-10">
    <header className="flex items-center justify-between border-b border-slate-800 pb-6">
      <div className="text-xl font-bold tracking-tight"><span aria-hidden="true">&#9678; </span>TraceLens <span className="text-emerald-200">AI</span></div>
      <span className="text-xs text-slate-400">Powered by Gemma 4</span>
    </header>
    <section className="py-10"><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-emerald-200">From motion to meaning</p>
      <h1 className="text-3xl font-semibold sm:text-4xl">Show your idea.</h1><p className="mt-3 text-slate-400">Trace it in the air. Or hold it up. Gemma connects the dots.</p>
    </section>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="panel p-4"><div className="mb-4 flex justify-between text-sm"><span>Visual workspace</span><span className="text-slate-500">{isTracing ? "Recording trace" : "Local camera"}</span></div>
        <ModeSwitcher mode={mode} disabled={busy} onChange={next => { if (next !== mode) { reset(); setMode(next); } }} />
        <CameraCanvas ref={camera} mode={mode} capturedImage={image} onStatus={setStatus} />
        <Controls mode={mode} busy={busy} ready={status.ready} tracking={status.tracking} isTracing={isTracing} hasImage={!!image}
          onStart={start} onStop={stop} onClear={reset} onCapture={capture} onAnalyze={analyze} />
        <p className="mt-4 text-xs leading-5 text-slate-400">{mode === "trace" ? "01 Start trace  /  02 Draw with your index finger  /  03 Stop and analyze" : "01 Hold an object in view  /  02 Capture a frame  /  03 Analyze with Gemma"}</p>
      </section>
      <ResultPanel image={image} busy={busy} result={result} error={error} isTracing={isTracing} />
    </div>
    <footer className="mt-6 text-xs text-slate-500">Private by default · Only your final image is sent when you choose Analyze.</footer>
  </main>;
}
