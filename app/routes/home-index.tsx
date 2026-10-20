import { MousePointerClick } from "lucide-react";

export default function HomeIndex() {
  return (
    <aside className="hidden flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-500 xl:sticky xl:top-6 xl:flex">
      <MousePointerClick className="mb-3 size-8 text-slate-400" aria-hidden />
      <p className="font-medium text-slate-600">No program selected</p>
      <p className="text-sm">Click a program on the list to view its briefer.</p>
    </aside>
  );
}
