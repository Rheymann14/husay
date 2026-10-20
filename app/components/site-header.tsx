import { Link } from "react-router";

import { LOGOS, SITE } from "~/lib/branding";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b-4 border-gold-400 bg-navy-800 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <img
            src={LOGOS.ched.src}
            alt={LOGOS.ched.alt}
            className="size-9 rounded-full bg-white object-contain p-0.5 sm:size-14"
          />
          <img
            src={LOGOS.bagongPilipinas.src}
            alt={LOGOS.bagongPilipinas.alt}
            className="size-9 rounded-full bg-white object-contain p-0.5 sm:size-14"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium tracking-wide text-navy-100 uppercase sm:text-xs">
            {SITE.agency}
          </p>
          <p className="text-base leading-tight font-bold sm:text-2xl">
            {SITE.name}
          </p>
        </div>
        {right}
      </div>
    </header>
  );
}
