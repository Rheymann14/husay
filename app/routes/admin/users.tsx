import { asc, count, eq, sql } from "drizzle-orm";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, useFetcher } from "react-router";
import { z } from "zod";

import { Combobox, type ComboboxOption } from "~/components/combobox";
import { useResultToast, type ActionResult as Result } from "~/components/toaster";
import { getDb, schema } from "~/db/client.server";
import { assertAdmin, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { hashPassword, MIN_PASSWORD_LENGTH } from "~/lib/password";
import type { Route } from "./+types/users";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Users | ${SITE.name}` }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const me = context.get(userContext);
  assertAdmin(me);
  const users = await getDb()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
  return { users, meId: me.id };
}

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200);

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["admin", "manager"]),
  password,
});

export async function action({ request, context }: Route.ActionArgs) {
  const me = context.get(userContext);
  assertAdmin(me);
  const db = getDb();
  const form = await request.formData();
  const intent = form.get("intent");
  const fail = (error: string) =>
    data<Result>({ ok: false, error }, { status: 400 });

  if (intent === "create") {
    const parsed = createSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { password: plain, ...rest } = parsed.data;
    try {
      await db
        .insert(schema.users)
        .values({ ...rest, passwordHash: await hashPassword(plain) });
    } catch (error) {
      if (String(error).includes("UNIQUE")) {
        return fail("A user with that email already exists.");
      }
      throw error;
    }
    return { ok: true, message: `Added ${rest.email}.` } satisfies Result;
  }

  const id = Number(form.get("id"));
  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!target) return fail("User not found.");

  if (intent === "reset-password") {
    const parsed = password.safeParse(form.get("password"));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    await db.batch([
      db
        .update(schema.users)
        .set({
          passwordHash: await hashPassword(parsed.data),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(schema.users.id, id)),
      // Sign the user out everywhere.
      db.delete(schema.sessions).where(eq(schema.sessions.userId, id)),
    ]);
    return { ok: true, message: `Password reset for ${target.email}.` } satisfies Result;
  }

  if (intent === "set-role") {
    const role = z.enum(["admin", "manager"]).safeParse(form.get("role"));
    if (!role.success) return fail("Invalid role.");
    if (id === me.id) return fail("You cannot change your own role.");
    await db
      .update(schema.users)
      .set({ role: role.data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(schema.users.id, id));
    return { ok: true, message: `${target.email} is now ${role.data === "admin" ? "an admin" : "a manager"}.` } satisfies Result;
  }

  if (intent === "delete") {
    if (id === me.id) return fail("You cannot delete your own account.");
    if (target.role === "admin") {
      const [{ n }] = await db
        .select({ n: count() })
        .from(schema.users)
        .where(eq(schema.users.role, "admin"));
      if (n <= 1) return fail("At least one admin must remain.");
    }
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return { ok: true, message: `Removed ${target.email}.` } satisfies Result;
  }

  return fail("Unknown action.");
}

type UserRow = Route.ComponentProps["loaderData"]["users"][number];

const ROLE_OPTIONS: ComboboxOption[] = [
  { value: "manager", label: "Manager", description: "Programs only" },
  { value: "admin", label: "Admin", description: "Programs, statuses and users" },
];

function AddUserForm() {
  const fetcher = useFetcher<Result>();
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  useResultToast(fetcher.data);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      formRef.current?.reset();
      setFormKey((k) => k + 1);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="intent" value="create" />
      <h2 className="font-semibold text-slate-900">Add a user</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input name="name" required className="input mt-1" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required className="input mt-1" />
        </label>
        <label className="block">
          <span className="label">Role</span>
          <span className="mt-1 block">
            <Combobox
              key={formKey}
              name="role"
              defaultValue="manager"
              options={ROLE_OPTIONS}
              searchPlaceholder="Search roles…"
            />
          </span>
        </label>
        <label className="block">
          <span className="label">Temporary password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="input mt-1"
          />
          <p className="hint">
            At least {MIN_PASSWORD_LENGTH} characters. Ask them to change it
            under My account.
          </p>
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={fetcher.state !== "idle"}
          className="btn-primary"
        >
          <UserPlus className="size-4" aria-hidden />
          Add user
        </button>
      </div>
    </fetcher.Form>
  );
}

function UserRowView({ user, isMe }: { user: UserRow; isMe: boolean }) {
  const roleFetcher = useFetcher<Result>();
  const resetFetcher = useFetcher<Result>();
  const deleteFetcher = useFetcher<Result>();
  useResultToast(roleFetcher.data);
  useResultToast(resetFetcher.data);
  useResultToast(deleteFetcher.data);
  const pendingRole = roleFetcher.formData?.get("role");
  const role = pendingRole != null ? String(pendingRole) : user.role;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">
            {user.name} {isMe && <span className="text-xs text-slate-500">(you)</span>}
          </p>
          <p className="truncate text-sm text-slate-600">{user.email}</p>
        </div>
        <Combobox
          className="w-32"
          options={ROLE_OPTIONS}
          value={role}
          disabled={isMe}
          onChange={(next) =>
            roleFetcher.submit(
              { intent: "set-role", id: String(user.id), role: next },
              { method: "post" },
            )
          }
          searchPlaceholder="Search roles…"
          aria-label={`Role of ${user.name}`}
        />
        <button
          type="button"
          className="rounded-md p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-800"
          title="Reset password"
          aria-label={`Reset password for ${user.name}`}
          onClick={() => {
            const pw = prompt(
              `New password for ${user.email} (at least ${MIN_PASSWORD_LENGTH} characters):`,
            );
            if (pw) {
              resetFetcher.submit(
                { intent: "reset-password", id: String(user.id), password: pw },
                { method: "post" },
              );
            }
          }}
        >
          <KeyRound className="size-4" aria-hidden />
        </button>
        {!isMe && (
          <deleteFetcher.Form
            method="post"
            onSubmit={(e) => {
              if (!confirm(`Remove ${user.email}? They will no longer be able to sign in.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={user.id} />
            <button
              type="submit"
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
              title="Remove user"
              aria-label={`Remove ${user.name}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </deleteFetcher.Form>
        )}
      </div>
    </li>
  );
}

export default function Users({ loaderData }: Route.ComponentProps) {
  const { users, meId } = loaderData;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-base font-semibold text-navy-900">Users</h1>
        <p className="text-xs text-slate-500">
          Managers can add and edit programs. Admins can also manage statuses
          and users.
        </p>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {users.map((u) => (
          <UserRowView key={u.id} user={u} isMe={u.id === meId} />
        ))}
      </ul>
      <AddUserForm />
    </div>
  );
}
