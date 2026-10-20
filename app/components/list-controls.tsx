import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Form, Link, useSearchParams, useSubmit } from "react-router";

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
  const submit = useSubmit();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow the URL (e.g. back button) unless the user is typing.
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = query;
  }, [query]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Submitting only ?q= also takes the list back to page 1.
  const search = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      submit(value.trim() ? { q: value } : {}, { replace: true });
    }, 300);
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
            submit({}, { replace: true });
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear search"
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

/** "Showing 11–20 of 45" with previous / next and page number links. */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  noun,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** Plural name of the items, e.g. "programs". */
  noun: string;
}) {
  const [searchParams] = useSearchParams();
  if (total === 0) return null;

  const to = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `?${qs}` : ".";
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2"
    >
      <p className="text-xs text-slate-500">
        Showing {first}–{last} of {total} {noun}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link
              to={to(page - 1)}
              className={`${pageLink} text-slate-600 hover:bg-slate-100`}
              aria-label="Previous page"
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
              className={`${pageLink} text-slate-600 hover:bg-slate-100`}
              aria-label="Next page"
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
