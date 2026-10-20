import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { STATUS_COLORS, STATUS_ICONS } from "../lib/status";

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

// Status names, colors and icons. "upcoming", "ongoing" and "closed" are
// built in (Automatic picks them from the dates); admins can add more.
export const programStatuses = sqliteTable("program_statuses", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  color: text("color", { enum: STATUS_COLORS }).notNull(),
  icon: text("icon", { enum: STATUS_ICONS }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const programs = sqliteTable(
  "programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // The public link, /programs/<slug>. Set from the title when the program is
    // created and kept after that, so shared links don't break.
    slug: text("slug").notNull().default(""),
    shortName: text("short_name").notNull(),
    title: text("title").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    durationDetails: text("duration_details").notNull().default(""),
    // Where the built-in Duration row sits in the briefer: the number of
    // program_sections rows shown before it.
    durationPosition: integer("duration_position").notNull().default(0),
    // "auto" follows the start and end dates, "none" shows no status, anything
    // else is a program_statuses key set manually.
    status: text("status").notNull().default("auto"),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("programs_slug_idx").on(t.slug)],
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
    // Turned off links show as disabled buttons. All links are also disabled
    // while the program is closed, whatever this says.
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("program_links_program_id_idx").on(t.programId)],
);

// Briefer rows an admin adds, e.g. Program Provider or Brief Description.
export const programSections = sqliteTable(
  "program_sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    heading: text("heading").notNull(),
    // Sanitized HTML from the rich text editor.
    body: text("body").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("program_sections_program_id_idx").on(t.programId)],
);

export type User = typeof users.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramLink = typeof programLinks.$inferSelect;
