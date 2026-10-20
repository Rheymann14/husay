# HUSAY Programs

Public list of CHED HUSAY programs with a briefer for each, and a signed-in area where staff manage programs, statuses and users.

Built with React Router (full-stack React + TypeScript) on Cloudflare Workers, with a Cloudflare D1 (SQLite) database and Drizzle ORM.

## What's in it

**Public page (`/`)**
- Table of programs: No., Program, Title Program, Duration of Program, Status, View
- Click a row to open the program briefer in a panel on the right (full screen on phones)
- Application links (for example “Apply Here”) at the bottom of the briefer
- CHED and Bagong Pilipinas logos in the header

**Admin area (`/admin`, sign-in required)**
- **Programs**: add, edit, delete, change status, publish or hide, set list order, add or remove application link rows
- **Statuses** (admins only): edit the name, color and icon of Ongoing and Closed, or add new statuses
- **Users** (admins only): add managers or admins, reset passwords, change roles, remove users
- **My account**: change your own password

There is no public sign-up. Managers can manage programs; admins can also manage statuses and users.

## Run it on your computer

Requires Node.js 22 or newer.

```bash
npm install
npm run db:migrate:local      # create the local database tables
npm run db:seed:local         # optional: add the sample program from the Annex A briefer
npm run user:create -- --email you@ched.gov.ph --name "Your Name"
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

The Brief Description, Duration details and Target Participants fields support simple formatting:

```
Paragraph text.

- A bullet
  - A sub-bullet (indent with two spaces)
```

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
   npm run user:create -- --email you@ched.gov.ph --name "Your Name" --remote
   ```
5. Deploy:
   ```bash
   npm run deploy
   ```
   The site is published at `https://husay.<your-subdomain>.workers.dev`.

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
  lib/                    auth, data access, formatting, status icons, branding
drizzle/                  SQL migrations
seed/                     sample data for local development
scripts/create-user.ts    create or reset a user from the terminal
```
