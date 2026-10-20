import { Pencil, Plus, Trash2 } from "lucide-react";
import { data, Link, useFetcher } from "react-router";

import { StatusBadge } from "~/components/status-badge";
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
    return { ok: true };
  }
  if (intent === "delete") {
    await deleteProgram(id);
    return { ok: true };
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
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("statusId");
  const currentId =
    pending != null ? String(pending) : String(program.statusId ?? "");
  const current = statuses.find((s) => String(s.id) === currentId) ?? null;

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={current} />
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="set-status" />
        <input type="hidden" name="id" value={program.id} />
        <select
          name="statusId"
          value={currentId}
          aria-label={`Change status of ${program.shortName}`}
          onChange={(e) => fetcher.submit(e.currentTarget.form)}
          className="rounded-md border border-slate-300 bg-white py-1 pr-7 pl-2 text-xs"
        >
          <option value="">No status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </fetcher.Form>
    </div>
  );
}

function DeleteButton({ program }: { program: ProgramListItem }) {
  const fetcher = useFetcher();
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy-900">Programs</h1>
          <p className="text-sm text-slate-600">
            Add, edit and change the status of HUSAY programs.
          </p>
        </div>
        <Link to="/admin/programs/new" className="btn-primary">
          <Plus className="size-4" aria-hidden />
          Add program
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {programs.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No programs yet. Click “Add program” to create the first one.
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-navy-50 text-xs font-semibold tracking-wide text-navy-800 uppercase">
              <tr>
                <th className="w-12 px-4 py-3">No.</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Title Program</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="w-24 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {programs.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-navy-900">
                    {p.shortName}
                  </td>
                  <td className="px-4 py-3">{p.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatDuration(p.startDate, p.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect program={p} statuses={statuses} />
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
