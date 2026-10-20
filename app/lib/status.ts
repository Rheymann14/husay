// Program status. Kept free of imports so the database schema can share it.

/** Built-in statuses. "Automatic" picks one of these from the program dates. */
export const AUTO_STATUS_KEYS = ["upcoming", "ongoing", "closed"] as const;
export type AutoStatusKey = (typeof AUTO_STATUS_KEYS)[number];

/** The short list of colors and icons an admin can choose from. */
export const STATUS_COLORS = ["green", "blue", "orange", "red", "gray"] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export const STATUS_ICONS = [
  "calendar-clock",
  "circle-play",
  "circle-x",
  "circle-check",
  "circle-pause",
  "clock",
  "megaphone",
  "star",
] as const;
export type StatusIcon = (typeof STATUS_ICONS)[number];

/** A status as configured by an admin. */
export type StatusDef = {
  key: string;
  name: string;
  color: string;
  icon: string;
};

/**
 * What is stored per program: "auto" follows the dates, "none" shows no
 * status, anything else is the key of a status set manually.
 */
export type StatusSetting = string;

export function isAutoStatusKey(key: string): key is AutoStatusKey {
  return (AUTO_STATUS_KEYS as readonly string[]).includes(key);
}

/** Today's date as YYYY-MM-DD in Philippine time. */
export function todayInManila(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Upcoming before the start date, closed after the end date, ongoing in between. */
export function statusFromDates(
  startDate: string | null,
  endDate: string | null,
  today: string,
): AutoStatusKey | null {
  if (!startDate && !endDate) return null;
  if (startDate && today < startDate) return "upcoming";
  if (endDate && today > endDate) return "closed";
  return "ongoing";
}

/**
 * Closed once the end date has passed or the status is set to Closed.
 * Application links are disabled while a program is closed.
 */
export function isProgramClosed(
  statusKey: string | null | undefined,
  autoStatus: AutoStatusKey | null,
) {
  return statusKey === "closed" || autoStatus === "closed";
}

/** The status visitors see, or null for none. */
export function resolveStatus(
  setting: StatusSetting,
  startDate: string | null,
  endDate: string | null,
  today: string,
  statuses: StatusDef[],
): StatusDef | null {
  if (setting === "none") return null;
  const manual = setting === "auto" ? undefined : statuses.find((s) => s.key === setting);
  // A manual status that was since removed falls back to Automatic.
  const key = manual ? manual.key : statusFromDates(startDate, endDate, today);
  return statuses.find((s) => s.key === key) ?? null;
}
