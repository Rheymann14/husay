// Creates (or resets) a user account directly in the D1 database.
// Use it once to create the first admin; after that, admins add users in the app.
//
//   npm run user:create            asks for email, name and password (local database)
//   npm run user:create:remote     same, for the deployed database
//
// You can also pass options: --email you@ched.gov.ph --name "Your Name"
// --role admin|manager (default admin). The password can come from the
// HUSAY_PASSWORD environment variable instead of the prompt.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import { hashPassword, MIN_PASSWORD_LENGTH } from "../app/lib/password.ts";

const { values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    remote: { type: "boolean" },
  },
});

// Windows PowerShell can drop the "--" in "npm run user:create -- --email ...",
// so npm keeps the options for itself. Anything missing is asked for instead.
const option = (key: "email" | "name" | "role") => values[key];
const remote = values.remote ?? false;

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

let pipedLines: Promise<string[]> | undefined;
function readPipedLines() {
  pipedLines ??= new Promise((resolve) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (text += chunk));
    process.stdin.on("end", () => resolve(text.split(/\r?\n/)));
  });
  return pipedLines;
}

/** Asks for a password, showing "*" for each typed character. */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(question);

  // Piped input (not a terminal): take the next line.
  if (!stdin.isTTY) {
    return readPipedLines().then((lines) => {
      process.stdout.write("\n");
      return lines.shift() ?? "";
    });
  }

  return new Promise((resolve) => {
    let value = "";
    const done = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          // Ctrl+C
          done();
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (ch >= " ") {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

/** Asks a visible question and returns the answer. */
async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    process.stdout.write(question);
    const lines = await readPipedLines();
    process.stdout.write("\n");
    return lines.shift() ?? "";
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

const target = remote ? "deployed" : "local";
console.log(`Create a HUSAY user in the ${target} database.\n`);

const email = (option("email") ?? (await ask("Email: "))).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.");
const name = (option("name") ?? (await ask("Full name: "))).trim();
if (!name) fail("Enter a name.");
const role = option("role") ?? "admin";
if (role !== "admin" && role !== "manager") fail("--role must be admin or manager");

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
  const result = spawnSync(
    `npx wrangler d1 execute husay-db ${remote ? "--remote" : "--local"} --file "${file}"`,
    { stdio: "inherit", shell: true },
  );
  if (result.status !== 0) fail("Could not write the user to the database.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\n✔ ${role} account ready for ${email} (${target} database).`);
