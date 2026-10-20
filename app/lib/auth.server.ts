import { and, eq, gt, lt } from "drizzle-orm";
import { createContext, redirect } from "react-router";

import { getDb, schema } from "~/db/client.server";
import type { User } from "~/db/schema";

const COOKIE_NAME = "husay_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export const userContext = createContext<SessionUser>();

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookieHeader(request: Request, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** The stored id of the current session, if the request has a session cookie. */
export async function getSessionId(request: Request): Promise<string | null> {
  const token = readCookie(request, COOKIE_NAME);
  return token ? sha256(token) : null;
}

/** Creates a session and returns the Set-Cookie header value. */
export async function createSession(request: Request, userId: number) {
  const db = getDb();
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);

  // Opportunistic cleanup of expired sessions.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.insert(schema.sessions).values({
    id: await sha256(token),
    userId,
    expiresAt: now + SESSION_TTL_SECONDS,
  });
  return cookieHeader(request, token, SESSION_TTL_SECONDS);
}

/** Deletes the current session and returns a Set-Cookie header that clears it. */
export async function destroySession(request: Request) {
  const token = readCookie(request, COOKIE_NAME);
  if (token) {
    await getDb()
      .delete(schema.sessions)
      .where(eq(schema.sessions.id, await sha256(token)));
  }
  return cookieHeader(request, "", 0);
}

export async function getUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const [row] = await getDb()
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.id, await sha256(token)),
        gt(schema.sessions.expiresAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Route middleware: requires a signed-in user, otherwise redirects to /login. */
export async function requireUserMiddleware({
  request,
  context,
}: {
  request: Request;
  context: { set: (ctx: typeof userContext, value: SessionUser) => void };
}) {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(
      `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }
  context.set(userContext, user);
}

/** Throws 403 unless the user is an admin. */
export function assertAdmin(user: SessionUser) {
  if (user.role !== "admin") {
    throw new Response("Only admins can do this.", { status: 403 });
  }
}

/** Only allow same-site relative redirects after login. */
export function safeRedirect(to: FormDataEntryValue | string | null) {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) {
    return "/admin";
  }
  return to;
}
