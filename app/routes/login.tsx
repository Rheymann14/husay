import { eq } from "drizzle-orm";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";

import { SiteHeader } from "~/components/site-header";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { getDb, schema } from "~/db/client.server";
import { logActivity } from "~/lib/activity.server";
import { createSession, getUser, safeRedirect } from "~/lib/auth.server";
import { LOGOS, SITE } from "~/lib/branding";
import { verifyPassword } from "~/lib/password";
import type { Route } from "./+types/login";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Sign in | ${SITE.name}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) {
    throw redirect(safeRedirect(new URL(request.url).searchParams.get("redirectTo")));
  }
  return {
    redirectTo: new URL(request.url).searchParams.get("redirectTo") ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const redirectTo = safeRedirect(form.get("redirectTo"));

  const [user] = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return data(
      { ok: false, error: "Incorrect email or password.", email } satisfies ActionResult & { email: string },
      { status: 401 },
    );
  }

  const cookie = await createSession(request, user.id);
  // Only successful sign-ins are logged, so failed attempts can't use up the
  // daily D1 write quota.
  await logActivity({
    user,
    action: "sign_in",
    entity: "account",
    entityId: user.id,
    summary: "Signed in",
  });
  throw redirect(redirectTo, { headers: { "Set-Cookie": cookie } });
}

export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const { redirectTo } = loaderData;
  const [showPassword, setShowPassword] = useState(false);
  useResultToast(actionData);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:pb-24">
        <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex flex-col items-center text-center">
              <img
                src={LOGOS.ched.src}
                alt={LOGOS.ched.alt}
                width={56}
                height={56}
                className="size-14"
              />
              <h1 className="mt-3 text-lg font-semibold text-navy-900">
                Sign in to {SITE.name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                For CHED staff who manage HUSAY programs.
              </p>
            </div>

            <Form method="post" className="mt-6 space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <label className="block">
                <span className="label">Email</span>
                <span className="relative mt-1 block">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@ched.gov.ph"
                    required
                    autoFocus
                    defaultValue={actionData?.email}
                    className="input py-2 pl-9"
                  />
                </span>
              </label>

              <label className="block">
                <span className="label">Password</span>
                <span className="relative mt-1 block">
                  <Lock
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="input py-2 pr-9 pl-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-navy-100 focus-visible:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    data-tooltip={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full py-2"
              >
                {busy && (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                )}
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </Form>
          </div>
          <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50 px-6 py-2.5 text-xs text-slate-500">
            <ShieldCheck className="size-3.5 text-navy-600" aria-hidden />
            Authorized CHED personnel only
          </p>
        </div>

        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to programs
        </Link>
      </main>
    </div>
  );
}
