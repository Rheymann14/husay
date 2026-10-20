import { asc, eq, sql } from "drizzle-orm";

import { getDb, schema } from "~/db/client.server";

const { programs, programLinks, statuses } = schema;

const statusColumns = {
  name: statuses.name,
  color: statuses.color,
  icon: statuses.icon,
};

/** Programs for the landing page table (published only unless includeDrafts). */
export async function listPrograms({ includeDrafts = false } = {}) {
  const rows = await getDb()
    .select({
      id: programs.id,
      shortName: programs.shortName,
      title: programs.title,
      startDate: programs.startDate,
      endDate: programs.endDate,
      isPublished: programs.isPublished,
      statusId: programs.statusId,
      sortOrder: programs.sortOrder,
      status: statusColumns,
    })
    .from(programs)
    .leftJoin(statuses, eq(statuses.id, programs.statusId))
    .where(includeDrafts ? undefined : eq(programs.isPublished, true))
    .orderBy(asc(programs.sortOrder), asc(programs.id));

  return rows.map((r) => ({ ...r, status: r.status?.name ? r.status : null }));
}

export type ProgramListItem = Awaited<ReturnType<typeof listPrograms>>[number];

/** Full program with its links. Returns null when missing (or a draft, for the public). */
export async function getProgram(id: number, { includeDrafts = false } = {}) {
  const db = getDb();
  const [row] = await db
    .select({ program: programs, status: statusColumns })
    .from(programs)
    .leftJoin(statuses, eq(statuses.id, programs.statusId))
    .where(eq(programs.id, id))
    .limit(1);
  if (!row || (!includeDrafts && !row.program.isPublished)) return null;

  const links = await db
    .select()
    .from(programLinks)
    .where(eq(programLinks.programId, id))
    .orderBy(asc(programLinks.sortOrder), asc(programLinks.id));

  return {
    ...row.program,
    status: row.status?.name ? row.status : null,
    links,
  };
}

export type ProgramInput = Omit<
  typeof programs.$inferInsert,
  "id" | "createdAt" | "updatedAt"
> & { links: { label: string; url: string }[] };

export async function saveProgram(id: number | null, input: ProgramInput) {
  const db = getDb();
  const { links, ...values } = input;

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

  // Replace the link rows with what the form submitted.
  const deleteLinks = db
    .delete(programLinks)
    .where(eq(programLinks.programId, programId));
  if (links.length) {
    await db.batch([
      deleteLinks,
      db.insert(programLinks).values(
        links.map((link, i) => ({
          programId: programId!,
          label: link.label,
          url: link.url,
          sortOrder: i + 1,
        })),
      ),
    ]);
  } else {
    await deleteLinks;
  }
  return programId;
}

export async function setProgramStatus(id: number, statusId: number | null) {
  await getDb()
    .update(programs)
    .set({ statusId, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(programs.id, id));
}

export async function deleteProgram(id: number) {
  await getDb().delete(programs).where(eq(programs.id, id));
}

export async function nextProgramSortOrder() {
  const [row] = await getDb()
    .select({ max: sql<number>`coalesce(max(${programs.sortOrder}), 0)` })
    .from(programs);
  return (row?.max ?? 0) + 1;
}

export async function listStatuses() {
  return getDb()
    .select()
    .from(statuses)
    .orderBy(asc(statuses.sortOrder), asc(statuses.id));
}
