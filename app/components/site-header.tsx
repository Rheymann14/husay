import { Link } from "react-router";

import { LOGOS, SITE } from "~/lib/branding";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src={LOGOS.ched.src}
            alt={LOGOS.ched.alt}
            width={32}
            height={32}
            className="size-8 shrink-0"
          />
          <img
            src={LOGOS.bagongPilipinas.src}
            alt={LOGOS.bagongPilipinas.alt}
            width={34}
            height={32}
            className="h-8 w-auto shrink-0"
          />
          <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-navy-900">
              {SITE.name}
            </span>
            <span className="hidden truncate text-[11px] text-slate-500 sm:block">
              {SITE.agency}
            </span>
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
