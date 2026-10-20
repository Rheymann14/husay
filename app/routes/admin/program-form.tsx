import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import { z } from "zod";

import { Combobox } from "~/components/combobox";
import { RichTextEditor } from "~/components/rich-text-editor";
import { statusOptions } from "~/components/status-badge";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { SITE } from "~/lib/branding";
import {
  centavosToInput,
  formatDuration,
  parsePesoToCentavos,
} from "~/lib/format";
import {
  getProgram,
  listStatuses,
  nextProgramSortOrder,
  saveProgram,
} from "~/lib/programs.server";
import { sanitizeHtml } from "~/lib/sanitize-html.server";
import { redirectWithToast } from "~/lib/toast.server";
import type { Route } from "./+types/program-form";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.program ? "Edit program" : "Add program";
  return [{ title: `${title} | ${SITE.name}` }];
}

function parseId(value: string | undefined) {
  if (value === undefined) return null;
  const id = Number(value);
  if (!Number.isInteger(id)) throw data("Program not found", { status: 404 });
  return id;
}

export async function loader({ params }: Route.LoaderArgs) {
  const id = parseId(params.programId);
  const [program, statuses, nextSortOrder] = await Promise.all([
    id == null ? null : getProgram(id, { includeDrafts: true }),
    listStatuses(),
    nextProgramSortOrder(),
  ]);
  if (id != null && !program) throw data("Program not found", { status: 404 });
  return { program, statuses, nextSortOrder };
}

const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date");

// Sanitized HTML from the rich text editor.
const richText = z.string().max(50_000, "This text is too long");

