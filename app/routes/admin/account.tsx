import { and, eq, ne, sql } from "drizzle-orm";
import { data, Form, useNavigation } from "react-router";

import { useResultToast, type ActionResult } from "~/components/toaster";
import { getDb, schema } from "~/db/client.server";
import { getSessionId, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "~/lib/password";
import type { Route } from "./+types/account";

export function meta({}: Route.MetaArgs) {
  return [{ title: `My account | ${SITE.name}` }];
}

export function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(userContext) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const me = context.get(userContext);
  const form = await request.formData();
  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  const fail = (error: string) =>
    data<ActionResult>({ ok: false, error }, { status: 400 });

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, me.id))
    .limit(1);

  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return fail("Your current password is incorrect.");
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return fail(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (next !== confirm) {
    return fail("The new passwords do not match.");
  }

  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(next), updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.users.id, me.id));
  // Sign out other devices; this one stays signed in.
  const currentId = await getSessionId(request);
  if (currentId) {
    await db
      .delete(schema.sessions)
      .where(and(eq(schema.sessions.userId, me.id), ne(schema.sessions.id, currentId)));
  }
  return { ok: true, message: "Your password has been changed." } satisfies ActionResult;
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigation = useNavigation();
  useResultToast(actionData);
  return (
    <div className="mx-auto max-w-md space-y-3">
      <div>
        <h1 className="text-base font-semibold text-navy-900">My account</h1>
        <p className="text-xs text-slate-500">
          {user.name} · {user.email} · <span className="capitalize">{user.role}</span>
        </p>
      </div>
      <Form
        method="post"
        key={actionData?.ok ? "done" : "form"}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <label className="block">
          <span className="label">Current password</span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">New password</span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="input mt-1"
          />
          <p className="hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </label>
        <label className="block">
          <span className="label">Confirm new password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            className="input mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={navigation.state !== "idle"}
          className="btn-primary w-full"
        >
          Change password
        </button>
      </Form>
    </div>
  );
}
