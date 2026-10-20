import {
  Archive,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CirclePause,
  CirclePlay,
  CircleX,
  Clock,
  Hourglass,
  Lock,
  Megaphone,
  Star,
  type LucideIcon,
} from "lucide-react";

/** Icons an admin can pick for a status. Keys are stored in the database. */
export const STATUS_ICONS: Record<string, { label: string; Icon: LucideIcon }> =
  {
    "circle-check": { label: "Check", Icon: CircleCheck },
    "circle-x": { label: "Cross", Icon: CircleX },
    "circle-play": { label: "Play", Icon: CirclePlay },
    "circle-pause": { label: "Pause", Icon: CirclePause },
    clock: { label: "Clock", Icon: Clock },
    hourglass: { label: "Hourglass", Icon: Hourglass },
    "calendar-clock": { label: "Calendar", Icon: CalendarClock },
    megaphone: { label: "Megaphone", Icon: Megaphone },
    "circle-alert": { label: "Alert", Icon: CircleAlert },
    star: { label: "Star", Icon: Star },
    lock: { label: "Lock", Icon: Lock },
    archive: { label: "Archive", Icon: Archive },
  };

export const STATUS_COLOR_PRESETS = [
  "#15803d", // green
  "#1d4ed8", // blue
  "#b45309", // amber
  "#b91c1c", // red
  "#7e22ce", // purple
  "#0f766e", // teal
  "#64748b", // slate
];

export function getStatusIcon(key: string): LucideIcon {
  return STATUS_ICONS[key]?.Icon ?? CircleCheck;
}
