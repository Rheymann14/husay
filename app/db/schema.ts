import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "manager"] })
    .notNull()
    .default("manager"),
  ...timestamps,
});

export const sessions = sqliteTable(
  "sessions",
  {
    // SHA-256 of the session token; the raw token only lives in the cookie.
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const statuses = sqliteTable("statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const programs = sqliteTable(
  "programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shortName: text("short_name").notNull(),
    title: text("title").notNull(),
    provider: text("provider").notNull().default(""),
    description: text("description").notNull().default(""),
    startDate: text("start_date"),
    endDate: text("end_date"),
    durationDetails: text("duration_details").notNull().default(""),
    targetParticipants: text("target_participants").notNull().default(""),
    // Stored in centavos so peso amounts stay exact. Admin-only.
    fundingCentavos: integer("funding_centavos"),
    statusId: integer("status_id").references(() => statuses.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (t) => [index("programs_status_id_idx").on(t.statusId)],
);

export const programLinks = sqliteTable(
  "program_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("program_links_program_id_idx").on(t.programId)],
);

export type User = typeof users.$inferSelect;
export type Status = typeof statuses.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramLink = typeof programLinks.$inferSelect;
