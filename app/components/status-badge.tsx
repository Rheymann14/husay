import { CircleDashed } from "lucide-react";

import type { ComboboxOption } from "~/components/combobox";
import { getStatusIcon } from "~/lib/status-icons";

/** Status choices for a Combobox, with "No status" first. */
export function statusOptions(
  statuses: { id: number; name: string; color: string; icon: string }[],
): ComboboxOption[] {
  return [
    {
      value: "",
      label: "No status",
      icon: <CircleDashed className="size-3.5 shrink-0 text-slate-400" aria-hidden />,
    },
    ...statuses.map((s) => {
      const Icon = getStatusIcon(s.icon);
      return {
        value: String(s.id),
        label: s.name,
        icon: <Icon className="size-3.5 shrink-0" style={{ color: s.color }} aria-hidden />,
      };
    }),
  ];
}

type Props = {
  status: { name: string; color: string; icon: string } | null;
  size?: "sm" | "md";
};

export function StatusBadge({ status, size = "sm" }: Props) {
  if (!status) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  const Icon = getStatusIcon(status.icon);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
      style={{
        color: status.color,
        backgroundColor: `${status.color}14`,
        borderColor: `${status.color}40`,
      }}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {status.name}
    </span>
  );
}
