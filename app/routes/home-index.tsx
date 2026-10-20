import { MousePointerClick } from "lucide-react";

export default function HomeIndex() {
  return (
    <aside className="hidden flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 xl:sticky xl:top-4 xl:flex">
      <MousePointerClick className="mb-2 size-5 text-slate-300" aria-hidden />
      <p className="font-medium text-slate-500">No program selected</p>
      <p>Click a program on the list to view its briefer.</p>
    </aside>
  );
}
