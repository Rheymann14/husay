import { ExternalLink, LogOut } from "lucide-react";
import { Form, NavLink, Outlet } from "react-router";

import { SiteHeader } from "~/components/site-header";
import { requireUserMiddleware, userContext } from "~/lib/auth.server";
import type { Route } from "./+types/layout";

export const middleware: Route.MiddlewareFunction[] = [requireUserMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(userContext) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const tabs = [
    { to: "/admin", label: "Programs", end: true },
    ...(user.role === "admin"
      ? [
          { to: "/admin/users", label: "Users", end: false },
          { to: "/admin/metrics", label: "Metrics", end: false },
        ]
      : []),
    { to: "/admin/account", label: "My account", end: false },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        right={
          <div className="hidden shrink-0 text-right text-xs leading-tight sm:block">
            <p className="font-medium text-slate-800">{user.name}</p>
            <p className="text-[11px] text-slate-500 capitalize">{user.role}</p>
          </div>
        }
      />
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[88rem] items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `border-b-2 px-2.5 py-2 text-sm font-medium whitespace-nowrap ${
                  isActive
                    ? "border-navy-700 text-navy-800"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 px-2.5 py-2 text-sm whitespace-nowrap text-slate-600 hover:text-slate-900"
            >
              Public page
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-2.5 py-2 text-sm whitespace-nowrap text-slate-600 hover:text-red-700"
              >
                <LogOut className="size-3.5" aria-hidden />
                Sign out
              </button>
            </Form>
          </div>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
