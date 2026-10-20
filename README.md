# HUSAY Programs

Public list of CHED HUSAY programs with a briefer for each, and a signed-in area where staff manage programs and users.

Built with React Router (full-stack React + TypeScript) on Cloudflare Workers, with a Cloudflare D1 (SQLite) database and Drizzle ORM.

## What's in it

**Public page (`/`)**
- Table of programs: No., Program, Title Program, Duration of Program, Status, View, listed by date (earliest start first)
- Click a row to open the program briefer in a panel on the right (full screen on phones)
- Application links (for example “Apply Here”) at the bottom of the briefer
- CHED and Bagong Pilipinas logos in the header

**Admin area (`/admin`, sign-in required)**
- **Programs**: search, add, edit, delete, change status, publish or hide, add or remove application link rows
- **Users** (admins only): search, add managers or admins, reset passwords, change roles, remove users
- **My account**: change your own password

There is no public sign-up. Managers can manage programs; admins can also manage users and statuses.

## Program status

Each program shows one of three built-in statuses, or none:

- **Upcoming** (orange): before the start date
- **Ongoing** (green): from the start date through the end date
- **Closed** (red): after the end date
- **No status** (gray): no dates set

By default a program's status is **Automatic** and follows its dates (Philippine time).
Anyone managing programs can override it with a fixed status from the program list or
the program form, and switch it back to Automatic at any time.

Admins can pick **Configure statuses…** at the bottom of any status dropdown to rename
statuses, change their color or icon (from a short list), or add statuses of their own
to set by hand. The three built-in statuses can't be removed. Programs set to a removed
status go back to Automatic.

## Run it on your computer

Requires Node.js 22 or newer.

```bash
npm install
npm run db:migrate:local      # create the local database tables
npm run db:seed:local         # optional: add the sample program from the Annex A briefer
npm run user:create            # asks for your email, name and password
npm run dev
```

Open http://localhost:5173. Sign in at http://localhost:5173/login.

## Add the logos

Put the logo files in `public/logos/`, then set their file names in `app/lib/branding.ts`:

```ts
ched: { src: "/logos/ched.png", ... },
bagongPilipinas: { src: "/logos/bagong-pilipinas.png", ... },
```

Square images with a transparent or white background look best. They are shown in a circle.

## Writing program text

Each program has four fixed fields: Program, Program Title, Duration of Program
and Status. Everything else in the briefer (Program Provider, Brief Description,
Target Participants, and any other row) is a row the admin adds, renames,
reorders or removes. The built-in Duration row can be moved but not removed.

Row text uses a rich text editor (bold, italic, underline, bullets, sub-bullets
with Tab, links). Drag its bottom-right corner to resize it, or use the expand
button to edit in full screen.

## Deploy to Cloudflare (free)

1. Create a free Cloudflare account, then sign in from the terminal:
   ```bash
   npx wrangler login
   ```
2. Create the database:
   ```bash
   npx wrangler d1 create husay-db
   ```
   Copy the `database_id` it prints into `wrangler.jsonc` (replace the `00000000-…` placeholder).
3. Create the tables in the online database:
   ```bash
   npm run db:migrate:remote
   ```
4. Create your admin account in the online database:
   ```bash
   npm run user:create:remote
   ```
5. Create the Cloudflare Pages project (once), then deploy:
   ```bash
   npx wrangler pages project create husay --production-branch main --force
   npm run deploy
   ```
   The site is published at `https://husay.pages.dev`. `--force` makes it a real
   Pages project; without it Wrangler makes a Worker at `husay.<account>.workers.dev`.

To publish later changes, run `npm run deploy` again.

## Changing the database

1. Edit `app/db/schema.ts`
2. `npm run db:generate` to create a migration in `drizzle/`
3. `npm run db:migrate:local`, and `npm run db:migrate:remote` before deploying

## Project layout

```
app/
  routes.ts               route list
  routes/home.tsx         public program list
  routes/program-detail.tsx  briefer panel
  routes/admin/           admin pages
  db/schema.ts            database tables
  lib/                    auth, data access, formatting, program status, branding
drizzle/                  SQL migrations
seed/                     sample data for local development
scripts/create-user.ts    create or reset a user from the terminal
```
