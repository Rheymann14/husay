import { defineConfig } from "drizzle-kit";

// Only used to generate SQL migrations into ./drizzle.
// Apply them with `npm run db:migrate:local` or `npm run db:migrate:remote`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./app/db/schema.ts",
  out: "./drizzle",
});
