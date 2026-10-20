import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { RichTextEditor } from "~/components/rich-text-editor";
import { SITE } from "~/lib/branding";
import { centavosToInput, parsePesoToCentavos } from "~/lib/format";
import {
  getProgram,
  listStatuses,
  nextProgramSortOrder,
  saveProgram,
} from "~/lib/programs.server";
import { sanitizeHtml } from "~/lib/sanitize-html.server";
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
    shortName: z.string().trim().min(1, "Enter the program short name").max(80),
    title: z.string().trim().min(1, "Enter the program title").max(300),
    provider: z.string().trim().max(300),
    description: richText,
    startDate: optionalDate,
    endDate: optionalDate,
    durationDetails: richText,
    targetParticipants: richText,
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

  const headings = form.getAll("sectionHeading").map(String);
  const bodies = await Promise.all(
    form.getAll("sectionBody").map((b) => sanitizeHtml(String(b))),
  );
  const sections = headings
    .map((heading, i) => ({ heading, body: bodies[i] ?? "" }))
    .filter((s) => s.heading.trim() || s.body);

  const values = {
    shortName: text("shortName"),
    title: text("title"),
    provider: text("provider"),
    description: await sanitizeHtml(text("description")),
    startDate: text("startDate"),
    endDate: text("endDate"),
    durationDetails: await sanitizeHtml(text("durationDetails")),
    targetParticipants: await sanitizeHtml(text("targetParticipants")),
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
      const key = issue.path.join(".");
      errors[key] ??= issue.message;
    }
    return data({ errors, values }, { status: 400 });
  }

  const { funding, ...rest } = parsed.data;
  await saveProgram(id, { ...rest, fundingCentavos: funding });
  throw redirect("/admin");
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

export default function ProgramForm({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { program, statuses, nextSortOrder } = loaderData;
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const errors: Record<string, string> = actionData?.errors ?? {};
  const v = actionData?.values;

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

  // Extra briefer rows. Bodies live in each editor; only order and
  // headings are tracked here, keyed so editors survive reordering.
  const [sections, setSections] = useState(() =>
    (v?.sections ?? program?.sections ?? []).map((s, i) => ({
      key: i,
      heading: s.heading,
      body: s.body,
    })),
  );
  const [nextSectionKey, setNextSectionKey] = useState(sections.length);

  const addSection = () => {
    setSections((rows) => [...rows, { key: nextSectionKey, heading: "", body: "" }]);
    setNextSectionKey((k) => k + 1);
  };
  const updateSectionHeading = (key: number, heading: string) =>
    setSections((rows) => rows.map((r) => (r.key === key ? { ...r, heading } : r)));
  const removeSection = (key: number) =>
    setSections((rows) => rows.filter((r) => r.key !== key));
  const moveSection = (index: number, by: -1 | 1) =>
    setSections((rows) => {
      const target = index + by;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const defaultStatus =
    v?.statusId ??
    String(program?.statusId ?? (program ? "" : (statuses[0]?.id ?? "")));

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
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Program</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block">
              <span className="label">Program (short name) *</span>
              <input
                name="shortName"
                defaultValue={v?.shortName ?? program?.shortName}
                placeholder="e.g. HEIL Fellowship"
                className="input mt-1"
              />
              <FieldError message={errors.shortName} />
            </label>
            <label className="block">
              <span className="label">Title Program (full name) *</span>
              <input
                name="title"
                defaultValue={v?.title ?? program?.title}
                placeholder="e.g. Higher Education Innovation Leaders Fellowship Program"
                className="input mt-1"
              />
              <FieldError message={errors.title} />
            </label>
          </div>
          <label className="block">
            <span className="label">Program Provider</span>
            <input
              name="provider"
              defaultValue={v?.provider ?? program?.provider}
              placeholder="e.g. Arizona State University - University Design Institute (ASU-UDI)"
              className="input mt-1"
            />
          </label>
          <div>
            <span className="label">Brief Description</span>
            <RichTextEditor
              name="description"
              label="Brief Description"
              defaultValue={v?.description ?? program?.description}
            />
            <FieldError message={errors.description} />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Duration</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Start date</span>
              <input
                type="date"
                name="startDate"
                defaultValue={v?.startDate ?? program?.startDate ?? ""}
                className="input mt-1"
              />
              <FieldError message={errors.startDate} />
            </label>
            <label className="block">
              <span className="label">End date</span>
              <input
                type="date"
                name="endDate"
                defaultValue={v?.endDate ?? program?.endDate ?? ""}
                className="input mt-1"
              />
              <FieldError message={errors.endDate} />
            </label>
          </div>
          <p className="hint -mt-2">
            The list shows month and year, e.g. “Oct 2026 – Mar 2027”.
          </p>
          <div>
            <span className="label">Duration details</span>
            <RichTextEditor
              name="durationDetails"
              label="Duration details"
              defaultValue={v?.durationDetails ?? program?.durationDetails}
              placeholder="e.g. Online: Seven sessions of 2-hour virtual masterclasses"
            />
            <FieldError message={errors.durationDetails} />
            <p className="hint">
              Use the list buttons for bullets. Press Tab inside a bullet for a
              sub-bullet.
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">
            Description / Profile of Target Participants
          </h2>
          <RichTextEditor
            name="targetParticipants"
            label="Description / Profile of Target Participants"
            defaultValue={v?.targetParticipants ?? program?.targetParticipants}
          />
          <FieldError message={errors.targetParticipants} />
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Additional rows</h2>
              <p className="text-xs text-slate-500">
                Extra rows shown in the briefer after Target Participants, e.g.
                “Benefits”, “Requirements” or “Contact Person”.
              </p>
            </div>
            <button type="button" onClick={addSection} className="btn-secondary shrink-0">
              <Plus className="size-4" aria-hidden />
              Add row
            </button>
          </div>
          {sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              No additional rows yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {sections.map((section, i) => (
                <li
                  key={section.key}
                  className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        name="sectionHeading"
                        value={section.heading}
                        onChange={(e) => updateSectionHeading(section.key, e.target.value)}
                        placeholder="Row label, e.g. Benefits"
                        aria-label={`Row ${i + 1} label`}
                        className="input font-medium"
                      />
                      <FieldError message={errors[`sections.${i}.heading`]} />
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => moveSection(i, -1)}
                        disabled={i === 0}
                        className="rounded-md p-2 text-slate-500 enabled:hover:bg-slate-200 enabled:hover:text-slate-900 disabled:opacity-35"
                        aria-label={`Move row ${i + 1} up`}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(i, 1)}
                        disabled={i === sections.length - 1}
                        className="rounded-md p-2 text-slate-500 enabled:hover:bg-slate-200 enabled:hover:text-slate-900 disabled:opacity-35"
                        aria-label={`Move row ${i + 1} down`}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSection(section.key)}
                        className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove row ${i + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <RichTextEditor
                    name="sectionBody"
                    label={section.heading || `Row ${i + 1} content`}
                    defaultValue={section.body}
                  />
                  <FieldError message={errors[`sections.${i}.body`]} />
                </li>
              ))}
            </ol>
          )}
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
                    className="col-start-3 row-start-1 rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 sm:col-start-auto"
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
          <h2 className="font-semibold text-slate-900">Status and display</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Status</span>
              <select
                name="statusId"
                defaultValue={defaultStatus}
                className="input mt-1"
              >
                <option value="">No status</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.statusId} />
            </label>
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
              <span className="label">Total funding (₱)</span>
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

        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm text-red-700">
            Please fix the highlighted fields.
          </p>
        )}
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
