import { FolderPlus, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { data, Link, useFetcher } from "react-router";

import { Combobox } from "~/components/combobox";
import { ConfirmDialog } from "~/components/dialog";
import { ClearSearchLink, EmptyState } from "~/components/empty-state";
import { Pagination, SearchBox, SortHeader } from "~/components/list-controls";
import { statusOptions } from "~/components/status-badge";
import { useStatusSettings } from "~/components/status-settings";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { logActivity } from "~/lib/activity.server";
import { userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { getListParams } from "~/lib/list-params.server";
import {
  deleteProgram,
  getProgramSort,
  listStatuses,
  searchPrograms,
  setProgramStatus,
  type ProgramListItem,
} from "~/lib/programs.server";
import type { StatusDef } from "~/lib/status";
import type { Route } from "./+types/programs";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Manage programs | ${SITE.name}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const params = getListParams(request);
  const sort = getProgramSort(request);
  return {
    ...(await searchPrograms(params, { sort })),
    query: params.query,
    sort,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) throw data("Invalid program", { status: 400 });

  if (intent === "set-status") {
    const status = String(form.get("status") ?? "");
    const label =
      status === "auto"
        ? "Automatic"
        : status === "none"
          ? "No status"
          : (await listStatuses()).find((s) => s.key === status)?.name;
    if (!label) throw data("Invalid status", { status: 400 });
    const name = await setProgramStatus(id, status);
    if (name != null) {
      await logActivity({
        user,
        action: "update",
        entity: "program",
        entityId: id,
        summary: `Set status of “${name}” to ${label}`,
      });
    }
    return { ok: true, message: "Status updated." } satisfies ActionResult;
  }
  if (intent === "delete") {
    const name = await deleteProgram(id);
    if (name != null) {
      await logActivity({
        user,
        action: "delete",
        entity: "program",
        entityId: id,
        summary: `Deleted program “${name}”`,
      });
    }
    return { ok: true, message: "Program deleted." } satisfies ActionResult;
  }
  throw data("Unknown action", { status: 400 });
}

function StatusSelect({
  program,
  statuses,
  footer,
  className,
}: {
  program: ProgramListItem;
  statuses: StatusDef[];
  footer: ReturnType<typeof useStatusSettings>["footer"];
  className?: string;
}) {
  const fetcher = useFetcher<ActionResult>();
  useResultToast(fetcher.data);
  const pending = fetcher.formData?.get("status");
  const current = pending != null ? String(pending) : program.statusSetting;

  return (
    <Combobox
      size="sm"
      className={className}
      options={statusOptions(statuses, program.autoStatus)}
      value={current}
      footer={footer}
      onChange={(status) =>
        fetcher.submit(
          { intent: "set-status", id: String(program.id), status },
          { method: "post" },
        )
      }
      searchPlaceholder="Search statuses…"
      aria-label={`Change status of ${program.shortName}`}
    />
  );
}

function DeleteButton({ program }: { program: ProgramListItem }) {
  const fetcher = useFetcher<ActionResult>();
  useResultToast(fetcher.data);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={fetcher.state !== "idle"}
        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
        aria-label={`Delete ${program.shortName}`}
        data-tooltip="Delete"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          fetcher.submit(
            { intent: "delete", id: String(program.id) },
            { method: "post" },
          )
        }
        title="Delete program?"
        message={`“${program.title}” will be deleted. This cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}

function Visibility({ published }: { published: boolean }) {
  return published ? (
    <span className="text-xs font-medium text-green-700">Published</span>
  ) : (
    <span className="text-xs font-medium text-amber-700">Draft (hidden)</span>
  );
}

function RowActions({ program }: { program: ProgramListItem }) {
  return (
    <div className="flex justify-end gap-1">
      <Link
        to={`/admin/programs/${program.id}/edit`}
        className="rounded-md p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-800"
        aria-label={`Edit ${program.shortName}`}
        data-tooltip="Edit"
      >
        <Pencil className="size-4" aria-hidden />
      </Link>
      <DeleteButton program={program} />
    </div>
  );
}

export default function AdminPrograms({ loaderData }: Route.ComponentProps) {
  const { programs, statuses, total, page, pageCount, pageSize, query, sort } =
    loaderData;
  const statusSettings = useStatusSettings(statuses);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-navy-900">Programs</h1>
          <p className="text-xs text-slate-500">
            Add, edit and change the status of HUSAY programs.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchBox placeholder="Search title or tracking no.…" />
          <Link to="/admin/programs/new" className="btn-primary">
            <Plus className="size-4" aria-hidden />
            Add program
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {programs.length === 0 ? (
          query ? (
            <EmptyState
              icon={SearchX}
              title={`No programs match “${query}”`}
              description="Check the spelling or try a different word."
              action={<ClearSearchLink />}
            />
          ) : (
            <EmptyState
              icon={FolderPlus}
              title="No programs yet"
              description="Add the first program. Once published, it shows on the public page."
              action={
                <Link to="/admin/programs/new" className="btn-primary">
                  <Plus className="size-4" aria-hidden />
                  Add program
                </Link>
              }
            />
          )
        ) : (
          <>
            {/* Table for laptops and up. Fixed column widths keep it inside
                the page without a horizontal scrollbar. */}
            <table className="hidden w-full table-fixed text-left text-sm lg:table">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <SortHeader sortKey="no" sort={sort} className="w-12">
                    No.
                  </SortHeader>
                  <SortHeader
                    sortKey="provider"
                    sort={sort}
                    className="w-[18%]"
                  >
                    Provider
                  </SortHeader>
                  <SortHeader sortKey="title" sort={sort}>
                    Program Title
                  </SortHeader>
                  <SortHeader sortKey="duration" sort={sort} className="w-28">
                    Duration of Program
                  </SortHeader>
                  <SortHeader
                    sortKey="status"
                    sort={sort}
                    className="w-40 xl:w-48"
                  >
                    Status
                  </SortHeader>
                  <SortHeader
                    sortKey="visibility"
                    sort={sort}
                    className="w-24"
                  >
                    Visibility
                  </SortHeader>
                  <th className="w-20 px-2 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-slate-500">{p.no}</td>
                    <td className="px-2 py-2 font-semibold break-words text-navy-900">
                      {p.shortName}
                    </td>
                    <td className="px-2 py-2 break-words">{p.title}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">
                      {formatDuration(p.startDate, p.endDate)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusSelect
                        program={p}
                        statuses={statuses}
                        footer={statusSettings.footer}
                        className="w-full"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Visibility published={p.isPublished} />
                    </td>
                    <td className="px-2 py-2">
                      <RowActions program={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cards for phones and tablets */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {programs.map((p) => (
                <li key={p.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-0.5 w-6 shrink-0 text-sm text-slate-400">
                    {p.no}.
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold break-words text-navy-900">
                      {p.shortName}
                    </p>
                    <p className="text-sm break-words">{p.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDuration(p.startDate, p.endDate)} ·{" "}
                      <Visibility published={p.isPublished} />
                    </p>
                    <StatusSelect
                      program={p}
                      statuses={statuses}
                      footer={statusSettings.footer}
                      className="w-full max-w-64"
                    />
                  </div>
                  <RowActions program={p} />
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={total}
          noun={total === 1 ? "program" : "programs"}
        />
      </div>
      {statusSettings.dialog}
    </div>
  );
}
