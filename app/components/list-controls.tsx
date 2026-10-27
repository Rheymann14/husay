import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Form,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
  useSubmit,
} from "react-router";

/** Search box that filters the list as you type, through ?q= in the URL. */
export function SearchBox({
  placeholder,
  className = "w-full sm:w-72",
}: {
  placeholder: string;
  className?: string;
}) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const { pathname } = useLocation();
  const submit = useSubmit();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL (e.g. back button) unless the user is typing.
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = query;
  }, [query]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Submitting only ?q= (and the page size) also takes the list back to page
  // 1. It stays on the current path, so an open child route (like a program
  // briefer) stays open.
  const size = searchParams.get("size");
  const go = (value: string) =>
    submit(
      { ...(value.trim() && { q: value }), ...(size && { size }) },
      { action: pathname, replace: true, preventScrollReset: true },
    );
  const search = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go(value), 300);
  };

  return (
    <Form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        search(inputRef.current?.value ?? "");
      }}
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={query}
        onChange={(e) => search(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="input pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            clearTimeout(timer.current);
            go("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear search"
          data-tooltip="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </Form>
  );
}

/** Page numbers to show: the first, last and two either side of the current one. */
function pageList(page: number, pageCount: number): (number | "gap")[] {
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages.at(-1) !== "gap") {
      pages.push("gap");
    }
  }
  return pages;
}

const pageLink =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";

/**
 * "Showing 11–20 of 45" with previous / next and page number links. With
 * `pageSizes` (the first is the default), a "Show" picker sets ?size=.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  pageSizes,
  total,
  noun,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizes?: readonly number[];
  total: number;
  /** Plural name of the items, e.g. "programs". */
  noun: string;
}) {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (total === 0) return null;

  // A new page size goes back to page 1.
  const setPageSize = (size: number) => {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    if (size === pageSizes?.[0]) next.delete("size");
    else next.set("size", String(size));
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname, { preventScrollReset: true });
  };

  const to = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {pageSizes && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Show
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input h-8 w-auto py-0 pr-7 text-xs"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            entries
          </label>
        )}
        <p className="text-xs text-slate-500">
          Showing {first}–{last} of {total} {noun}
        </p>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              to={to(page - 1)}
              prefetch="intent"
              className={`${pageLink} text-slate-600 hover:bg-slate-100`}
              aria-label="Previous page"
              data-tooltip="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={`${pageLink} text-slate-300`} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
          {pageList(page, pageCount).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={p}
                to={to(p)}
                prefetch="intent"
                aria-current={p === page ? "page" : undefined}
                className={`${pageLink} ${
                  p === page
                    ? "bg-navy-700 font-medium text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p}
              </Link>
            ),
          )}
          {page < pageCount ? (
            <Link
              to={to(page + 1)}
              prefetch="intent"
              className={`${pageLink} text-slate-600 hover:bg-slate-100`}
              aria-label="Next page"
              data-tooltip="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={`${pageLink} text-slate-300`} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

/**
 * A column heading that sorts the list through ?sort= and ?dir=. Clicking it
 * again flips the order; the page goes back to 1 and the search and any open
 * child route are kept.
 */
export function SortHeader({
  sortKey,
  sort,
  defaultKey = "no",
  className = "",
  children,
}: {
  sortKey: string;
  sort: { key: string; dir: "asc" | "desc" };
  /** The key whose ascending order is the default, so it needs no parameters. */
  defaultKey?: string;
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
  if (sortKey !== defaultKey || dir === "desc") next.set("sort", sortKey);
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
