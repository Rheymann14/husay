import {
  ChartColumn,
  CircleUser,
  ExternalLink,
  History,
  LayoutList,
  LogOut,
  Menu,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Form, NavLink, Outlet, useLocation } from "react-router";

import { SiteHeader } from "~/components/site-header";
import { requireUserMiddleware, userContext } from "~/lib/auth.server";
import type { Route } from "./+types/layout";

export const middleware: Route.MiddlewareFunction[] = [requireUserMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(userContext) };
}

type Tab = { to: string; label: string; end: boolean; icon: LucideIcon };

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const tabs: Tab[] = [
    { to: "/admin", label: "Programs", end: true, icon: LayoutList },
    ...(user.role === "admin"
      ? [
          { to: "/admin/users", label: "Users", end: false, icon: Users },
          { to: "/admin/metrics", label: "Metrics", end: false, icon: ChartColumn },
          { to: "/admin/activity", label: "Activity", end: false, icon: History },
        ]
      : []),
    { to: "/admin/account", label: "My account", end: false, icon: CircleUser },
  ];

  // Small screens get a menu button instead of a row of tabs.
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  const current =
    tabs.find((t) =>
      t.end ? location.pathname === t.to : location.pathname.startsWith(t.to),
    ) ?? tabs[0];

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
        {/* Medium screens and up: tabs. */}
        <div className="mx-auto hidden max-w-[88rem] items-center gap-1 px-6 md:flex">
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
            <PublicPageLink className="px-2.5 py-2" />
            <SignOutButton className="px-2.5 py-2" />
          </div>
        </div>

        {/* Small screens: current section and a menu. */}
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 md:hidden">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-navy-800">
            <current.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{current.label}</span>
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {menuOpen ? (
              <X className="size-4" aria-hidden />
            ) : (
              <Menu className="size-4" aria-hidden />
            )}
            Menu
          </button>
        </div>
        {menuOpen && (
          <div id="admin-menu" className="border-t border-slate-200 px-2 py-2 md:hidden">
            <ul className="space-y-0.5">
              {tabs.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                        isActive
                          ? "bg-navy-50 text-navy-800"
                          : "text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    <tab.icon className="size-4 shrink-0" aria-hidden />
                    {tab.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 px-3 pt-2">
              <div className="min-w-0 text-xs leading-tight">
                <p className="truncate font-medium text-slate-800">{user.name}</p>
                <p className="text-[11px] text-slate-500 capitalize">{user.role}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PublicPageLink className="px-2 py-1.5" />
                <SignOutButton className="px-2 py-1.5" />
              </div>
            </div>
          </div>
        )}
      </nav>
      <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-4 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function PublicPageLink({ className }: { className: string }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener"
      className={`inline-flex items-center gap-1 text-sm whitespace-nowrap text-slate-600 hover:text-slate-900 ${className}`}
    >
      Public page
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function SignOutButton({ className }: { className: string }) {
  return (
    <Form method="post" action="/logout">
      <button
        type="submit"
        className={`inline-flex items-center gap-1 text-sm whitespace-nowrap text-slate-600 hover:text-red-700 ${className}`}
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out
      </button>
    </Form>
  );
}
