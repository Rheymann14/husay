import { ChevronRight, Eye } from "lucide-react";
import { Link, Outlet, useNavigate, useParams } from "react-router";

import { SiteHeader } from "~/components/site-header";
import { StatusBadge } from "~/components/status-badge";
import { getUser } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { listPrograms } from "~/lib/programs.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: `${SITE.name} | CHED` },
    { name: "description", content: SITE.tagline },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [programs, user] = await Promise.all([listPrograms(), getUser(request)]);
  return { programs, signedIn: user != null };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { programs, signedIn } = loaderData;
  const { programId } = useParams();
  const navigate = useNavigate();
  const selectedId = programId ? Number(programId) : null;

  const open = (id: number) =>
    navigate(`/programs/${id}`, { preventScrollReset: true });

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        right={
          <Link
            to={signedIn ? "/admin" : "/login"}
            className="shrink-0 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
          >
            {signedIn ? "Manage" : "Sign in"}
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-navy-900">
            List of HUSAY Programs
          </h1>
          <p className="text-sm text-slate-600">
            Select a program to view its briefer and how to apply.
          </p>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section
            aria-label="Programs"
            className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {programs.length === 0 ? (
              <p className="p-8 text-center text-slate-500">
                No programs have been posted yet.
              </p>
            ) : (
              <>
                {/* Table for tablets and up */}
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="bg-navy-50 text-xs font-semibold tracking-wide text-navy-800 uppercase">
                    <tr>
                      <th className="w-12 px-4 py-3">No.</th>
                      <th className="px-4 py-3">Program</th>
                      <th className="px-4 py-3">Title Program</th>
                      <th className="px-4 py-3">Duration of Program</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="w-20 px-4 py-3 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {programs.map((p, i) => {
                      const selected = p.id === selectedId;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => open(p.id)}
                          aria-selected={selected}
                          className={`cursor-pointer transition-colors ${
                            selected
                              ? "bg-navy-50 shadow-[inset_4px_0_0_var(--color-gold-500)]"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-navy-900">
                            {p.shortName}
                          </td>
                          <td className="px-4 py-3">{p.title}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDuration(p.startDate, p.endDate)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              to={`/programs/${p.id}`}
                              preventScrollReset
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-navy-700 hover:bg-navy-100"
                              aria-label={`View ${p.title}`}
                            >
                              <Eye className="size-4" aria-hidden />
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Cards for phones */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {programs.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        to={`/programs/${p.id}`}
                        preventScrollReset
                        className="flex items-start gap-3 p-4 active:bg-slate-50"
                      >
                        <span className="mt-0.5 w-6 shrink-0 text-sm text-slate-400">
                          {i + 1}.
                        </span>
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-semibold text-navy-900">
                            {p.shortName}
                          </span>
                          <span className="block text-sm">{p.title}</span>
                          <span className="block text-xs text-slate-500">
                            {formatDuration(p.startDate, p.endDate)}
                          </span>
                          <StatusBadge status={p.status} />
                        </span>
                        <ChevronRight
                          className="mt-1 size-5 shrink-0 text-slate-400"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <Outlet />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        {SITE.agency} · HUSAY Programs
      </footer>
    </div>
  );
}
