import {
  and,
  asc,
  count,
  eq,
  inArray,
  like,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { getDb, schema } from "~/db/client.server";
import { contains, type ListParams } from "~/lib/list-params.server";
import { slugify } from "~/lib/slug";
import {
  AUTO_STATUS_KEYS,
  isAutoStatusKey,
  isProgramClosed,
  resolveStatus,
  statusFromDates,
  todayInManila,
  type StatusColor,
  type StatusDef,
  type StatusIcon,
  type StatusSetting,
} from "~/lib/status";

const {
  programs,
  programLinks,
  programOldSlugs,
  programSections,
  programStatuses,
} = schema;

// By date: earliest start first, then earliest end; programs without dates last.
const byDate = [
  sql`${programs.startDate} is null`,
  asc(programs.startDate),
  sql`${programs.endDate} is null`,
  asc(programs.endDate),
  asc(programs.id),
];

const listColumns = {
  id: programs.id,
  slug: programs.slug,
  shortName: programs.shortName,
  title: programs.title,
  startDate: programs.startDate,
  endDate: programs.endDate,
  isPublished: programs.isPublished,
  statusSetting: programs.status,
};

/**
 * Adds `status`, the one visitors see, and `autoStatus`, the key "Automatic"
 * works out to from the dates.
 */
function withStatus<
  T extends {
    statusSetting: StatusSetting;
    startDate: string | null;
    endDate: string | null;
  },
>(row: T, statuses: StatusDef[], today = todayInManila()) {
  return {
    ...row,
    status: resolveStatus(row.statusSetting, row.startDate, row.endDate, today, statuses),
    autoStatus: statusFromDates(row.startDate, row.endDate, today),
  };
}

export const PROGRAM_SORT_KEYS = [
  "no",
  "provider",
  "title",
  "duration",
  "status",
] as const;
export type ProgramSortKey = (typeof PROGRAM_SORT_KEYS)[number];
export type ProgramSort = { key: ProgramSortKey; dir: "asc" | "desc" };

/** Reads ?sort= and ?dir=. No. ascending (by date) is the default. */
export function getProgramSort(request: Request): ProgramSort {
  const url = new URL(request.url);
  const key = url.searchParams.get("sort") ?? "";
  return {
    key: (PROGRAM_SORT_KEYS as readonly string[]).includes(key)
      ? (key as ProgramSortKey)
      : "no",
    dir: url.searchParams.get("dir") === "desc" ? "desc" : "asc",
  };
}

const byText = (a: string, b: string) =>
  a.localeCompare(b, "en", { sensitivity: "base", numeric: true });

/** A date compare that keeps "To be announced" last either way. */
const byDateValue = (a: string | null, b: string | null, dir: number) =>
  a === b ? 0 : a == null ? 1 : b == null ? -1 : dir * byText(a, b);

/**
 * One page of programs matching the search. Admins see drafts too; the
 * landing page passes `publishedOnly`. Each program's `no` is its place in
 * the date order, so it stays with the program when the list is re-sorted.
 */
export async function searchPrograms(
  { query, page, pageSize }: ListParams,
  {
    publishedOnly = false,
    sort = { key: "no", dir: "asc" },
  }: { publishedOnly?: boolean; sort?: ProgramSort } = {},
) {
  const db = getDb();
  const where = and(
    publishedOnly ? eq(programs.isPublished, true) : undefined,
    query
      ? or(contains(programs.shortName, query), contains(programs.title, query))
      : undefined,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(programs)
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const offset = (current - 1) * pageSize;
  const byDefault = sort.key === "no" && sort.dir === "asc";

  // The default order pages in the database. Any other order needs every
  // match (status is worked out from the dates), so it pages here instead.
  const select = db
    .select(listColumns)
    .from(programs)
    .where(where)
    .orderBy(...byDate);
  const [rows, statuses] = await Promise.all([
    byDefault ? select.limit(pageSize).offset(offset) : select,
    listStatuses(),
  ]);
  const today = todayInManila();
  const numbered = rows.map((r, i) => ({
    ...withStatus(r, statuses, today),
    no: (byDefault ? offset : 0) + i + 1,
  }));
  if (!byDefault) {
    const dir = sort.dir === "desc" ? -1 : 1;
    // Statuses go in their saved order, with programs showing none last.
    const statusRank = (s: StatusDef | null) => {
      const i = s ? statuses.findIndex((d) => d.key === s.key) : -1;
      return i === -1 ? statuses.length : i;
    };
    type Row = (typeof numbered)[number];
    const compare: Record<ProgramSortKey, (a: Row, b: Row) => number> = {
      no: (a, b) => dir * (a.no - b.no),
      provider: (a, b) => dir * byText(a.shortName, b.shortName),
      title: (a, b) => dir * byText(a.title, b.title),
      duration: (a, b) =>
        byDateValue(a.startDate, b.startDate, dir) ||
        byDateValue(a.endDate, b.endDate, dir),
      status: (a, b) => dir * (statusRank(a.status) - statusRank(b.status)),
    };
    // Ties keep the date order.
    numbered.sort((a, b) => compare[sort.key](a, b) || a.no - b.no);
  }
  return {
    programs: byDefault ? numbered : numbered.slice(offset, offset + pageSize),
    statuses,
    total,
    page: current,
    pageCount,
    pageSize,
  };
}

export type ProgramListItem = Awaited<
  ReturnType<typeof searchPrograms>
>["programs"][number];

/** Full program with its links and extra rows. Returns null when missing (or a draft, for the public). */
export function getProgram(id: number, { includeDrafts = false } = {}) {
  return loadProgram(eq(programs.id, id), includeDrafts);
}

/** The published program at /programs/<slug>, or null. */
export function getProgramBySlug(slug: string) {
  return loadProgram(eq(programs.slug, slug), false);
}

/** The current slug of the program that used to be at `oldSlug`, or null. */
export async function getRenamedSlug(oldSlug: string) {
  const [row] = await getDb()
    .select({ slug: programs.slug })
    .from(programOldSlugs)
    .innerJoin(programs, eq(programs.id, programOldSlugs.programId))
    .where(eq(programOldSlugs.slug, oldSlug))
    .limit(1);
  return row?.slug ?? null;
}

async function loadProgram(where: SQL, includeDrafts: boolean) {
  const db = getDb();
  const [program] = await db.select().from(programs).where(where).limit(1);
  if (!program || (!includeDrafts && !program.isPublished)) return null;

  const [links, sections, statuses] = await Promise.all([
    db
      .select()
      .from(programLinks)
      .where(eq(programLinks.programId, program.id))
      .orderBy(asc(programLinks.sortOrder), asc(programLinks.id)),
    db
      .select()
      .from(programSections)
      .where(eq(programSections.programId, program.id))
      .orderBy(asc(programSections.sortOrder), asc(programSections.id)),
    listStatuses(),
  ]);

  const { status: statusSetting, ...rest } = program;
  const withStatuses = withStatus({ ...rest, statusSetting }, statuses);
  const closed = isProgramClosed(
    withStatuses.status?.key,
    withStatuses.autoStatus,
  );
  return {
    ...withStatuses,
    closed,
    // `isEnabled` is the admin's toggle; `isActive` is whether visitors can use it.
    links: links.map((link) => ({
      ...link,
      isActive: link.isEnabled && !closed,
    })),
    sections,
  };
}

export type ProgramInput = Omit<
  typeof programs.$inferInsert,
  "id" | "slug" | "createdAt" | "updatedAt"
> & {
  links: { label: string; url: string; isEnabled: boolean }[];
  sections: { heading: string; body: string }[];
};

export async function saveProgram(id: number | null, input: ProgramInput) {
  const db = getDb();
  const { links, sections, ...values } = input;

  let programId = id;
  // Set when a new title moves the program to a new slug.
  let renamed: { from: string; to: string } | null = null;
  if (programId == null) {
    const [created] = await db
      .insert(programs)
      .values({ ...values, slug: await freeSlug(values.title) })
      .returning({ id: programs.id });
    programId = created.id;
  } else {
    const [current] = await db
      .select({ slug: programs.slug })
      .from(programs)
      .where(eq(programs.id, programId));
    if (current && !slugMatches(current.slug, values.title)) {
      renamed = { from: current.slug, to: await freeSlug(values.title) };
    }
    await db
      .update(programs)
      .set({
        ...values,
        ...(renamed && { slug: renamed.to }),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(programs.id, programId));
  }

  // Replace the link and extra rows with what the form submitted.
  const writes: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    db.delete(programLinks).where(eq(programLinks.programId, programId)),
    db.delete(programSections).where(eq(programSections.programId, programId)),
  ];
  if (renamed) {
    // The old link now redirects here. The new slug is live, so it is no
    // longer anyone's old link.
    writes.push(
      db
        .insert(programOldSlugs)
        .values({ slug: renamed.from, programId })
        .onConflictDoUpdate({
          target: programOldSlugs.slug,
          set: { programId },
        }),
      db.delete(programOldSlugs).where(eq(programOldSlugs.slug, renamed.to)),
    );
  }
  if (links.length) {
    writes.push(
      db.insert(programLinks).values(
        links.map((link, i) => ({
          programId: programId!,
          label: link.label,
          url: link.url,
          isEnabled: link.isEnabled,
          sortOrder: i + 1,
        })),
      ),
    );
  }
  if (sections.length) {
    writes.push(
      db.insert(programSections).values(
        sections.map((section, i) => ({
          programId: programId!,
          heading: section.heading,
          body: section.body,
          sortOrder: i + 1,
        })),
      ),
    );
  }
  await db.batch(writes);
  return programId;
}

/** Whether `slug` is what freeSlug() could give for this title. */
function slugMatches(slug: string, title: string) {
  const base = slugify(title) || "program";
  return slug === base || new RegExp(`^${base}-\\d+$`).test(slug);
}

/** The title's slug, or with "-2", "-3"… added when another program has it. */
async function freeSlug(title: string) {
  const base = slugify(title) || "program";
  const taken = new Set(
    (
      await getDb()
        .select({ slug: programs.slug })
        .from(programs)
        .where(or(eq(programs.slug, base), like(programs.slug, `${base}-%`)))
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Returns the program's short name, or undefined when it doesn't exist. */
export async function setProgramStatus(id: number, status: StatusSetting) {
  const [row] = await getDb()
    .update(programs)
    .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(programs.id, id))
    .returning({ shortName: programs.shortName });
  return row?.shortName;
}

/** Returns the removed program's short name, or undefined when it didn't exist. */
export async function deleteProgram(id: number) {
  const [row] = await getDb()
    .delete(programs)
    .where(eq(programs.id, id))
    .returning({ shortName: programs.shortName });
  return row?.shortName;
}

/** Built-in statuses first, then the ones admins added, in their saved order. */
export async function listStatuses(): Promise<StatusDef[]> {
  return getDb()
    .select({
      key: programStatuses.key,
      name: programStatuses.name,
      color: programStatuses.color,
      icon: programStatuses.icon,
    })
    .from(programStatuses)
    .orderBy(asc(programStatuses.sortOrder), asc(programStatuses.key));
}

/** "auto", "none" or the key of an existing status. */
export async function isValidStatusSetting(setting: string) {
  if (setting === "auto" || setting === "none") return true;
  return (await listStatuses()).some((s) => s.key === setting);
}

export type StatusInput = {
  /** null for a new status. */
  key: string | null;
  name: string;
  color: StatusColor;
  icon: StatusIcon;
};

/**
 * Replaces the status list with `input`, in that order. Built-in statuses
 * are never removed. Programs set to a removed status go back to Automatic.
 */
export async function saveStatuses(input: StatusInput[]) {
  const db = getDb();
  const rows = input.map((s, i) => ({
    key: s.key ?? `custom-${crypto.randomUUID().slice(0, 8)}`,
    name: s.name,
    color: s.color,
    icon: s.icon,
    sortOrder: i + 1,
  }));
  const keep = [...AUTO_STATUS_KEYS, ...rows.map((r) => r.key)];
  const before = await listStatuses();
  const removed = before
    .filter((s) => !isAutoStatusKey(s.key) && !keep.includes(s.key))
    .map((s) => s.key);

  const writes: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    db.delete(programStatuses).where(notInArray(programStatuses.key, keep)),
  ];
  if (removed.length) {
    writes.push(
      db
        .update(programs)
        .set({ status: "auto", updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(inArray(programs.status, removed)),
    );
  }
  for (const row of rows) {
    writes.push(
      db
        .insert(programStatuses)
        .values(row)
        .onConflictDoUpdate({
          target: programStatuses.key,
          set: {
            name: row.name,
            color: row.color,
            icon: row.icon,
            sortOrder: row.sortOrder,
          },
        }),
    );
  }
  await db.batch(writes);

  const added = input.filter((s) => s.key == null).length;
  const changed = input.filter((s) => {
    const old = before.find((b) => b.key === s.key);
    return old && (old.name !== s.name || old.color !== s.color || old.icon !== s.icon);
  }).length;
  return { added, changed, removed: removed.length };
}
