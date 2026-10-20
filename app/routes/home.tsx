import { CalendarClock, ChevronRight, Eye, SearchX } from "lucide-react";
import { useState } from "react";
import {
  Link,
  Outlet,
  PrefetchPageLinks,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import { ClearSearchLink, EmptyState } from "~/components/empty-state";
import { Pagination, SearchBox } from "~/components/list-controls";
import { SiteHeader } from "~/components/site-header";
import { StatusBadge } from "~/components/status-badge";
import { getUser } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { getListParams } from "~/lib/list-params.server";
import { searchPrograms } from "~/lib/programs.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: `${SITE.name} | CHED` },
    { name: "description", content: SITE.tagline },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = getListParams(request);
  const [{ programs, total, page, pageCount, pageSize }, user] =
    await Promise.all([
      searchPrograms(params, { publishedOnly: true }),
      getUser(request),
    ]);
  return {
    programs,
    total,
    page,
    pageCount,
    pageSize,
    query: params.query,
    signedIn: user != null,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { programs, total, page, pageCount, pageSize, query, signedIn } =
    loaderData;
  const { slug: selectedSlug } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  // Nothing published at all, as opposed to a search with no matches.
  const nothingPosted = total === 0 && !query;

  // Keep ?q= and ?page= so the list stays put while a briefer is open.
  const programUrl = (slug: string) => `/programs/${slug}${search}`;
  const open = (slug: string) =>
    navigate(programUrl(slug), { preventScrollReset: true });
  // Rows aren't links, so hovering one fetches its briefer here instead.
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  return (
    // On wide screens the page fits the window, and the list and the briefer
    // panel scroll on their own instead of the page.
    <div className="flex min-h-dvh flex-col xl:h-dvh">
      <SiteHeader
        right={
          <Link
            to={signedIn ? "/admin" : "/login"}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            {signedIn ? "Manage" : "Sign in"}
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-4 sm:px-6 xl:flex xl:min-h-0 xl:flex-col">
        <div className="mb-3 grid gap-4 xl:grid-cols-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-navy-900">
                List of HUSAY Programs
              </h1>
              {!nothingPosted && (
                <p className="text-xs text-slate-500">
                  Select a program to view its briefer and how to apply.
                </p>
              )}
            </div>
            {!nothingPosted && <SearchBox placeholder="Search programs…" />}
          </div>
        </div>

        <div className="grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
          <section
            aria-label="Programs"
            className={`overflow-hidden rounded-lg border border-slate-200 bg-white xl:max-h-full xl:overflow-y-auto ${
              nothingPosted ? "xl:col-span-2" : ""
            }`}
          >
            {nothingPosted ? (
              <EmptyState
                size="lg"
                icon={CalendarClock}
                title="No programs posted yet"
                description="HUSAY programs will be listed here once they are announced, each with a briefer and how to apply. Please check back soon."
              />
            ) : programs.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={`No programs match “${query}”`}
                description="Check the spelling or try a different word."
                action={<ClearSearchLink />}
              />
            ) : (
              <>
                {/* Table for tablets and up */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="w-10 px-3 py-2">No.</th>
                        <th className="w-32 px-3 py-2">Program</th>
                        <th className="min-w-[12rem] px-3 py-2">
                          Program Title
                        </th>
                        <th className="px-3 py-2">Duration of Program</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="w-16 px-3 py-2 text-center">View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {programs.map((p, i) => {
                        const selected = p.slug === selectedSlug;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => open(p.slug)}
                            onMouseEnter={() => setHoveredSlug(p.slug)}
                            aria-selected={selected}
                            className={`cursor-pointer transition-colors ${
                              selected
                                ? "bg-navy-50 shadow-[inset_4px_0_0_var(--color-gold-500)]"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-3 py-2 text-slate-500">
                              {(page - 1) * pageSize + i + 1}
                            </td>
                            <td className="px-3 py-2 font-semibold text-navy-900">
                              {p.shortName}
                            </td>
                            <td className="px-3 py-2">
                              {/* The briefer shows it in full; hover shows it here. */}
                              <span
                                className="line-clamp-3"
                                data-tooltip={p.title}
                              >
                                {p.title}
                              </span>
                            </td>
                            <td className="min-w-[7rem] px-3 py-2 text-slate-600">
                              {formatDuration(p.startDate, p.endDate)}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Link
                                to={programUrl(p.slug)}
                                preventScrollReset
                                prefetch="intent"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-navy-700 hover:bg-navy-50"
                                aria-label={`View ${p.title}`}
                              >
                                <Eye className="size-3.5" aria-hidden />
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {hoveredSlug != null && hoveredSlug !== selectedSlug && (
                    <PrefetchPageLinks page={programUrl(hoveredSlug)} />
                  )}
                </div>

                {/* Cards for phones */}
                <ul className="divide-y divide-slate-100 md:hidden">
                  {programs.map((p, i) => (
                    <li key={p.id}>
                      <Link
                        to={programUrl(p.slug)}
                        preventScrollReset
                        prefetch="intent"
                        className="flex items-start gap-2.5 px-3 py-2.5 active:bg-slate-50"
                      >
                        <span className="mt-0.5 w-6 shrink-0 text-sm text-slate-400">
                          {(page - 1) * pageSize + i + 1}.
                        </span>
                        <span className="min-w-0 flex-1 space-y-0.5">
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
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              noun={total === 1 ? "program" : "programs"}
            />
          </section>

          {/* With nothing to pick, the "select a program" panel is left out. */}
          {!nothingPosted && <Outlet />}
        </div>
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-400">
        {SITE.agency} · HUSAY Programs
      </footer>
    </div>
  );
}
