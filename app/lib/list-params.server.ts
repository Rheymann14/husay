import { sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

export type ListParams = { query: string; page: number; pageSize: number };

/** Reads ?q= and ?page= for a searchable, paged list. */
export function getListParams(request: Request, pageSize = 10): ListParams {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1);
  return { query, page, pageSize };
}

/** Case-insensitive "contains" match, with LIKE wildcards in the query escaped. */
export function contains(column: SQLiteColumn, query: string): SQL {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return sql`${column} like ${`%${escaped}%`} escape '\\'`;
}
