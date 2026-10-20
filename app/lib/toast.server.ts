import { createCookie, redirect } from "react-router";

import type { ToastMessage } from "~/components/toaster";

// One-time toast carried across a redirect, e.g. "Program saved" after a form
// submit. The root loader reads it and clears the cookie.
const toastCookie = createCookie("husay_toast", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: 60,
});

/** Redirects and shows a toast on the next page. */
export async function redirectWithToast(
  url: string,
  toast: Omit<ToastMessage, "id">,
  init: { headers?: HeadersInit } = {},
) {
  const headers = new Headers(init.headers);
  headers.append(
    "Set-Cookie",
    await toastCookie.serialize({ ...toast, id: crypto.randomUUID() }),
  );
  return redirect(url, { headers });
}

/** Reads the pending toast, with the header that clears it. */
export async function getToast(request: Request) {
  const toast: ToastMessage | null =
    (await toastCookie.parse(request.headers.get("Cookie"))) || null;
  const headers: HeadersInit | undefined = toast
    ? { "Set-Cookie": await toastCookie.serialize("", { maxAge: 0 }) }
    : undefined;
  return { toast, headers };
}
