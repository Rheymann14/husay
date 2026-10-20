import {
  CalendarClock,
  CalendarSync,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
  CircleX,
  Clock,
  Megaphone,
  Star,
  type LucideIcon,
} from "lucide-react";

import type { ComboboxOption } from "~/components/combobox";
import type { StatusColor, StatusDef, StatusIcon } from "~/lib/status";

export const STATUS_ICON_COMPONENTS: Record<StatusIcon, { label: string; Icon: LucideIcon }> = {
  "calendar-clock": { label: "Calendar", Icon: CalendarClock },
  "circle-play": { label: "Play", Icon: CirclePlay },
  "circle-x": { label: "Cross", Icon: CircleX },
  "circle-check": { label: "Check", Icon: CircleCheck },
  "circle-pause": { label: "Pause", Icon: CirclePause },
  clock: { label: "Clock", Icon: Clock },
  megaphone: { label: "Megaphone", Icon: Megaphone },
  star: { label: "Star", Icon: Star },
};

export const STATUS_COLOR_CLASSES: Record<
  StatusColor,
  { label: string; badge: string; icon: string; swatch: string }
> = {
  green: {
    label: "Green",
    badge: "border-green-200 bg-green-50 text-green-700",
    icon: "text-green-600",
    swatch: "bg-green-600",
  },
  blue: {
    label: "Blue",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "text-blue-600",
    swatch: "bg-blue-600",
  },
  orange: {
    label: "Orange",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    icon: "text-orange-600",
    swatch: "bg-orange-500",
  },
  red: {
    label: "Red",
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "text-red-600",
    swatch: "bg-red-600",
  },
  gray: {
    label: "Gray",
    badge: "border-slate-200 bg-slate-50 text-slate-500",
    icon: "text-slate-400",
    swatch: "bg-slate-400",
  },
};

function styleOf(status: Pick<StatusDef, "color" | "icon"> | null) {
  const colors =
    STATUS_COLOR_CLASSES[(status?.color ?? "gray") as StatusColor] ??
    STATUS_COLOR_CLASSES.gray;
  const Icon = status
    ? (STATUS_ICON_COMPONENTS[status.icon as StatusIcon]?.Icon ?? CircleCheck)
    : CircleDashed;
  return { ...colors, Icon };
}

function StatusIconView({ status }: { status: StatusDef | null }) {
  const { Icon, icon } = styleOf(status);
  return <Icon className={`size-3.5 shrink-0 ${icon}`} aria-hidden />;
}

/**
 * Status choices for a Combobox. `autoKey` is the status "Automatic"
 * currently works out to from the program dates.
 */
export function statusOptions(
  statuses: StatusDef[],
  autoKey: string | null,
): ComboboxOption[] {
  const auto = statuses.find((s) => s.key === autoKey);
  return [
    {
      value: "auto",
      label: `Automatic (${auto?.name ?? "No status"})`,
      icon: <CalendarSync className="size-3.5 shrink-0 text-navy-700" aria-hidden />,
      description: autoKey
        ? "Follows the start and end dates"
        : "Add a start or end date to set it",
    },
    ...statuses.map((s) => ({
      value: s.key,
      label: s.name,
      icon: <StatusIconView status={s} />,
      description: "Set manually",
    })),
    {
      value: "none",
      label: "No status",
      icon: <StatusIconView status={null} />,
      description: "Set manually",
    },
  ];
}

type Props = {
  status: Pick<StatusDef, "name" | "color" | "icon"> | null;
  size?: "sm" | "md";
};

export function StatusBadge({ status, size = "sm" }: Props) {
  const { Icon, badge } = styleOf(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${badge} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {status?.name || "No status"}
    </span>
  );
}
