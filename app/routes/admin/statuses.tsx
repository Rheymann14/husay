import { count, eq, sql } from "drizzle-orm";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { data, useFetcher } from "react-router";
import { z } from "zod";

import { StatusBadge } from "~/components/status-badge";
import { getDb, schema } from "~/db/client.server";
import { assertAdmin, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { listStatuses } from "~/lib/programs.server";
import { STATUS_COLOR_PRESETS, STATUS_ICONS } from "~/lib/status-icons";
import type { Route } from "./+types/statuses";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Statuses | ${SITE.name}` }];
}

export async function loader({ context }: Route.LoaderArgs) {
  assertAdmin(context.get(userContext));
  const [statuses, usage] = await Promise.all([
    listStatuses(),
    getDb()
      .select({ statusId: schema.programs.statusId, n: count() })
      .from(schema.programs)
      .groupBy(schema.programs.statusId),
  ]);
  const usedBy = Object.fromEntries(usage.map((u) => [u.statusId, u.n]));
  return {
    statuses: statuses.map((s) => ({ ...s, programCount: usedBy[s.id] ?? 0 })),
  };
}

const statusSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  icon: z.string().refine((v) => v in STATUS_ICONS, "Pick an icon"),
  sortOrder: z.coerce.number().int(),
});

export async function action({ request, context }: Route.ActionArgs) {
  assertAdmin(context.get(userContext));
  const db = getDb();
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));

  if (intent === "delete") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.programs)
      .where(eq(schema.programs.statusId, id));
    if (n > 0) {
      return data(
        { ok: false as const, error: "This status is still used by programs." },
        { status: 400 },
      );
    }
    await db.delete(schema.statuses).where(eq(schema.statuses.id, id));
    return { ok: true as const };
  }

  const parsed = statusSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return data(
      { ok: false as const, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    if (intent === "create") {
      await db.insert(schema.statuses).values(parsed.data);
    } else if (intent === "update") {
      await db
        .update(schema.statuses)
        .set({ ...parsed.data, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(schema.statuses.id, id));
    } else {
      throw data("Unknown action", { status: 400 });
    }
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return data(
        { ok: false as const, error: "A status with that name already exists." },
        { status: 400 },
      );
    }
    throw error;
  }
  return { ok: true as const };
}

type StatusRow = Route.ComponentProps["loaderData"]["statuses"][number];

function StatusEditor({
  status,
  nextSortOrder,
}: {
  status?: StatusRow;
  nextSortOrder: number;
}) {
  const fetcher = useFetcher<typeof action>();
  const deleteFetcher = useFetcher<typeof action>();
  const deleteFormId = useId();
  const isNew = !status;
  const [name, setName] = useState(status?.name ?? "");
  const [color, setColor] = useState(status?.color ?? STATUS_COLOR_PRESETS[0]);
  const [icon, setIcon] = useState(status?.icon ?? "circle-check");
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the "add" form after a successful create.
  useEffect(() => {
    if (isNew && fetcher.state === "idle" && fetcher.data?.ok) {
      setName("");
      setColor(STATUS_COLOR_PRESETS[0]);
      setIcon("circle-check");
      formRef.current?.reset();
    }
  }, [isNew, fetcher.state, fetcher.data]);

  const busy = fetcher.state !== "idle" || deleteFetcher.state !== "idle";
  const result = deleteFetcher.data ?? fetcher.data;
  const error = result && !result.ok ? result.error : null;

  return (
    <>
    {status && (
      <deleteFetcher.Form
        id={deleteFormId}
        method="post"
        hidden
        onSubmit={(e) => {
          if (!confirm(`Delete the “${status.name}” status?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={status.id} />
      </deleteFetcher.Form>
    )}
    <fetcher.Form
      ref={formRef}
      method="post"
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="intent" value={isNew ? "create" : "update"} />
      {status && <input type="hidden" name="id" value={status.id} />}
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={icon} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {isNew ? "Add a status" : status.name}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Preview</span>
          <StatusBadge status={{ name: name || "Status", color, icon }} size="md" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block">
          <span className="label">Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Upcoming"
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Order</span>
          <input
            type="number"
            name="sortOrder"
            defaultValue={status?.sortOrder ?? nextSortOrder}
            className="input mt-1"
          />
        </label>
      </div>

      <fieldset>
        <legend className="label">Color</legend>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {STATUS_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              aria-label={`Use color ${preset}`}
              aria-pressed={color.toLowerCase() === preset}
              className={`size-7 rounded-full ring-offset-2 ${
                color.toLowerCase() === preset ? "ring-2 ring-slate-900" : ""
              }`}
              style={{ backgroundColor: preset }}
            />
          ))}
          <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
            Custom
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-slate-300"
            />
          </label>
        </div>
        <p className="hint">Darker colors are easier to read.</p>
      </fieldset>

      <fieldset>
        <legend className="label">Icon</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.entries(STATUS_ICONS).map(([key, { label, Icon }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setIcon(key)}
              aria-label={label}
              aria-pressed={icon === key}
              title={label}
              className={`rounded-lg border p-2 ${
                icon === key
                  ? "border-navy-700 bg-navy-50 text-navy-800"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {status ? (
          <span className="text-xs text-slate-500">
            Used by {status.programCount} program
            {status.programCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {status && (
            <button
              type="submit"
              form={deleteFormId}
              disabled={busy || status.programCount > 0}
              title={
                status.programCount > 0
                  ? "Move its programs to another status first"
                  : "Delete status"
              }
              className="btn-danger"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </button>
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {isNew && <Plus className="size-4" aria-hidden />}
            {busy ? "Saving…" : isNew ? "Add status" : "Save"}
          </button>
        </div>
      </div>
    </fetcher.Form>
    </>
  );
}

export default function Statuses({ loaderData }: Route.ComponentProps) {
  const { statuses } = loaderData;
  const nextSortOrder = Math.max(0, ...statuses.map((s) => s.sortOrder)) + 1;
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-base font-semibold text-navy-900">Statuses</h1>
        <p className="text-xs text-slate-500">
          Statuses appear as colored badges on the program list. Change their
          name, color or icon, or add new ones.
        </p>
      </div>
      {statuses.map((s) => (
        <StatusEditor key={s.id} status={s} nextSortOrder={nextSortOrder} />
      ))}
      <StatusEditor key="new" nextSortOrder={nextSortOrder} />
    </div>
  );
}
