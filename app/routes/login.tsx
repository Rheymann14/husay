import { eq } from "drizzle-orm";
import { data, Form, redirect, useNavigation } from "react-router";

import { SiteHeader } from "~/components/site-header";
import { getDb, schema } from "~/db/client.server";
import { createSession, getUser, safeRedirect } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
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
      { error: "Incorrect email or password.", email },
      { status: 401 },
    );
  }

  throw redirect(redirectTo, {
    headers: { "Set-Cookie": await createSession(request, user.id) },
  });
}

export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const { redirectTo } = loaderData;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-navy-900">
            Program manager sign in
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            For CHED staff who manage HUSAY programs.
          </p>

          <Form method="post" className="mt-6 space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                defaultValue={actionData?.email}
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input mt-1"
              />
            </label>
            {actionData?.error && (
              <p role="alert" className="text-sm text-red-700">
                {actionData.error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </Form>
        </div>
      </main>
    </div>
  );
}
