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

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

export function formatPeso(centavos: number | null): string {
  return centavos == null ? "" : peso.format(centavos / 100);
}

/** "23,647,292.92" -> 2364729292. Returns null for blank input, NaN if invalid. */
export function parsePesoToCentavos(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]|Php/gi, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centavosToInput(centavos: number | null): string {
  if (centavos == null) return "";
  return (centavos / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
