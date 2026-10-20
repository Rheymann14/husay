/**
 * "Program Name: Phase 1" -> "program-name-phase-1", at most `max` characters,
 * cut after a whole word. drizzle/0009_program_slug.sql does the same in SQL.
 */
export function slugify(text: string, max = 60) {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  const words = slug
    .slice(0, max + 1)
    .replace(/[a-z0-9]+$/, "")
    .replace(/-+$/, "");
  // One very long word: cut it.
  return words || slug.slice(0, max);
}
