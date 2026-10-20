import { ArrowLeft, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";

import { SITE } from "~/lib/branding";
import { centavosToInput, parsePesoToCentavos } from "~/lib/format";
import {
  getProgram,
  listStatuses,
  nextProgramSortOrder,
  saveProgram,
} from "~/lib/programs.server";
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

const programSchema = z
  .object({
    shortName: z.string().trim().min(1, "Enter the program short name").max(80),
    title: z.string().trim().min(1, "Enter the program title").max(300),
    provider: z.string().trim().max(300),
    description: z.string().trim().max(10_000),
    startDate: optionalDate,
    endDate: optionalDate,
    durationDetails: z.string().trim().max(10_000),
    targetParticipants: z.string().trim().max(20_000),
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

  const values = {
    shortName: text("shortName"),
    title: text("title"),
    provider: text("provider"),
    description: text("description"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    durationDetails: text("durationDetails"),
    targetParticipants: text("targetParticipants"),
    funding: text("funding"),
    statusId: text("statusId"),
    sortOrder: text("sortOrder"),
    isPublished: form.get("isPublished") === "on",
    links,
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

const FORMAT_HINT =
  "Start a line with “- ” for a bullet. Indent with two spaces (“  - ”) for a sub-bullet. Leave a blank line between paragraphs.";

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

  const defaultStatus =
    v?.statusId ??
    String(program?.statusId ?? (program ? "" : (statuses[0]?.id ?? "")));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to programs
      </Link>
      <h1 className="text-xl font-semibold text-navy-900">
        {program ? `Edit: ${program.shortName}` : "Add program"}
      </h1>

      <Form method="post" className="space-y-6" noValidate>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Program</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
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
          <label className="block">
            <span className="label">Brief Description</span>
            <textarea
              name="description"
              rows={5}
              defaultValue={v?.description ?? program?.description}
              className="input mt-1"
            />
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Duration</h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <label className="block">
            <span className="label">Duration details</span>
            <textarea
              name="durationDetails"
              rows={5}
              defaultValue={v?.durationDetails ?? program?.durationDetails}
              placeholder={"- Online: Seven sessions of 2-hour virtual masterclasses\n  - Additional 20 hours of offline coursework\n- Onsite:\n  - 5-day immersive classes"}
              className="input mt-1 font-mono text-[13px]"
            />
            <p className="hint">{FORMAT_HINT}</p>
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Description / Profile of Target Participants
          </h2>
          <label className="block">
            <span className="sr-only">Target participants</span>
            <textarea
              name="targetParticipants"
              rows={10}
              defaultValue={v?.targetParticipants ?? program?.targetParticipants}
              className="input font-mono text-[13px]"
            />
            <p className="hint">{FORMAT_HINT}</p>
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Application links</h2>
              <p className="text-sm text-slate-600">
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

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Status and display</h2>
          <div className="grid gap-4 sm:grid-cols-3">
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
