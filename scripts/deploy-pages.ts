// Publishes the built app to Cloudflare Pages, at https://husay.pages.dev.
// Run it through `npm run deploy`, which builds the app first.
//
// Pages serves the browser files from build/client, plus the server code in
// _worker.js/ which answers every other request. They are put together in a
// temporary folder outside the project, so Wrangler doesn't pick up the
// Workers settings the build leaves in .wrangler/.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "husay";
const out = mkdtempSync(join(tmpdir(), "husay-pages-"));

cpSync(join("build", "client"), out, { recursive: true });
cpSync(join("build", "server"), join(out, "_worker.js"), { recursive: true });

// Browser files are served directly, without running the server code.
const exclude = readdirSync(out)
  .filter((name) => name !== "_worker.js")
  .map((name) => (statSync(join(out, name)).isDirectory() ? `/${name}/*` : `/${name}`));
writeFileSync(
  join(out, "_routes.json"),
  JSON.stringify({ version: 1, include: ["/*"], exclude }, null, 2),
);

// Pages settings, taken from the Worker settings the build wrote out.
const worker = JSON.parse(readFileSync(join(out, "_worker.js", "wrangler.json"), "utf8"));
rmSync(join(out, "_worker.js", "wrangler.json"));
writeFileSync(
  join(out, "wrangler.json"),
  JSON.stringify(
    {
      name: PROJECT,
      pages_build_output_dir: ".",
      compatibility_date: worker.compatibility_date,
      compatibility_flags: worker.compatibility_flags,
      d1_databases: worker.d1_databases.map(
        ({ binding, database_name, database_id }: Record<string, string>) => ({
          binding,
          database_name,
          database_id,
        }),
      ),
    },
    null,
    2,
  ),
);

const result = spawnSync(
  "npx",
  ["wrangler", "pages", "deploy", ".", "--project-name", PROJECT, "--branch", "main", "--commit-dirty=true"],
  { cwd: out, stdio: "inherit", shell: true },
);
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
