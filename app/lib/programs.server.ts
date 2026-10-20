import { and, asc, count, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { getDb, schema } from "~/db/client.server";
import { contains, type ListParams } from "~/lib/list-params.server";
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

const { programs, programLinks, programSections, programStatuses } = schema;

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

/**
 * One page of programs matching the search. Admins see drafts too; the
 * landing page passes `publishedOnly`.
 */
export async function searchPrograms(
  { query, page, pageSize }: ListParams,
  { publishedOnly = false } = {},
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
  const [rows, statuses] = await Promise.all([
    db
      .select(listColumns)
      .from(programs)
      .where(where)
      .orderBy(...byDate)
      .limit(pageSize)
      .offset((current - 1) * pageSize),
    listStatuses(),
  ]);
  const today = todayInManila();
  return {
    programs: rows.map((r) => withStatus(r, statuses, today)),
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
export async function getProgram(id: number, { includeDrafts = false } = {}) {
  const db = getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id))
    .limit(1);
  if (!program || (!includeDrafts && !program.isPublished)) return null;

  const [links, sections, statuses] = await Promise.all([
    db
      .select()
      .from(programLinks)
      .where(eq(programLinks.programId, id))
      .orderBy(asc(programLinks.sortOrder), asc(programLinks.id)),
    db
      .select()
      .from(programSections)
      .where(eq(programSections.programId, id))
      .orderBy(asc(programSections.sortOrder), asc(programSections.id)),
    listStatuses(),
  ]);

  const { status: statusSetting, ...rest } = program;
  const withStatuses = withStatus({ ...rest, statusSetting }, statuses);
  const closed = isProgramClosed(withStatuses.status?.key, withStatuses.autoStatus);
  return {
    ...withStatuses,
    closed,
    // `isEnabled` is the admin's toggle; `isActive` is whether visitors can use it.
    links: links.map((link) => ({ ...link, isActive: link.isEnabled && !closed })),
    sections,
  };
}

export type ProgramInput = Omit<
  typeof programs.$inferInsert,
  "id" | "createdAt" | "updatedAt"
> & {
  links: { label: string; url: string; isEnabled: boolean }[];
  sections: { heading: string; body: string }[];
};

export async function saveProgram(id: number | null, input: ProgramInput) {
  const db = getDb();
  const { links, sections, ...values } = input;

  let programId = id;
  if (programId == null) {
    const [created] = await db
      .insert(programs)
      .values(values)
      .returning({ id: programs.id });
    programId = created.id;
  } else {
    await db
      .update(programs)
      .set({ ...values, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(programs.id, programId));
  }

  // Replace the link and extra rows with what the form submitted.
  const writes: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    db.delete(programLinks).where(eq(programLinks.programId, programId)),
    db.delete(programSections).where(eq(programSections.programId, programId)),
  ];
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

export async function setProgramStatus(id: number, status: StatusSetting) {
  await getDb()
    .update(programs)
    .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(programs.id, id));
}

export async function deleteProgram(id: number) {
  await getDb().delete(programs).where(eq(programs.id, id));
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
  const removed = (await listStatuses())
    .map((s) => s.key)
    .filter((key) => !isAutoStatusKey(key) && !keep.includes(key));

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
          set: { name: row.name, color: row.color, icon: row.icon, sortOrder: row.sortOrder },
        }),
    );
  }
  await db.batch(writes);
}
