import { and, desc, eq, lt, sql } from "drizzle-orm";

import { getDb } from "~/db/client.server";
import { activityLogs, ACTIVITY_ENTITIES } from "~/db/schema";

/** Only the newest entries are kept, so the table never grows past this. */
const MAX_ENTRIES = 5000;

export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export type ActivityEntry = {
  user: { id: number; name: string } | null;
  action: (typeof activityLogs.$inferInsert)["action"];
  entity: ActivityEntity;
  entityId?: string | number | null;
  summary: string;
};

/**
 * Records an action after it succeeded. Runs inside the request that made
 * the change, so it adds no Worker requests. Never throws: a logging problem
 * must not fail the action itself.
 */
export async function logActivity(entry: ActivityEntry) {
  try {
    const db = getDb();
    await db.batch([
      db.insert(activityLogs).values({
        userId: entry.user?.id ?? null,
        userName: entry.user?.name ?? "System",
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId == null ? null : String(entry.entityId),
        summary: entry.summary.slice(0, 300),
      }),
      // Drop the oldest entries. MAX(id) is read from the rowid, so this only
      // touches the rows it removes.
      db
        .delete(activityLogs)
        .where(
          sql`${activityLogs.id} <= (SELECT MAX(${activityLogs.id}) FROM ${activityLogs}) - ${MAX_ENTRIES}`,
        ),
    ]);
  } catch (error) {
    console.error("Could not write the activity log", error);
  }
}

export function isActivityEntity(value: unknown): value is ActivityEntity {
  return ACTIVITY_ENTITIES.includes(value as ActivityEntity);
}

/**
 * Newest first, `limit` at a time. Pages by id (?before=) instead of
 * counting, so a page view reads about `limit` rows.
 */
export async function listActivity({
  before,
  entity,
  limit = 25,
}: {
  before: number | null;
  entity: ActivityEntity | null;
  limit?: number;
}) {
  const rows = await getDb()
    .select()
    .from(activityLogs)
    .where(
      and(
        before != null ? lt(activityLogs.id, before) : undefined,
        entity ? eq(activityLogs.entity, entity) : undefined,
      ),
    )
    .orderBy(desc(activityLogs.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, nextBefore: hasMore ? page[page.length - 1].id : null };
}
