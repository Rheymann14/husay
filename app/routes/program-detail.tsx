import { ExternalLink, Lock, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Link, redirect, useLocation, useNavigate } from "react-router";

import { BrieferPrintDialog } from "~/components/briefer-print-dialog";
import { RichText } from "~/components/rich-text";
import { StatusBadge } from "~/components/status-badge";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import {
  getProgram,
  getProgramByTrackingNo,
  trackingNumberForSlug,
} from "~/lib/programs.server";
import { toPlainText } from "~/lib/rich-text";
import { idFromOldTrackingNumber, TRACKING_NO } from "~/lib/tracking";
import type { Route } from "./+types/program-detail";

export function meta({ loaderData }: Route.MetaArgs) {
  const program = loaderData?.program;
  const summary =
    program?.sections.find((s) => /description/i.test(s.heading)) ??
    program?.sections[0];
  return [
    { title: `${program?.title ?? "Program"} | ${SITE.name}` },
    {
      name: "description",
      content: toPlainText(summary?.body ?? "").slice(0, 160),
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { trackingNo } = params;
  const moveTo = (to: string) =>
    redirect(`/programs/${to}${new URL(request.url).search}`, 301);

  if (TRACKING_NO.test(trackingNo)) {
    const program = await getProgramByTrackingNo(trackingNo);
    if (program) {
      // The number in lower case.
      if (trackingNo !== program.trackingNo) throw moveTo(program.trackingNo);
      return { program };
    }
  }

  // Links used to be /programs/<id>, then /programs/<slug of the title>, then
  // /programs/<tracking number made from the id>.
  const id = /^\d+$/.test(trackingNo)
    ? Number(trackingNo)
    : idFromOldTrackingNumber(trackingNo);
  const to =
    id == null
      ? await trackingNumberForSlug(trackingNo)
      : (await getProgram(id))?.trackingNo;
  if (to) throw moveTo(to);
  throw data("Program not found", { status: 404 });
}

/** One row of the two-column briefer table: label on the left, content on the right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid border-b border-slate-300 last:border-b-0 sm:grid-cols-[minmax(8rem,32%)_1fr]">
      <dt className="flex items-center border-b border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 sm:justify-center sm:border-r sm:border-b-0 sm:py-3 sm:text-center">
        {label}
      </dt>
      <dd className="min-w-0 px-3 py-2.5 text-sm leading-relaxed text-slate-800 sm:py-3">
        {children}
      </dd>
    </div>
  );
}

export default function ProgramDetail({ loaderData }: Route.ComponentProps) {
  const { program } = loaderData;
  const navigate = useNavigate();
  // Closing goes back to the list with the same search and page.
  const closeTo = `/${useLocation().search}`;
  const sectionsBefore = program.sections.slice(0, program.durationPosition);
  const sectionsAfter = program.sections.slice(program.durationPosition);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    // While the print dialog is open, Escape closes only the dialog.
    if (printOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate(closeTo, { preventScrollReset: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, closeTo, printOpen]);

  return (
    <>
    <Link
      to={closeTo}
      preventScrollReset
      aria-hidden
      tabIndex={-1}
      className="fixed inset-0 z-30 hidden bg-slate-900/40 md:block xl:hidden"
    />
    {/* On wide screens h-0 + min-h-full makes the panel exactly as tall as
        the list beside it without stretching that row; it scrolls instead. */}
    <aside
      aria-labelledby="program-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-white md:left-auto md:w-[44rem] md:shadow-2xl xl:relative xl:inset-auto xl:z-auto xl:h-0 xl:min-h-full xl:w-auto xl:rounded-lg xl:border xl:border-slate-200 xl:shadow-none"
    >
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-widest text-gold-500 uppercase">
            Program Briefer
          </p>
          <h2
            id="program-title"
            className="mt-0.5 text-base leading-snug font-semibold text-navy-900"
          >
            {program.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={program.status} />
            <span className="text-xs text-slate-500">
              Tracking No.{" "}
              <span className="font-medium text-slate-700">{program.trackingNo}</span>
            </span>
          </div>
        </div>
        <div className="-mr-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Print or download briefer"
            data-tooltip="Print / PDF"
          >
            <Printer className="size-5" aria-hidden />
          </button>
          <Link
            to={closeTo}
            preventScrollReset
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close program details"
            data-tooltip="Close"
          >
            <X className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="p-4">
        <dl className="overflow-hidden rounded-md border border-slate-300">
          <Row label="Name of Program">
            <span className="font-semibold text-slate-900">{program.title}</span>
          </Row>
          {sectionsBefore.map((section) => (
            <Row key={section.id} label={section.heading}>
              <RichText text={section.body} />
            </Row>
          ))}
          <Row label="Duration">
            <p>
              {formatDuration(program.startDate, program.endDate, { long: true })}
            </p>
            {program.durationDetails && (
              <div className="mt-2">
                <RichText text={program.durationDetails} />
              </div>
            )}
          </Row>
          {sectionsAfter.map((section) => (
            <Row key={section.id} label={section.heading}>
              <RichText text={section.body} />
            </Row>
          ))}
        </dl>
      </div>

      {program.links.length > 0 && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {program.links.map((link) =>
              link.isActive ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:outline-none"
                >
                  {link.label}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                // A span rather than a disabled button so the tooltip still shows.
                <span
                  key={link.id}
                  role="link"
                  aria-disabled="true"
                  data-tooltip={
                    program.closed ? "Applications are closed" : "Not available right now"
                  }
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500"
                >
                  {link.label}
                  <Lock className="size-3.5" aria-hidden />
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </aside>
    <BrieferPrintDialog
      program={program}
      open={printOpen}
      onClose={() => setPrintOpen(false)}
    />
    </>
  );
}
