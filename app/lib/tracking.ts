/**
 * A program's tracking number, e.g. "HUSAY-2026-0007": the year it was added
 * and its id. It never changes, so /programs/<tracking number> links last.
 */
export function trackingNumber(program: { id: number; createdAt: string }) {
  return `HUSAY-${program.createdAt.slice(0, 4)}-${String(program.id).padStart(4, "0")}`;
}

/** The program id in a tracking number, or null when `text` isn't one. */
export function idFromTrackingNumber(text: string) {
  const match = /^HUSAY-\d{4}-(\d+)$/i.exec(text);
  return match ? Number(match[1]) : null;
}
