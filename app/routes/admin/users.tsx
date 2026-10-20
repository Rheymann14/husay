import { asc, count, eq, or, sql } from "drizzle-orm";
import { KeyRound, SearchX, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { data, useFetcher } from "react-router";
import { z } from "zod";

import { Combobox, type ComboboxOption } from "~/components/combobox";
import { ConfirmDialog, Dialog } from "~/components/dialog";
import { ClearSearchLink, EmptyState } from "~/components/empty-state";
import { Pagination, SearchBox } from "~/components/list-controls";
import { useResultToast, type ActionResult as Result } from "~/components/toaster";
import { getDb, schema } from "~/db/client.server";
import { logActivity } from "~/lib/activity.server";
import { assertAdmin, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatTimestamp } from "~/lib/format";
import { contains, getListParams } from "~/lib/list-params.server";
import { hashPassword, MIN_PASSWORD_LENGTH } from "~/lib/password";
import type { Route } from "./+types/users";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Users | ${SITE.name}` }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const me = context.get(userContext);
  assertAdmin(me);
  const db = getDb();
  const { query, page, pageSize } = getListParams(request);
  const where = query
    ? or(contains(schema.users.name, query), contains(schema.users.email, query))
    : undefined;
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.users)
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(where)
    .orderBy(asc(schema.users.name), asc(schema.users.id))
    .limit(pageSize)
    .offset((current - 1) * pageSize);
  return {
    users,
    meId: me.id,
    query,
    total,
    page: current,
    pageCount,
    pageSize,
  };
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
      const [created] = await db
        .insert(schema.users)
        .values({ ...rest, passwordHash: await hashPassword(plain) })
        .returning({ id: schema.users.id });
      await logActivity({
        user: me,
        action: "create",
        entity: "user",
        entityId: created.id,
        summary: `Added ${rest.role} ${rest.email}`,
      });
    } catch (error) {
      // Drizzle wraps the D1 error, which is kept as the cause.
      const cause = error instanceof Error ? error.cause : undefined;
      if (`${error} ${cause}`.includes("UNIQUE")) {
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
    await logActivity({
      user: me,
      action: "update",
      entity: "user",
      entityId: id,
      summary: `Reset the password of ${target.email}`,
    });
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
    if (role.data !== target.role) {
      await logActivity({
        user: me,
        action: "update",
        entity: "user",
        entityId: id,
        summary: `Changed the role of ${target.email} to ${role.data}`,
      });
    }
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
    await logActivity({
      user: me,
      action: "delete",
      entity: "user",
      entityId: id,
      summary: `Removed ${target.role} ${target.email}`,
    });
    return { ok: true, message: `Removed ${target.email}.` } satisfies Result;
  }

  return fail("Unknown action.");
}

type UserRow = Route.ComponentProps["loaderData"]["users"][number];

const ROLE_OPTIONS: ComboboxOption[] = [
  { value: "manager", label: "Manager", description: "Programs only" },
  { value: "admin", label: "Admin", description: "Programs and users" },
];

function AddUserDialog() {
  const [open, setOpen] = useState(false);
  // Each opening gets a fresh form and fetcher, so old input and errors are gone.
  const [attempt, setAttempt] = useState(0);
  const fetcher = useFetcher<Result>({ key: `add-user-${attempt}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (fetcher.state === "idle" && result?.ok) setOpen(false);
  }, [fetcher.state, result]);
  // Errors show inside the dialog, which would cover a toast.
  useResultToast(result?.ok ? result : undefined);

  return (
    <>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setAttempt((n) => n + 1);
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" aria-hidden />
        Add user
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a user"
        description="They sign in with this email and the temporary password."
      >
        <fetcher.Form key={attempt} method="post" className="space-y-3">
          <input type="hidden" name="intent" value="create" />
          <label className="block">
            <span className="label">Name</span>
            <input name="name" required data-autofocus className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required className="input mt-1" />
          </label>
          <fieldset>
            <legend className="label">Role</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-300 px-2.5 py-2 has-checked:border-navy-600 has-checked:bg-navy-50"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    defaultChecked={role.value === "manager"}
                    className="mt-0.5 accent-navy-700"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      {role.label}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {role.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
          {result && !result.ok && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {result.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              <UserPlus className="size-4" aria-hidden />
              {busy ? "Adding…" : "Add user"}
            </button>
          </div>
        </fetcher.Form>
      </Dialog>
    </>
  );
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const [open, setOpen] = useState(false);
  // Each opening gets a fresh form and fetcher, so old input and errors are gone.
  const [attempt, setAttempt] = useState(0);
  const fetcher = useFetcher<Result>({ key: `reset-password-${user.id}-${attempt}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (fetcher.state === "idle" && result?.ok) setOpen(false);
  }, [fetcher.state, result]);
  // Errors show inside the dialog, which would cover a toast.
  useResultToast(result?.ok ? result : undefined);

  return (
    <>
      <button
        type="button"
        className="rounded-md p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-800"
        data-tooltip="Reset password"
        aria-label={`Reset password for ${user.name}`}
        onClick={() => {
          setAttempt((n) => n + 1);
          setOpen(true);
        }}
      >
        <KeyRound className="size-4" aria-hidden />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset password"
        description={`${user.name} (${user.email}) will be signed out everywhere.`}
      >
        <fetcher.Form key={attempt} method="post" className="space-y-3">
          <input type="hidden" name="intent" value="reset-password" />
          <input type="hidden" name="id" value={user.id} />
          <label className="block">
            <span className="label">New password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              data-autofocus
              className="input mt-1"
            />
            <p className="hint">
              At least {MIN_PASSWORD_LENGTH} characters. Ask them to change it
              under My account.
            </p>
          </label>
          {result && !result.ok && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {result.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              <KeyRound className="size-4" aria-hidden />
              {busy ? "Resetting…" : "Reset password"}
            </button>
          </div>
        </fetcher.Form>
      </Dialog>
    </>
  );
}

function UserRowView({ user, isMe }: { user: UserRow; isMe: boolean }) {
  const roleFetcher = useFetcher<Result>();
  const deleteFetcher = useFetcher<Result>();
  useResultToast(roleFetcher.data);
  useResultToast(deleteFetcher.data);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const pendingRole = roleFetcher.formData?.get("role");
  const role = pendingRole != null ? String(pendingRole) : user.role;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 font-medium text-slate-900">
        {user.name}{" "}
        {isMe && <span className="text-xs font-normal text-slate-500">(you)</span>}
      </td>
      <td className="px-3 py-2 text-slate-600">{user.email}</td>
      <td className="px-3 py-2">
        <Combobox
          size="sm"
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
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
        {formatTimestamp(user.createdAt)}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <ResetPasswordDialog user={user} />
          {!isMe && (
            <>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleteFetcher.state !== "idle"}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                data-tooltip="Remove user"
                aria-label={`Remove ${user.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              <ConfirmDialog
                open={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                onConfirm={() =>
                  deleteFetcher.submit(
                    { intent: "delete", id: String(user.id) },
                    { method: "post" },
                  )
                }
                title="Remove user?"
                message={`${user.name} (${user.email}) will no longer be able to sign in.`}
                confirmLabel="Remove"
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Users({ loaderData }: Route.ComponentProps) {
  const { users, meId, query, total, page, pageCount, pageSize } = loaderData;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-navy-900">Users</h1>
          <p className="text-xs text-slate-500">
            Managers can add and edit programs. Admins can also manage users.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchBox placeholder="Search name or email…" />
          <AddUserDialog />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {users.length === 0 ? (
          query ? (
            <EmptyState
              icon={SearchX}
              title={`No users match “${query}”`}
              description="Search by name or email address."
              action={<ClearSearchLink />}
            />
          ) : (
            <EmptyState
              icon={UsersIcon}
              title="No users yet"
              description="Add managers or admins with “Add user”."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Added</th>
                  <th className="w-24 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <UserRowView key={u.id} user={u} isMe={u.id === meId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          noun={total === 1 ? "user" : "users"}
        />
      </div>
    </div>
  );
}
