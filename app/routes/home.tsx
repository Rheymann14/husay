import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  SearchX,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  Outlet,
  PrefetchPageLinks,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import { ClearSearchLink, EmptyState } from "~/components/empty-state";
import { Pagination, SearchBox } from "~/components/list-controls";
import { SiteHeader } from "~/components/site-header";
import { StatusBadge } from "~/components/status-badge";
import { getUser } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { getListParams } from "~/lib/list-params.server";
import {
  getProgramSort,
  searchPrograms,
  type ProgramSort,
  type ProgramSortKey,
} from "~/lib/programs.server";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: `${SITE.name} | CHED` },
    { name: "description", content: SITE.tagline },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Rows are compact, so a page of 10 fits beside the briefer on most screens.
  const params = getListParams(request, 10);
  const sort = getProgramSort(request);
  const [{ programs, total, page, pageCount, pageSize }, user] =
    await Promise.all([
      searchPrograms(params, { publishedOnly: true, sort }),
      getUser(request),
    ]);
  return {
    programs,
    total,
    page,
    pageCount,
    pageSize,
    query: params.query,
    sort,
    signedIn: user != null,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { programs, total, page, pageCount, pageSize, query, sort, signedIn } =
    loaderData;
  const { trackingNo: selectedNo } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  // Nothing published at all, as opposed to a search with no matches.
  const nothingPosted = total === 0 && !query;

  // Keep ?q= and ?page= so the list stays put while a briefer is open.
  const programUrl = (trackingNo: string) => `/programs/${trackingNo}${search}`;
  const open = (trackingNo: string) =>
    navigate(programUrl(trackingNo), { preventScrollReset: true });
  // Rows aren't links, so hovering one fetches its briefer here instead.
  const [hoveredNo, setHoveredNo] = useState<string | null>(null);

  return (
    // On wide screens the page fills at least the window. The list is never
    // cut off; if a page of it is taller than the window, the page grows and
    // the briefer panel beside it scrolls on its own.
    <div className="flex min-h-dvh flex-col">
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

      <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 py-4 sm:px-6 xl:flex xl:flex-col">
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
          <div className="flex items-end justify-end">
            <a
              href="https://online.fliphtml5.com/cggom/qufn/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 shadow-sm hover:bg-navy-50"
            >
              <BookOpen className="size-4" aria-hidden />
              About HUSAY
            </a>
          </div>
        </div>

        <div className="grid items-start gap-4 xl:flex-1 xl:grid-cols-2 xl:grid-rows-[1fr]">
          <section
            aria-label="Programs"
            className={`overflow-hidden rounded-lg border border-slate-200 bg-white xl:flex xl:h-full xl:flex-col ${
              nothingPosted ? "xl:col-span-2" : ""
            }`}
          >
            {/* The list sets the height of the row, with the pager at the
                bottom; it never scrolls on its own. */}
            <div className="xl:flex-1">
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
                  {/* Table for tablets and up. Fixed column widths keep it
                      inside its panel; long text is clamped instead. */}
                  <div className="hidden md:block">
                    <table className="w-full table-fixed text-left text-[13px] leading-snug">
                      <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                        <tr>
                          <SortHeader sortKey="no" sort={sort} className="w-11">
                            No.
                          </SortHeader>
                          <SortHeader
                            sortKey="provider"
                            sort={sort}
                            className="w-[24%]"
                          >
                            Provider
                          </SortHeader>
                          <SortHeader sortKey="title" sort={sort}>
                            Program Title
                          </SortHeader>
                          <SortHeader
                            sortKey="duration"
                            sort={sort}
                            className="w-28"
                          >
                            Duration of Program
                          </SortHeader>
                          <SortHeader
                            sortKey="status"
                            sort={sort}
                            className="w-28"
                          >
                            Status
                          </SortHeader>
                          <th className="w-11 px-2 py-1.5 text-center">
                            <span className="sr-only">View</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {programs.map((p) => {
                          const selected = p.trackingNo === selectedNo;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => open(p.trackingNo)}
                              onMouseEnter={() => setHoveredNo(p.trackingNo)}
                              aria-selected={selected}
                              className={`cursor-pointer transition-colors ${
                                selected
                                  ? "bg-navy-50 shadow-[inset_4px_0_0_var(--color-gold-500)]"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <td className="px-2 py-1 text-slate-500">
                                {p.no}
                              </td>
                              <td className="px-2 py-1 font-semibold text-navy-900">
                                <span
                                  className="line-clamp-3"
                                  data-tooltip={p.shortName}
                                >
                                  {p.shortName}
                                </span>
                              </td>
                              <td className="px-2 py-1">
                                {/* The briefer shows it in full; hover shows it here. */}
                                <span
                                  className="line-clamp-3"
                                  data-tooltip={p.title}
                                >
                                  {p.title}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-xs text-slate-600">
                                {formatDuration(p.startDate, p.endDate)}
                              </td>
                              <td className="px-2 py-1">
                                <StatusBadge status={p.status} size="xs" />
                              </td>
                              <td className="px-2 py-1 text-center">
                                <Link
                                  to={programUrl(p.trackingNo)}
                                  preventScrollReset
                                  prefetch="intent"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex rounded p-1 text-navy-700 hover:bg-navy-50"
                                  aria-label={`View ${p.title}`}
                                  data-tooltip="View briefer"
                                >
                                  <Eye className="size-4" aria-hidden />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {hoveredNo != null && hoveredNo !== selectedNo && (
                      <PrefetchPageLinks page={programUrl(hoveredNo)} />
                    )}
                  </div>

                  {/* Cards for phones */}
                  <ul className="divide-y divide-slate-100 md:hidden">
                    {programs.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={programUrl(p.trackingNo)}
                          preventScrollReset
                          prefetch="intent"
                          className="flex items-start gap-2.5 px-3 py-2.5 active:bg-slate-50"
                        >
                          <span className="mt-0.5 w-6 shrink-0 text-sm text-slate-400">
                            {p.no}.
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
            </div>
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

/**
 * A column heading that sorts the list. Clicking it again flips the order;
 * the page goes back to 1 and the search and open briefer are kept.
 */
function SortHeader({
  sortKey,
  sort,
  className = "",
  children,
}: {
  sortKey: ProgramSortKey;
  sort: ProgramSort;
  className?: string;
  children: React.ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const active = sort.key === sortKey;
  const dir = active && sort.dir === "asc" ? "desc" : "asc";

  const next = new URLSearchParams(searchParams);
  next.delete("page");
  next.delete("sort");
  next.delete("dir");
  // No. ascending is the default order, so it needs no parameters.
  if (sortKey !== "no" || dir === "desc") next.set("sort", sortKey);
  if (dir === "desc") next.set("dir", "desc");
  const qs = next.toString();

  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <th
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined
      }
      className={`px-2 py-1.5 ${className}`}
    >
      <Link
        to={qs ? `${pathname}?${qs}` : pathname}
        preventScrollReset
        className={`group inline-flex items-center gap-1 text-left uppercase hover:text-navy-700 ${
          active ? "text-navy-700" : ""
        }`}
      >
        {children}
        <Icon
          className={`size-3 shrink-0 ${
            active ? "" : "text-slate-300 group-hover:text-slate-400"
          }`}
          aria-hidden
        />
      </Link>
    </th>
  );
}
