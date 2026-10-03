import type { Interpretation } from "@/types";

type Props = { image: string | null; busy: boolean; result: Interpretation | null; error: string; isTracing: boolean };

export default function ResultPanel({ image, busy, result, error, isTracing }: Props) {
  const state = busy ? "Thinking" : error ? "Try again" : result ? "Complete" : image ? "Ready" : "Waiting for input";
  return <aside className="panel flex flex-col p-6" aria-busy={busy}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Gemma interpretation</h2><span className="h-2 w-2 rounded-full bg-emerald-200" /></div>
    <div className="mt-8" aria-live="polite" aria-atomic="true">
      <p className="mb-5 text-xs text-emerald-200">{state}</p>
      {busy ? <><span className="mb-5 block h-7 w-7 animate-spin rounded-full border-2 border-emerald-200/20 border-t-emerald-200 motion-reduce:animate-none" /><h3 className="text-xl font-semibold">A little perspective…</h3><p className="mt-3 text-sm leading-6 text-slate-400">Gemma is interpreting your visual…</p></>
        : error ? <><h3 className="text-xl font-semibold">Let’s try that again.</h3><p role="alert" className="mt-3 text-sm leading-6 text-rose-300">{error}</p></>
        : result ? <><p className="text-xs text-slate-400">Object</p><h3 className="mt-2 text-3xl font-semibold capitalize break-words">{result.object}</h3><div className="my-6 inline-flex gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/5 px-3 py-2 text-xs"><span className="text-slate-400">Confidence</span><span className="capitalize text-emerald-200">{result.confidence}</span></div><p className="text-xs text-slate-400">Description</p><p className="mt-2 leading-7 text-slate-200">{result.description}</p><p className="mt-5 text-xs text-slate-500">Gemma’s best interpretation, not a certainty.</p></>
        : <><div className="mb-5 text-4xl text-slate-600" aria-hidden="true">✧</div><h3 className="text-xl font-semibold">{image ? "Ready to analyze." : isTracing ? "Keep your idea moving." : "An idea starts here."}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{image ? "Your final image is ready. Click Analyze with Gemma to discover what it sees." : isTracing ? "Move your index finger slowly, then press Stop to finish." : "Draw something in the air or capture an object."}</p></>}
    </div>
    {image && <div className="mt-8 border-t border-slate-800 pt-5"><p className="mb-3 text-xs text-slate-400">Image to analyze</p><img src={image} alt="Final image that will be sent to Gemma" className="max-h-44 w-full rounded-xl bg-white object-contain" /></div>}
    <p className="mt-auto pt-8 text-xs leading-5 text-slate-500">One image. One interpretation.<br />Sent only when you click Analyze.</p>
  </aside>;
}
