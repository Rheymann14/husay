// Creates (or resets) a user account directly in the D1 database.
// Use it once to create the first admin; after that, admins add users in the app.
//
//   npm run user:create -- --email you@ched.gov.ph --name "Your Name"            (local)
//   npm run user:create -- --email you@ched.gov.ph --name "Your Name" --remote   (deployed)
//
// Options: --role admin|manager (default admin). The password is asked for
// interactively, or read from the HUSAY_PASSWORD environment variable.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { hashPassword, MIN_PASSWORD_LENGTH } from "../app/lib/password.ts";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "admin" },
    remote: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role;
if (!email || !name) {
  fail('Usage: npm run user:create -- --email you@example.com --name "Your Name" [--role admin|manager] [--remote]');
}
if (role !== "admin" && role !== "manager") fail("--role must be admin or manager");

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    process.stdout.write(question);
    output._writeToOutput = () => {}; // hide typed characters
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

let password = process.env.HUSAY_PASSWORD ?? "";
if (!password) {
  password = await askHidden(`Password for ${email} (min ${MIN_PASSWORD_LENGTH} chars): `);
  const again = await askHidden("Type it again: ");
  if (password !== again) fail("Passwords do not match.");
}
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const hash = await hashPassword(password);
const sql = `INSERT INTO users (name, email, password_hash, role) VALUES (${q(name)}, ${q(email)}, ${q(hash)}, ${q(role)})
ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, role = excluded.role, updated_at = CURRENT_TIMESTAMP;`;

const dir = mkdtempSync(join(tmpdir(), "husay-"));
const file = join(dir, "create-user.sql");
writeFileSync(file, sql);
try {
  const target = values.remote ? "--remote" : "--local";
  const result = spawnSync(
    `npx wrangler d1 execute husay-db ${target} --file "${file}"`,
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) fail("Could not write the user to the database.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n✔ ${role} account ready for ${email} (${values.remote ? "deployed" : "local"} database).`);
