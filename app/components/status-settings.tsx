import { Lock, Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useRouteLoaderData } from "react-router";

import { Dialog } from "~/components/dialog";
import {
  STATUS_COLOR_CLASSES,
  STATUS_ICON_COMPONENTS,
  StatusBadge,
} from "~/components/status-badge";
import { useResultToast, type ActionResult } from "~/components/toaster";
import {
  isAutoStatusKey,
  STATUS_COLORS,
  STATUS_ICONS,
  type StatusDef,
} from "~/lib/status";
import type { loader as adminLayoutLoader } from "~/routes/admin/layout";

type Row = StatusDef & { id: number; isNew: boolean };

function StatusSettingsDialog({
  open,
  onClose,
  statuses,
  attempt,
}: {
  open: boolean;
  onClose: () => void;
  statuses: StatusDef[];
  /** Changes on every opening, for a fresh fetcher. */
  attempt: number;
}) {
  const fetcher = useFetcher<ActionResult>({ key: `status-settings-${attempt}` });
  const [rows, setRows] = useState<Row[]>(() =>
    statuses.map((s, i) => ({ ...s, id: i, isNew: false })),
  );
  const [nextId, setNextId] = useState(statuses.length);
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (fetcher.state === "idle" && result?.ok) onClose();
  }, [fetcher.state, result]);
  // Errors show inside the dialog, which would cover a toast.
  useResultToast(result?.ok ? result : undefined);

  const update = (id: number, change: Partial<StatusDef>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const add = () => {
    setRows((r) => [
      ...r,
      { id: nextId, key: "", name: "", color: "blue", icon: "circle-check", isNew: true },
    ]);
    setNextId((n) => n + 1);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Statuses"
      description="Upcoming, Ongoing and Closed are used by Automatic. Add your own to set by hand."
    >
      <fetcher.Form method="post" action="/admin/statuses" className="space-y-3">
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {rows.map((row) => {
            const builtIn = isAutoStatusKey(row.key);
            return (
              <li
                key={row.id}
                className={`space-y-2 rounded-md border p-2.5 ${
                  row.isNew
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <input type="hidden" name="statusKey" value={row.key} />
                <input type="hidden" name="statusColor" value={row.color} />
                <input type="hidden" name="statusIcon" value={row.icon} />
                <div className="flex items-center gap-2">
                  <input
                    name="statusName"
                    value={row.name}
                    onChange={(e) => update(row.id, { name: e.target.value })}
                    placeholder="Status name"
                    aria-label="Status name"
                    maxLength={30}
                    autoFocus={row.isNew}
                    className="input min-w-0 flex-1"
                  />
                  <StatusBadge status={{ ...row, name: row.name || "Preview" }} />
                  {builtIn ? (
                    <span
                      className="p-1.5 text-slate-400"
                      title="Built-in: used by Automatic"
                      aria-label="Built-in"
                    >
                      <Lock className="size-4" aria-hidden />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Remove ${row.name || "status"}`}
                      title="Remove"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5" role="group" aria-label="Color">
                    {STATUS_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => update(row.id, { color })}
                        aria-label={STATUS_COLOR_CLASSES[color].label}
                        aria-pressed={row.color === color}
                        title={STATUS_COLOR_CLASSES[color].label}
                        className={`size-5 rounded-full ring-offset-2 ${STATUS_COLOR_CLASSES[color].swatch} ${
                          row.color === color ? "ring-2 ring-slate-900" : ""
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1" role="group" aria-label="Icon">
                    {STATUS_ICONS.map((icon) => {
                      const { label, Icon } = STATUS_ICON_COMPONENTS[icon];
                      return (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => update(row.id, { icon })}
                          aria-label={label}
                          aria-pressed={row.icon === icon}
                          title={label}
                          className={`rounded-md border p-1 ${
                            row.icon === icon
                              ? "border-navy-700 bg-navy-50 text-navy-800"
                              : "border-transparent text-slate-500 hover:bg-white"
                          }`}
                        >
                          <Icon className="size-4" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 p-2 text-sm font-medium text-slate-600 hover:border-navy-600 hover:bg-navy-50 hover:text-navy-800"
        >
          <Plus className="size-4" aria-hidden />
          Add status
        </button>
        <p className="hint">
          Programs set to a status you remove go back to Automatic.
        </p>
        {result && !result.ok && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {result.error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save statuses"}
          </button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}

/**
 * For admins, a "Configure statuses…" action for status dropdowns and the
 * dialog it opens. Render `dialog` outside any other form.
 */
export function useStatusSettings(statuses: StatusDef[]): {
  footer: { label: string; icon: React.ReactNode; onSelect: () => void } | undefined;
  dialog: React.ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const layout = useRouteLoaderData<typeof adminLayoutLoader>("routes/admin/layout");
  if (layout?.user.role !== "admin") return { footer: undefined, dialog: null };
  return {
    footer: {
      label: "Configure statuses…",
      icon: <Settings2 className="size-3.5 shrink-0" aria-hidden />,
      onSelect: () => {
        setAttempt((n) => n + 1);
        setOpen(true);
      },
    },
    dialog: (
      // A new key on each opening starts again from the saved statuses.
      <StatusSettingsDialog
        key={attempt}
        attempt={attempt}
        open={open}
        onClose={() => setOpen(false)}
        statuses={statuses}
      />
    ),
  };
}

