import { getStatusIcon } from "~/lib/status-icons";

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
