import { MousePointerClick } from "lucide-react";

import { EmptyState } from "~/components/empty-state";

export default function HomeIndex() {
  return (
    // As tall as the list beside it, like the briefer that replaces it.
    <aside className="hidden rounded-lg border border-dashed border-slate-300 bg-white/60 xl:flex xl:h-full xl:items-center xl:justify-center">
      <EmptyState
        icon={MousePointerClick}
        title="No program selected"
        description="Click a program on the list to view its briefer and how to apply."
      />
    </aside>
  );
}
