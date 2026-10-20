import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";
import { data, Link, useNavigate } from "react-router";

import { RichText } from "~/components/rich-text";
import { StatusBadge } from "~/components/status-badge";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { getProgram } from "~/lib/programs.server";
import { toPlainText } from "~/lib/rich-text";
import type { Route } from "./+types/program-detail";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.program.title ?? "Program";
  return [
    { title: `${title} | ${SITE.name}` },
    {
      name: "description",
      content: toPlainText(loaderData?.program.description ?? "").slice(0, 160),
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const id = Number(params.programId);
  const program = Number.isInteger(id) ? await getProgram(id) : null;
  if (!program) throw data("Program not found", { status: 404 });
  // Funding is internal and never sent to the public page.
  const { fundingCentavos: _funding, ...publicProgram } = program;
  return { program: publicProgram };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b border-slate-100 px-4 py-2.5 last:border-b-0">
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-slate-700">{children}</dd>
    </div>
  );
}

export default function ProgramDetail({ loaderData }: Route.ComponentProps) {
  const { program } = loaderData;
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/", { preventScrollReset: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
    <Link
      to="/"
      preventScrollReset
      aria-hidden
      tabIndex={-1}
      className="fixed inset-0 z-30 hidden bg-slate-900/40 md:block xl:hidden"
    />
    <aside
      aria-labelledby="program-title"
      className="fixed inset-0 z-40 overflow-y-auto bg-white md:left-auto md:w-[44rem] md:shadow-2xl xl:sticky xl:inset-auto xl:top-4 xl:z-auto xl:max-h-[calc(100dvh-9.5rem)] xl:w-auto xl:rounded-lg xl:border xl:border-slate-200 xl:shadow-none"
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
          <div className="mt-1.5">
            <StatusBadge status={program.status} />
          </div>
        </div>
        <Link
          to="/"
          preventScrollReset
          className="-mr-1.5 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Close program details"
        >
          <X className="size-5" aria-hidden />
        </Link>
      </div>

      <dl>
        <Row label="Name of Program">
          <span className="font-semibold text-slate-900">{program.title}</span>
        </Row>
        {program.provider && (
          <Row label="Program Provider">{program.provider}</Row>
        )}
        <Row label="Brief Description">
          <RichText text={program.description} />
        </Row>
        <Row label="Duration">
          <p className="font-medium text-slate-900">
            {formatDuration(program.startDate, program.endDate, { long: true })}
          </p>
          {program.durationDetails && (
            <div className="mt-1.5">
              <RichText text={program.durationDetails} />
            </div>
          )}
        </Row>
        <Row label="Description / Profile of Target Participants">
          <RichText text={program.targetParticipants} />
        </Row>
        {program.sections.map((section) => (
          <Row key={section.id} label={section.heading}>
            <RichText text={section.body} />
          </Row>
        ))}
      </dl>

      {program.links.length > 0 && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {program.links.map((link) => (
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
            ))}
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
