/**
 * A program's tracking number, e.g. "HUSAY-2026-4831": the year it was added
 * and 4 random digits from 1000 to 9999. It is stored on the program and never
 * changes, so /programs/<tracking number> links last.
 */
export const TRACKING_NO = /^HUSAY-\d{4}-\d{4}$/i;

/** A free tracking number for this year, or null when all 9,000 are taken. */
export function newTrackingNumber(year: string, taken: Set<string>) {
  const free: string[] = [];
  for (let n = 1000; n <= 9999; n++) {
    const no = `HUSAY-${year}-${n}`;
    if (!taken.has(no)) free.push(no);
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

/**
 * The program id in an old tracking number, or null. They were the year and
 * the id as 4 digits ("HUSAY-2026-0007"), so they start with 0 where the
 * random ones never do.
 */
export function idFromOldTrackingNumber(text: string) {
  const match = /^HUSAY-\d{4}-(0\d{3})$/i.exec(text);
  return match ? Number(match[1]) : null;
}
