import type { Mode } from "@/types";

export default function ModeSwitcher({ mode, disabled, onChange }: { mode: Mode; disabled: boolean; onChange: (mode: Mode) => void }) {
  return <div className="mb-4 inline-flex gap-1 rounded-xl border border-slate-700/60 bg-[#0b0e13] p-1" role="group" aria-label="Input mode">
    {([['trace', 'Air Trace'], ['object', 'Scan Object']] as const).map(([value, label]) => <button key={value} disabled={disabled} aria-pressed={mode === value} onClick={() => onChange(value)} className={`rounded-lg px-5 py-2.5 text-sm font-medium ${mode === value ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>)}
  </div>;
}
