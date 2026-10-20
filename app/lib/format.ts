const monthYear = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const longMonthYear = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Oct 2026 – Mar 2027" (or "October 2026 to March 2027" with long: true). */
export function formatDuration(
  start: string | null,
  end: string | null,
  { long = false } = {},
): string {
  const fmt = long ? longMonthYear : monthYear;
  const s = parseDate(start);
  const e = parseDate(end);
  if (s && e) return `${fmt.format(s)}${long ? " to " : " – "}${fmt.format(e)}`;
  if (s) return `Starts ${fmt.format(s)}`;
  if (e) return `Until ${fmt.format(e)}`;
  return "To be announced";
}

const shortDate = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});

/** SQLite CURRENT_TIMESTAMP ("2026-10-20 03:59:01", UTC) -> "Oct 20, 2026". */
export function formatTimestamp(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : shortDate.format(date);
}

const shortDateTime = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

/** SQLite CURRENT_TIMESTAMP (UTC) -> "Oct 20, 2026, 11:59 AM" in Manila. */
export function formatDateTime(value: string): string {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "" : shortDateTime.format(date);
}
