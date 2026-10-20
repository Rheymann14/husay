import { Link } from "react-router";

import { LOGOS, SITE } from "~/lib/branding";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[88rem] items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={LOGOS.ched.src}
            alt={LOGOS.ched.alt}
            width={44}
            height={44}
            className="size-11 shrink-0"
          />
          <img
            src={LOGOS.bagongPilipinas.src}
            alt={LOGOS.bagongPilipinas.alt}
            width={47}
            height={44}
            className="h-11 w-auto shrink-0"
          />
          <span className="h-7 w-px shrink-0 bg-slate-200" aria-hidden />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-semibold text-navy-900 sm:text-lg">
              {SITE.name}
            </span>
            <span className="hidden truncate text-xs text-slate-500 sm:block sm:text-[13px]">
              {SITE.agency}
            </span>
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
