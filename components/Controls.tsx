import type { Mode } from "@/types";

type Props = {
  mode: Mode; busy: boolean; ready: boolean; tracking: boolean; isTracing: boolean; hasImage: boolean;
  onStart: () => void; onStop: () => void; onClear: () => void; onCapture: () => void; onAnalyze: () => void;
};
export default function Controls(p: Props) {
  return <div className="mt-4 flex flex-wrap gap-2">
    {p.mode === "trace" ? <>
      <button className="button" disabled={!p.tracking || p.isTracing || p.busy} onClick={p.onStart}>Start Trace</button>
      <button className="button" disabled={!p.isTracing || p.busy} onClick={p.onStop}>Stop</button>
      <button className="button" disabled={p.busy} onClick={p.onClear}>Clear</button>
    </> : <>
      <button className="button" disabled={!p.ready || p.hasImage || p.busy} onClick={p.onCapture}>Capture</button>
      <button className="button" disabled={!p.hasImage || p.busy} onClick={p.onClear}>Retake</button>
    </>}
    <button className="button primary sm:ml-auto" disabled={!p.hasImage || p.isTracing || p.busy} onClick={p.onAnalyze}>{p.busy ? "Analyzing…" : "Analyze with Gemma"}</button>
  </div>;
}
