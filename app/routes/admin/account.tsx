import { and, count, eq, gt, ne, sql } from "drizzle-orm";
import {
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { data, Form, useNavigation } from "react-router";

import { useResultToast, type ActionResult } from "~/components/toaster";
import { getDb, schema } from "~/db/client.server";
import { logActivity } from "~/lib/activity.server";
import { getSessionId, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatTimestamp } from "~/lib/format";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "~/lib/password";
import type { Route } from "./+types/account";

export function meta({}: Route.MetaArgs) {
  return [{ title: `My account | ${SITE.name}` }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const [[profile], [{ sessions }]] = await Promise.all([
    db
      .select({ createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1),
    db
      .select({ sessions: count() })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, user.id), gt(schema.sessions.expiresAt, now))),
  ]);
  return { user, createdAt: profile?.createdAt ?? null, sessions };
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
  await logActivity({
    user: me,
    action: "update",
    entity: "account",
    entityId: me.id,
    summary: "Changed their own password",
  });
  return { ok: true, message: "Your password has been changed." } satisfies ActionResult;
}

const ROLE_DETAILS = {
  admin: { label: "Admin", description: "Can manage programs and users." },
  manager: { label: "Manager", description: "Can add and edit programs." },
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { user, createdAt, sessions } = loaderData;
  const role = ROLE_DETAILS[user.role];
  useResultToast(actionData);
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div>
        <h1 className="text-base font-semibold text-navy-900">My account</h1>
        <p className="text-xs text-slate-500">
          Your profile and sign-in details.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[18rem_1fr] md:items-start">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-2 border-b border-slate-100 bg-navy-50 px-4 py-5 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-full bg-navy-700 text-lg font-semibold text-white ring-4 ring-white"
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{user.name}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-navy-800 ring-1 ring-navy-100">
                <ShieldCheck className="size-3" aria-hidden />
                {role.label}
              </span>
            </div>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            <ProfileRow icon={Mail} label="Email">
              <span className="break-all">{user.email}</span>
            </ProfileRow>
            <ProfileRow icon={ShieldCheck} label="Access">
              {role.description}
            </ProfileRow>
            {createdAt && (
              <ProfileRow icon={CalendarDays} label="Member since">
                {formatTimestamp(createdAt)}
              </ProfileRow>
            )}
            <ProfileRow icon={MonitorSmartphone} label="Signed in on">
              {sessions <= 1 ? "This device only" : `${sessions} devices`}
            </ProfileRow>
          </dl>
        </section>

        <ChangePasswordForm resetKey={actionData?.ok ? "done" : "form"} />
      </div>
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 px-4 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </dt>
        <dd className="text-slate-800">{children}</dd>
      </div>
    </div>
  );
}

function ChangePasswordForm({ resetKey }: { resetKey: string }) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle" && navigation.formMethod === "POST";
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Clear the live checks along with the inputs after a successful change.
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    setNext("");
    setConfirm("");
  }

  const longEnough = next.length >= MIN_PASSWORD_LENGTH;
  const matches = confirm.length > 0 && next === confirm;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
          <KeyRound className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">Change password</h2>
          <p className="text-xs text-slate-500">
            Other devices will be signed out. You stay signed in here.
          </p>
        </div>
      </div>
      <Form method="post" key={resetKey} className="space-y-3 p-4">
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordField
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={next}
            onChange={setNext}
          />
          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
        </div>
        <ul className="space-y-1 text-xs" aria-label="Password requirements">
          <Requirement met={longEnough}>
            At least {MIN_PASSWORD_LENGTH} characters
          </Requirement>
          <Requirement met={matches}>Both new passwords match</Requirement>
        </ul>
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full sm:w-auto"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? "Changing…" : "Change password"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function PasswordField({
  label,
  name,
  autoComplete,
  minLength,
  value,
  onChange,
}: {
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative mt-1 block">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          value={value}
          onChange={onChange && ((e) => onChange(e.target.value))}
          className="input pr-9"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2.5 text-slate-400 hover:text-slate-700 focus-visible:text-navy-700 focus-visible:outline-none"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          data-tooltip={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </span>
    </label>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-1.5 ${met ? "text-emerald-700" : "text-slate-500"}`}
    >
      <span
        className={`flex size-4 items-center justify-center rounded-full ${
          met ? "bg-emerald-100" : "bg-slate-100"
        }`}
      >
        <Check className={`size-3 ${met ? "" : "opacity-0"}`} aria-hidden />
      </span>
      {children}
      <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
    </li>
  );
}
