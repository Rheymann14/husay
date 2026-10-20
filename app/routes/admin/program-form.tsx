import { ArrowLeft, Link2, Lock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import { z } from "zod";

import { Combobox } from "~/components/combobox";
import { EmptyState } from "~/components/empty-state";
import { RichTextEditor } from "~/components/rich-text-editor";
import { SortableItem, SortableList } from "~/components/sortable-list";
import { statusOptions } from "~/components/status-badge";
import { useStatusSettings } from "~/components/status-settings";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import {
  getProgram,
  isValidStatusSetting,
  listStatuses,
  saveProgram,
} from "~/lib/programs.server";
import { sanitizeHtml } from "~/lib/sanitize-html.server";
import { statusFromDates, todayInManila } from "~/lib/status";
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
  const [program, statuses] = await Promise.all([
    id == null ? null : getProgram(id, { includeDrafts: true }),
    listStatuses(),
  ]);
  if (id != null && !program) throw data("Program not found", { status: 404 });
  // Sent along so the form previews the automatic status with the server's date.
  return { program, statuses, today: todayInManila() };
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
    status: z.string(),
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
    status: text("status"),
    isPublished: form.get("isPublished") === "on",
    links,
    sections,
  };

  const parsed = programSchema.safeParse(values);
  const statusOk = await isValidStatusSetting(values.status);
  if (!parsed.success || !statusOk) {
    const errors: Record<string, string> = {};
    if (!statusOk) errors.status = "Pick a status";
    for (const issue of parsed.error?.issues ?? []) {
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

  await saveProgram(id, parsed.data);
  throw await redirectWithToast("/admin", {
    type: "success",
    message: `“${parsed.data.shortName}” ${id == null ? "added" : "saved"}.`,
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

// isNew rows were added since the last save and are highlighted.
type BrieferRow =
  | { key: number; kind: "row"; heading: string; body: string; isNew?: boolean }
  | { key: number; kind: "duration" };

const newRowHighlight = "border-amber-300 bg-amber-50";

// Drag-and-drop ids; prefixed because dnd-kit mishandles the id 0.
const rowId = (row: BrieferRow) => (row.kind === "duration" ? "duration" : `row-${row.key}`);
const linkId = (link: { key: number }) => `link-${link.key}`;

function NewTag() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-300">
      New
    </span>
  );
}

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

export default function ProgramForm({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { program, statuses, today } = loaderData;
  const statusSettings = useStatusSettings(statuses);
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
      isNew: false,
    })),
  );
  const [nextKey, setNextKey] = useState(links.length);

  const addLink = () => {
    setLinks((rows) => [
      ...rows,
      {
        key: nextKey,
        label: rows.length === 0 ? "Apply Here" : "",
        url: "",
        isNew: true,
      },
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
    setRows((r) => [
      ...r,
      { key: nextRowKey, kind: "row", heading: "", body: "", isNew: true },
    ]);
    setNextRowKey((k) => k + 1);
  };
  const updateHeading = (key: number, heading: string) =>
    setRows((r) =>
      r.map((row) => (row.key === key && row.kind === "row" ? { ...row, heading } : row)),
    );
  const removeRow = (key: number) =>
    setRows((r) => r.filter((row) => row.key !== key));

  const durationPosition = rows.findIndex((r) => r.kind === "duration");

  const defaultStatus = v?.status ?? program?.statusSetting ?? "auto";
  const autoStatus = statusFromDates(startDate || null, endDate || null, today);

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
                  name="status"
                  defaultValue={defaultStatus}
                  options={statusOptions(statuses, autoStatus)}
                  footer={statusSettings.footer}
                  searchPlaceholder="Search statuses…"
                />
              </span>
              <p className="hint">
                Automatic follows the dates: Upcoming before the start, Ongoing
                until the end, then Closed.
              </p>
              <FieldError message={errors.status} />
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
          <SortableList items={rows} getId={rowId} onReorder={setRows}>
            <ol className="space-y-3">
              {rows.map((row, i) => {
                if (row.kind === "duration") {
                  return (
                    <SortableItem
                      key="duration"
                      id={rowId(row)}
                      handleLabel="Drag to reorder Duration row"
                      className="space-y-2 rounded-md border border-navy-100 bg-navy-50/50 p-3"
                    >
                      {(handle) => (
                        <>
                          <div className="flex items-center gap-1">
                            {handle}
                            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-900">
                              Duration
                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                                <Lock className="size-3" aria-hidden />
                                Built-in
                              </span>
                            </p>
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
                        </>
                      )}
                    </SortableItem>
                  );
                }

                rowIndex += 1;
                const errorIndex = rowIndex;
                return (
                  <SortableItem
                    key={row.key}
                    id={rowId(row)}
                    handleLabel={`Drag to reorder row ${i + 1}`}
                    className={`space-y-2 rounded-md border p-3 ${
                      row.isNew ? newRowHighlight : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    {(handle) => (
                      <>
                        <div className="flex items-start gap-1">
                          {handle}
                          <div className="min-w-0 flex-1">
                            <input
                              name="sectionHeading"
                              value={row.heading}
                              onChange={(e) => updateHeading(row.key, e.target.value)}
                              placeholder="Row label, e.g. Program Provider"
                              aria-label={`Row ${i + 1} label`}
                              className="input font-medium"
                            />
                            <FieldError message={errors[`sections.${errorIndex}.heading`]} />
                          </div>
                          <div className="flex shrink-0 items-center">
                            {row.isNew && <NewTag />}
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Remove row ${i + 1}`}
                              data-tooltip="Remove row"
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
                        <FieldError message={errors[`sections.${errorIndex}.body`]} />
                      </>
                    )}
                  </SortableItem>
                );
              })}
            </ol>
          </SortableList>
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
            <EmptyState
              size="sm"
              icon={Link2}
              title="No application link yet"
              description="Add one so people know where to apply."
              className="rounded-lg border border-dashed border-slate-300"
            />
          ) : (
            <SortableList items={links} getId={linkId} onReorder={setLinks}>
              <ul className="space-y-2">
                {links.map((link, i) => (
                  <SortableItem
                    key={link.key}
                    id={linkId(link)}
                    handleLabel={`Drag to reorder link ${i + 1}`}
                    className={`grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-md border p-1.5 sm:grid-cols-[auto_12rem_1fr_auto] ${
                      link.isNew ? newRowHighlight : "border-transparent bg-white"
                    }`}
                  >
                    {(handle) => (
                      <>
                        {handle}
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
                          data-tooltip="Remove link"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </>
                    )}
                  </SortableItem>
                ))}
              </ul>
            </SortableList>
          )}
        </section>

        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Visibility</h2>
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
          <p className="hint">
            Programs are listed by date: earliest start first.
          </p>
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
      {statusSettings.dialog}
    </div>
  );
}
