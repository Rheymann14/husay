import { FolderPlus, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { data, Link, useFetcher } from "react-router";

import { Combobox } from "~/components/combobox";
import { ConfirmDialog } from "~/components/dialog";
import { ClearSearchLink, EmptyState } from "~/components/empty-state";
import { Pagination, SearchBox } from "~/components/list-controls";
import { statusOptions } from "~/components/status-badge";
import { useStatusSettings } from "~/components/status-settings";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import { getListParams } from "~/lib/list-params.server";
import {
  deleteProgram,
  isValidStatusSetting,
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
  return { ...(await searchPrograms(params)), query: params.query };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) throw data("Invalid program", { status: 400 });

  if (intent === "set-status") {
    const status = String(form.get("status") ?? "");
    if (!(await isValidStatusSetting(status))) {
      throw data("Invalid status", { status: 400 });
    }
    await setProgramStatus(id, status);
    return { ok: true, message: "Status updated." } satisfies ActionResult;
  }
  if (intent === "delete") {
    await deleteProgram(id);
    return { ok: true, message: "Program deleted." } satisfies ActionResult;
  }
  throw data("Unknown action", { status: 400 });
}

function StatusSelect({
  program,
  statuses,
  footer,
}: {
  program: ProgramListItem;
  statuses: StatusDef[];
  footer: ReturnType<typeof useStatusSettings>["footer"];
}) {
  const fetcher = useFetcher<ActionResult>();
  useResultToast(fetcher.data);
  const pending = fetcher.formData?.get("status");
  const current = pending != null ? String(pending) : program.statusSetting;

  return (
    <Combobox
      size="sm"
      className="w-48"
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

export default function AdminPrograms({ loaderData }: Route.ComponentProps) {
  const { programs, statuses, total, page, pageCount, pageSize, query } =
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
          <SearchBox placeholder="Search programs…" />
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="w-12 px-3 py-2">No.</th>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Program Title</th>
                  <th className="px-3 py-2">Duration of Program</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="w-24 px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-2 font-semibold text-navy-900">
                      {p.shortName}
                    </td>
                    <td className="px-3 py-2">{p.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {formatDuration(p.startDate, p.endDate)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect
                        program={p}
                        statuses={statuses}
                        footer={statusSettings.footer}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {p.isPublished ? (
                        <span className="text-xs font-medium text-green-700">
                          Published
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">
                          Draft (hidden)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/programs/${p.id}/edit`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-800"
                          aria-label={`Edit ${p.shortName}`}
                          data-tooltip="Edit"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        <DeleteButton program={p} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
