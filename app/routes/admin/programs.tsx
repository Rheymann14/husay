import { Pencil, Plus, Trash2 } from "lucide-react";
import { data, Link, useFetcher } from "react-router";

import { Combobox } from "~/components/combobox";
import { statusOptions } from "~/components/status-badge";
import { useResultToast, type ActionResult } from "~/components/toaster";
import { SITE } from "~/lib/branding";
import { formatDuration } from "~/lib/format";
import {
  deleteProgram,
  listPrograms,
  listStatuses,
  setProgramStatus,
  type ProgramListItem,
} from "~/lib/programs.server";
import type { Status } from "~/db/schema";
import type { Route } from "./+types/programs";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Manage programs | ${SITE.name}` }];
}

export async function loader() {
  const [programs, statuses] = await Promise.all([
    listPrograms({ includeDrafts: true }),
    listStatuses(),
  ]);
  return { programs, statuses };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) throw data("Invalid program", { status: 400 });

  if (intent === "set-status") {
    const statusId = form.get("statusId");
    await setProgramStatus(id, statusId ? Number(statusId) : null);
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
}: {
  program: ProgramListItem;
  statuses: Status[];
}) {
  const fetcher = useFetcher<ActionResult>();
  useResultToast(fetcher.data);
  const pending = fetcher.formData?.get("statusId");
  const currentId =
    pending != null ? String(pending) : String(program.statusId ?? "");

  return (
    <Combobox
      size="sm"
      className="w-40"
      options={statusOptions(statuses)}
      value={currentId}
      onChange={(statusId) =>
        fetcher.submit(
          { intent: "set-status", id: String(program.id), statusId },
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
  return (
    <fetcher.Form
      method="post"
      onSubmit={(e) => {
        if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={program.id} />
      <button
        type="submit"
        disabled={fetcher.state !== "idle"}
        className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
        aria-label={`Delete ${program.shortName}`}
        title="Delete"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </fetcher.Form>
  );
}

export default function AdminPrograms({ loaderData }: Route.ComponentProps) {
  const { programs, statuses } = loaderData;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-navy-900">Programs</h1>
          <p className="text-xs text-slate-500">
            Add, edit and change the status of HUSAY programs.
          </p>
        </div>
        <Link to="/admin/programs/new" className="btn-primary">
          <Plus className="size-4" aria-hidden />
          Add program
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {programs.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No programs yet. Click “Add program” to create the first one.
          </p>
        ) : (
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
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">
                    {p.shortName}
                  </td>
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {formatDuration(p.startDate, p.endDate)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusSelect program={p} statuses={statuses} />
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
                        title="Edit"
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
        )}
      </div>
    </div>
  );
}
