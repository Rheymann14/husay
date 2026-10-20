import { ArrowLeft, FileQuestion, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import {
  data,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { EmptyState } from "~/components/empty-state";
import { showToast, Toaster } from "~/components/toaster";
import { getToast } from "~/lib/toast.server";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { toast, headers } = await getToast(request);
  return data({ toast }, { headers });
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { toast } = loaderData;
  useEffect(() => {
    if (toast) showToast(toast);
  }, [toast]);
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "The page you are looking for could not be found."
        : typeof error.data === "string" && error.data
          ? error.data
          : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-2xl p-6 pt-16">
      <div className="rounded-lg border border-slate-200 bg-white">
        <EmptyState
          size="lg"
          icon={notFound ? FileQuestion : TriangleAlert}
          title={<span className="text-xl">{message}</span>}
          description={details}
          action={
            <Link to="/" className="btn-primary">
              <ArrowLeft className="size-4" aria-hidden />
              Back to programs
            </Link>
          }
        />
      </div>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded bg-slate-100 p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
