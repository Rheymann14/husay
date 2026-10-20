import { ChevronRight, History, SearchX } from "lucide-react";
import { Form, Link, useSearchParams, useSubmit } from "react-router";

import { EmptyState } from "~/components/empty-state";
import { isActivityEntity, listActivity } from "~/lib/activity.server";
import { assertAdmin, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { formatDateTime } from "~/lib/format";
import type { Route } from "./+types/activity";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Activity | ${SITE.name}` }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  assertAdmin(context.get(userContext));
  const params = new URL(request.url).searchParams;
  const before = Number(params.get("before"));
  const entity = params.get("entity");
  return {
    ...(await listActivity({
      before: Number.isInteger(before) && before > 0 ? before : null,
      entity: isActivityEntity(entity) ? entity : null,
    })),
    entity: isActivityEntity(entity) ? entity : "",
    isFirstPage: !params.has("before"),
  };
}

const ENTITY_OPTIONS = [
  { value: "", label: "Everything" },
  { value: "program", label: "Programs" },
  { value: "status", label: "Statuses" },
  { value: "user", label: "Users" },
  { value: "account", label: "Accounts & sign-ins" },
];

const ACTION_BADGES = {
  create: { label: "Added", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  update: { label: "Changed", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  delete: { label: "Removed", className: "bg-red-50 text-red-700 ring-red-200" },
  sign_in: { label: "Signed in", className: "bg-slate-50 text-slate-600 ring-slate-200" },
} as const;

const ENTITY_LABELS = {
  program: "Program",
  status: "Statuses",
  user: "User",
  account: "Account",
} as const;

export default function Activity({ loaderData }: Route.ComponentProps) {
  const { rows, nextBefore, entity, isFirstPage } = loaderData;
  const submit = useSubmit();
  const [searchParams] = useSearchParams();

  const pageUrl = (before: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (before == null) next.delete("before");
    else next.set("before", String(before));
    const qs = next.toString();
    return qs ? `?${qs}` : ".";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-navy-900">Activity</h1>
          <p className="text-xs text-slate-500">
            Who added, changed or removed what. The latest 5,000 entries are kept.
          </p>
        </div>
        <Form method="get" className="w-full sm:w-auto">
          <label className="sr-only" htmlFor="activity-entity">
            Show
          </label>
          <select
            id="activity-entity"
            name="entity"
            defaultValue={entity}
            key={entity}
            className="input w-full sm:w-56"
            onChange={(e) => submit(e.currentTarget.form, { replace: true })}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {rows.length === 0 ? (
          entity || !isFirstPage ? (
            <EmptyState
              icon={SearchX}
              title="No activity here"
              description="Try another filter or go back to the newest entries."
              action={
                <Link to="." replace className="btn-secondary">
                  Show everything
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="No activity yet"
              description="Changes to programs, statuses and users will show up here."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const badge = ACTION_BADGES[row.action];
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {row.userName}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {ENTITY_LABELS[row.entity]}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(!isFirstPage || nextBefore != null) && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2"
          >
            {isFirstPage ? (
              <span />
            ) : (
              <Link
                to={pageUrl(null)}
                prefetch="none"
                className="btn-secondary"
              >
                Newest
              </Link>
            )}
            {nextBefore != null && (
              <Link
                to={pageUrl(nextBefore)}
                prefetch="none"
                className="btn-secondary"
              >
                Older
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