const programSchema = z
  .object({
    shortName: z.string().trim().min(1, "Enter the program").max(80),
    title: z.string().trim().min(1, "Enter the program title").max(300),
    startDate: optionalDate,
    endDate: optionalDate,
    durationDetails: richText,
    durationPosition: z.number().int().min(0),
    funding: z
      .string()
      .transform((v) => parsePesoToCentavos(v))
      .refine((v) => v == null || Number.isFinite(v), "Enter an amount like 23,647,292.92"),
    statusId: z
      .string()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v == null || Number.isInteger(v), "Invalid status"),
    sortOrder: z.coerce.number().int("Enter a whole number"),
    isPublished: z.boolean(),
    links: z.array(
      z.object({
        label: z.string().trim().min(1, "Enter a label").max(80),
        url: z
          .string()
          .trim()
          .url("Enter a full link starting with https://")
          .refine((v) => /^https?:\/\//i.test(v), "Link must start with http:// or https://"),
      }),
    ),
    sections: z.array(
      z.object({
        heading: z.string().trim().min(1, "Enter a row label").max(120),
        body: richText,
      }),
    ),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export async function action({ request, params }: Route.ActionArgs) {
  const id = parseId(params.programId);
  const form = await request.formData();
  const text = (name: string) => String(form.get(name) ?? "");

  const labels = form.getAll("linkLabel").map(String);
  const urls = form.getAll("linkUrl").map(String);
  const links = labels
    .map((label, i) => ({ label, url: urls[i] ?? "" }))
    .filter((l) => l.label.trim() || l.url.trim());

  // Briefer rows, in form order. Blank rows are dropped; `index` keeps the
  // row's place in the form so errors land on the right row.
  const headings = form.getAll("sectionHeading").map(String);
  const bodies = await Promise.all(
    form.getAll("sectionBody").map((b) => sanitizeHtml(String(b))),
  );
  const durationAt = Number(text("durationPosition")) || 0;
  const rows = headings
    .map((heading, index) => ({ heading, body: bodies[index] ?? "", index }))
    .filter((s) => s.heading.trim() || s.body);
  const sections = rows.map(({ heading, body }) => ({ heading, body }));

  const values = {
    shortName: text("shortName"),
    title: text("title"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    durationDetails: await sanitizeHtml(text("durationDetails")),
    durationPosition: rows.filter((r) => r.index < durationAt).length,
    funding: text("funding"),
    statusId: text("statusId"),
    sortOrder: text("sortOrder"),
    isPublished: form.get("isPublished") === "on",
    links,
    sections,
  };

  const parsed = programSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = [...issue.path];
      if (path[0] === "sections" && typeof path[1] === "number") {
        path[1] = rows[path[1]].index;
      }
      errors[path.join(".")] ??= issue.message;
    }
    const result: ActionResult = {
      ok: false,
      error: "Please fix the highlighted fields.",
    };
    return data({ errors, values, result }, { status: 400 });
  }

  const { funding, ...rest } = parsed.data;
  await saveProgram(id, { ...rest, fundingCentavos: funding });
  throw await redirectWithToast("/admin", {
    type: "success",
    message: `“${rest.shortName}” ${id == null ? "added" : "saved"}.`,
  });
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

// Suggested rows for a new program, following the program briefer template.
const NEW_PROGRAM_ROWS = {
  before: ["Program Provider", "Brief Description"],
  after: ["Description / Profile of Target Participants"],
};

type BrieferRow =
  | { key: number; kind: "row"; heading: string; body: string }
  | { key: number; kind: "duration" };

function initialRows(
  sections: { heading: string; body: string }[],
  durationPosition: number,
): BrieferRow[] {
  const rows: BrieferRow[] = sections.map((s, i) => ({
    key: i + 1,
    kind: "row",
    heading: s.heading,
    body: s.body,
  }));
  const at = Math.max(0, Math.min(durationPosition, rows.length));
  rows.splice(at, 0, { key: 0, kind: "duration" });
  return rows;
}

const iconButton =
  "rounded-md p-2 text-slate-500 enabled:hover:bg-slate-200 enabled:hover:text-slate-900 disabled:opacity-35";

export default function ProgramForm({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { program, statuses, nextSortOrder } = loaderData;
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const errors: Record<string, string> = actionData?.errors ?? {};
  const v = actionData?.values;
  useResultToast(actionData?.result);

  const [startDate, setStartDate] = useState(
    v?.startDate ?? program?.startDate ?? "",
  );
  const [endDate, setEndDate] = useState(v?.endDate ?? program?.endDate ?? "");

  const [links, setLinks] = useState(() =>
    (v?.links ?? program?.links ?? []).map((l, i) => ({
      key: i,
      label: l.label,
      url: l.url,
    })),
  );
  const [nextKey, setNextKey] = useState(links.length);

  const addLink = () => {
    setLinks((rows) => [
      ...rows,
      { key: nextKey, label: rows.length === 0 ? "Apply Here" : "", url: "" },
    ]);
    setNextKey((k) => k + 1);
  };
  const updateLink = (key: number, field: "label" | "url", value: string) =>
    setLinks((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  const removeLink = (key: number) =>
    setLinks((rows) => rows.filter((r) => r.key !== key));

  // Briefer rows, including the built-in Duration row. Bodies live in each
  // editor; only order and headings are tracked here, keyed so editors
  // survive reordering.
  const [rows, setRows] = useState<BrieferRow[]>(() => {
    if (v) return initialRows(v.sections, v.durationPosition);
    if (program) return initialRows(program.sections, program.durationPosition);
    const blank = (heading: string) => ({ heading, body: "" });
    return initialRows(
      [...NEW_PROGRAM_ROWS.before, ...NEW_PROGRAM_ROWS.after].map(blank),
      NEW_PROGRAM_ROWS.before.length,
    );
  });
  const [nextRowKey, setNextRowKey] = useState(rows.length + 1);

  const addRow = () => {
    setRows((r) => [...r, { key: nextRowKey, kind: "row", heading: "", body: "" }]);
    setNextRowKey((k) => k + 1);
  };
  const updateHeading = (key: number, heading: string) =>
    setRows((r) =>
      r.map((row) => (row.key === key && row.kind === "row" ? { ...row, heading } : row)),
    );
  const removeRow = (key: number) =>
    setRows((r) => r.filter((row) => row.key !== key));
  const moveRow = (index: number, by: -1 | 1) =>
    setRows((r) => {
      const target = index + by;
      if (target < 0 || target >= r.length) return r;
      const next = [...r];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const durationPosition = rows.findIndex((r) => r.kind === "duration");

  const defaultStatus =
    v?.statusId ??
    String(program?.statusId ?? (program ? "" : (statuses[0]?.id ?? "")));

  // Index among the custom rows, which is how the server reports row errors.
  let rowIndex = -1;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to programs
      </Link>
      <h1 className="text-base font-semibold text-navy-900">
        {program ? `Edit: ${program.shortName}` : "Add program"}
      </h1>

      <Form method="post" className="space-y-3" noValidate>
        <input type="hidden" name="durationPosition" value={durationPosition} />

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Program</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block">
              <span className="label">Program *</span>
              <input
                name="shortName"
                defaultValue={v?.shortName ?? program?.shortName}
                placeholder="e.g. HEIL Fellowship"
                className="input mt-1"
              />
              <FieldError message={errors.shortName} />
            </label>
            <label className="block">
              <span className="label">Program Title *</span>
              <input
                name="title"
                defaultValue={v?.title ?? program?.title}
                placeholder="e.g. Higher Education Innovation Leaders Fellowship Program"
                className="input mt-1"
              />
              <FieldError message={errors.title} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <fieldset>
              <legend className="label">Duration of Program</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="sr-only">Start date</span>
                  <input
                    type="date"
                    name="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-label="Start date"
                    className="input"
                  />
                  <FieldError message={errors.startDate} />
                </label>
                <label className="block">
                  <span className="sr-only">End date</span>
                  <input
                    type="date"
                    name="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-label="End date"
                    className="input"
                  />
                  <FieldError message={errors.endDate} />
                </label>
              </div>
              <p className="hint">
                Start and end. The list shows “{formatDuration(startDate || null, endDate || null)}”.
              </p>
            </fieldset>
            <label className="block">
              <span className="label">Status</span>
              <span className="mt-1 block">
                <Combobox
                  name="statusId"
                  defaultValue={defaultStatus}
                  options={statusOptions(statuses)}
                  searchPlaceholder="Search statuses…"
                />
              </span>
              <FieldError message={errors.statusId} />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Program briefer</h2>
              <p className="text-xs text-slate-500">
                Rows of the briefer table, shown after “Name of Program”. Add,
                rename, reorder or remove rows as needed.
              </p>
            </div>
            <button type="button" onClick={addRow} className="btn-secondary shrink-0">
              <Plus className="size-4" aria-hidden />
              Add row
            </button>
          </div>
          <ol className="space-y-3">
            {rows.map((row, i) => {
              const moveButtons = (
                <>
                  <button
                    type="button"
                    onClick={() => moveRow(i, -1)}
                    disabled={i === 0}
                    className={iconButton}
                    aria-label={`Move row ${i + 1} up`}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(i, 1)}
                    disabled={i === rows.length - 1}
                    className={iconButton}
                    aria-label={`Move row ${i + 1} down`}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </>
              );

              if (row.kind === "duration") {
                return (
                  <li
                    key="duration"
                    className="space-y-2 rounded-md border border-navy-100 bg-navy-50/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <p className="flex min-w-0 flex-1 items-center gap-2 px-1 text-sm font-medium text-slate-900">
                        Duration
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                          <Lock className="size-3" aria-hidden />
                          Built-in
                        </span>
                      </p>
                      <div className="flex shrink-0 items-center">{moveButtons}</div>
                    </div>
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900">
                      {formatDuration(startDate || null, endDate || null, { long: true })}
                    </p>
                    <p className="hint -mt-1">
                      First line comes from Duration of Program. Add the
                      schedule details below.
                    </p>
                    <RichTextEditor
                      name="durationDetails"
                      label="Duration details"
                      defaultValue={v?.durationDetails ?? program?.durationDetails}
                      placeholder="e.g. Online: Seven sessions of 2-hour virtual masterclasses"
                    />
                    <FieldError message={errors.durationDetails} />
                  </li>
                );
              }

              rowIndex += 1;
              return (
                <li
                  key={row.key}
                  className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        name="sectionHeading"
                        value={row.heading}
                        onChange={(e) => updateHeading(row.key, e.target.value)}
                        placeholder="Row label, e.g. Program Provider"
                        aria-label={`Row ${i + 1} label`}
                        className="input font-medium"
                      />
                      <FieldError message={errors[`sections.${rowIndex}.heading`]} />
                    </div>
                    <div className="flex shrink-0 items-center">
                      {moveButtons}
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove row ${i + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <RichTextEditor
                    name="sectionBody"
                    label={row.heading || `Row ${i + 1} content`}
                    defaultValue={row.body}
                  />
                  <FieldError message={errors[`sections.${rowIndex}.body`]} />
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 p-2.5 text-sm font-medium text-slate-600 hover:border-navy-600 hover:bg-navy-50 hover:text-navy-800"
          >
            <Plus className="size-4" aria-hidden />
            Add row
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Application links</h2>
              <p className="text-xs text-slate-500">
                Shown as buttons at the bottom of the briefer, e.g. “Apply Here”.
              </p>
            </div>
            <button type="button" onClick={addLink} className="btn-secondary">
              <Plus className="size-4" aria-hidden />
              Add link
            </button>
          </div>
          {links.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No application link yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {links.map((link, i) => (
                <li
                  key={link.key}
                  className="grid grid-cols-[auto_1fr_auto] items-start gap-2 sm:grid-cols-[auto_12rem_1fr_auto]"
                >
                  <GripVertical
                    className="mt-2.5 size-4 text-slate-300"
                    aria-hidden
                  />
                  <div>
                    <input
                      name="linkLabel"
                      value={link.label}
                      onChange={(e) => updateLink(link.key, "label", e.target.value)}
                      placeholder="Apply Here"
                      aria-label={`Link ${i + 1} label`}
                      className="input"
                    />
                    <FieldError message={errors[`links.${i}.label`]} />
                  </div>
                  <div className="col-start-2 sm:col-start-auto">
                    <input
                      name="linkUrl"
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(link.key, "url", e.target.value)}
                      placeholder="https://forms.gle/…"
                      aria-label={`Link ${i + 1} URL`}
                      className="input"
                    />
                    <FieldError message={errors[`links.${i}.url`]} />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLink(link.key)}
                    className="col-start-3 row-start-1 rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 sm:col-start-4"
                    aria-label={`Remove link ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Display settings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Order in list</span>
              <input
                type="number"
                name="sortOrder"
                min={0}
                defaultValue={v?.sortOrder ?? program?.sortOrder ?? nextSortOrder}
                className="input mt-1"
              />
              <FieldError message={errors.sortOrder} />
            </label>
            <label className="block">
              <span className="label">Total funding requested (₱)</span>
              <input
                name="funding"
                inputMode="decimal"
                defaultValue={
                  v?.funding ?? centavosToInput(program?.fundingCentavos ?? null)
                }
                placeholder="23,647,292.92"
                className="input mt-1"
              />
              <FieldError message={errors.funding} />
              <p className="hint">Internal only. Not shown on the public page.</p>
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={v?.isPublished ?? program?.isPublished ?? true}
              className="size-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              Published (visible on the public list)
            </span>
          </label>
        </section>

        <div className="flex justify-end gap-2 pb-8">
          <Link to="/admin" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : program ? "Save changes" : "Add program"}
          </button>
        </div>
      </Form>
    </div>
  );
}
