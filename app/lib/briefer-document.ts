// A standalone HTML page of a program briefer, for printing and PDF download.
// It carries its own styles (plain hex colors, no Tailwind) so it looks the
// same in the preview frame, on paper and in the PDF.

import { LOGOS, SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { toHtml } from "~/lib/rich-text";
import { slugify } from "~/lib/slug";

export type BrieferProgram = {
  id: number;
  slug: string;
  title: string;
  status: { name: string } | null;
  closed: boolean;
  startDate: string | null;
  endDate: string | null;
  durationDetails: string;
  durationPosition: number;
  sections: { id: number; heading: string; body: string }[];
  links: { id: number; label: string; url: string; isActive: boolean }[];
};

const printedOn = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Stored HTML is sanitized when saved, so it is safe to inject (as in RichText).
function richText(text: string) {
  return text.trim() ? `<div class="rich-text">${toHtml(text)}</div>` : `<p class="empty">—</p>`;
}

function row(label: string, content: string) {
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${content}</td></tr>`;
}

/** "Program Name" -> "program-name-briefer.pdf". */
export function brieferFileName(title: string) {
  return `${slugify(title) || "program"}-briefer.pdf`;
}

/** The full HTML document. `origin` makes the logos and source link absolute. */
export function brieferDocument(program: BrieferProgram, origin: string) {
  const before = program.sections.slice(0, program.durationPosition);
  const after = program.sections.slice(program.durationPosition);
  const duration =
    `<p>${escapeHtml(formatDuration(program.startDate, program.endDate, { long: true }))}</p>` +
    (program.durationDetails.trim() ? richText(program.durationDetails) : "");

  const rows = [
    row("Name of Program", `<strong>${escapeHtml(program.title)}</strong>`),
    ...before.map((s) => row(s.heading, richText(s.body))),
    row("Duration", duration),
    ...after.map((s) => row(s.heading, richText(s.body))),
  ].join("");

  const activeLinks = program.links.filter((link) => link.isActive);
  const apply =
    program.links.length === 0
      ? ""
      : `<section class="apply"><h2>How to apply</h2>${
          activeLinks.length
            ? `<ul>${activeLinks
                .map(
                  (link) =>
                    `<li><span class="apply-label">${escapeHtml(link.label)}:</span> <a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a></li>`,
                )
                .join("")}</ul>`
            : `<p>${program.closed ? "Applications are closed." : "Applications are not available right now."}</p>`
        }</section>`;

  const source = `${origin}/programs/${program.slug}`;
  const status = program.status?.name ?? "No status";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(program.title)} | Program Briefer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>${STYLES}</style>
</head>
<body>
<main class="page">
  <header class="letterhead">
    <img src="${origin}/logos/ched_logo.png" alt="${escapeHtml(LOGOS.ched.alt)}">
    <img src="${origin}/logos/bagong_pilipinas.png" alt="${escapeHtml(LOGOS.bagongPilipinas.alt)}">
    <img src="${origin}/logos/achieve_logo.png" alt="${escapeHtml(LOGOS.achieve.alt)}">
    <div>
      <p class="agency">${escapeHtml(SITE.agency)}</p>
      <p class="site">${escapeHtml(SITE.name)}</p>
    </div>
  </header>
  <h1>Program Briefer</h1>
  <p class="meta">Status: <strong>${escapeHtml(status)}</strong></p>
  <table class="briefer"><tbody>${rows}</tbody></table>
  ${apply}
  <footer>Source: ${escapeHtml(source)} &middot; Printed ${printedOn.format(new Date())}</footer>
</main>
</body>
</html>`;
}

const STYLES = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  background: #e2e8f0;
  color: #1e293b;
  font: 10.5pt/1.5 Inter, ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif;
}
.page {
  width: 210mm;
  min-height: 297mm;
  margin: 24px auto;
  padding: 15mm;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.15), 0 8px 24px rgb(15 23 42 / 0.08);
}
p { margin: 0; }
a { color: #1a3a85; word-break: break-word; }

.letterhead {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0ab0c;
}
.letterhead img { height: 15mm; width: auto; }
.letterhead div { margin-left: 6px; line-height: 1.3; }
.agency { font-size: 12pt; font-weight: 700; color: #0f2250; }
.site { font-size: 9.5pt; color: #475569; }

h1 {
  margin: 18px 0 2px;
  text-align: center;
  font-size: 15pt;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f2250;
}
.meta { text-align: center; font-size: 9.5pt; color: #475569; margin-bottom: 14px; }

table.briefer { width: 100%; border-collapse: collapse; }
.briefer th, .briefer td { border: 1px solid #94a3b8; padding: 8px 12px; }
.briefer th {
  width: 30%;
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}
.briefer td { vertical-align: top; }
.briefer tr { break-inside: avoid; }
.empty { color: #94a3b8; }

.rich-text > * + *, td > .rich-text { margin-top: 6px; }
td > .rich-text:first-child { margin-top: 0; }
.rich-text ul, .rich-text ol { margin: 0; padding-left: 18px; }
.rich-text ul ul { list-style-type: circle; }
.rich-text li + li { margin-top: 3px; }
.rich-text li > ul, .rich-text li > ol { margin-top: 2px; }

.apply { margin-top: 16px; break-inside: avoid; }
.apply h2 { margin: 0 0 4px; font-size: 11pt; color: #0f2250; }
.apply ul { margin: 0; padding-left: 18px; }
.apply-label { font-weight: 600; }

footer {
  margin-top: 20px;
  padding-top: 6px;
  border-top: 1px solid #cbd5e1;
  font-size: 8pt;
  color: #64748b;
}

@media screen and (max-width: 820px) {
  .page { width: auto; min-height: 0; margin: 0; padding: 16px; box-shadow: none; }
  .letterhead img { height: 40px; }
}
@media print {
  body { background: #fff; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
}
/* Laid out at the printable width of A4 for the PDF capture. */
html.pdf body { background: #fff; }
html.pdf .page { width: 180mm; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
/* The capture draws list markers against the text, so draw bullets here. */
html.pdf ul > li { list-style: none; position: relative; }
html.pdf ul > li::before { content: "\\2022"; position: absolute; left: -13px; }
html.pdf ul ul > li::before { content: "\\25E6"; }
`;
