import { data, redirect } from "react-router";
import { z } from "zod";

import type { ActionResult } from "~/components/toaster";
import { logActivity } from "~/lib/activity.server";
import { assertAdmin, userContext } from "~/lib/auth.server";
import { listStatuses, saveStatuses } from "~/lib/programs.server";
import {
  AUTO_STATUS_KEYS,
  STATUS_COLORS,
  STATUS_ICONS,
} from "~/lib/status";
import type { Route } from "./+types/statuses";

// Statuses are edited in a dialog from the status dropdown; this route only
// saves them.
export function loader() {
  return redirect("/admin");
}

const MAX_STATUSES = 12;

const statusSchema = z.object({
  key: z.string().transform((v) => v || null),
  name: z.string().trim().min(1, "Give every status a name").max(30, "Keep status names under 30 characters"),
  color: z.enum(STATUS_COLORS, "Pick a color"),
  icon: z.enum(STATUS_ICONS, "Pick an icon"),
});

export async function action({ request, context }: Route.ActionArgs) {
  const me = context.get(userContext);
  assertAdmin(me);
  const form = await request.formData();
  const fail = (error: string) =>
    data<ActionResult>({ ok: false, error }, { status: 400 });

  const keys = form.getAll("statusKey").map(String);
  const names = form.getAll("statusName").map(String);
  const colors = form.getAll("statusColor").map(String);
  const icons = form.getAll("statusIcon").map(String);
  if (keys.length > MAX_STATUSES) return fail(`Use at most ${MAX_STATUSES} statuses.`);

  const parsed = z.array(statusSchema).safeParse(
    keys.map((key, i) => ({ key, name: names[i], color: colors[i], icon: icons[i] })),
  );
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const statuses = parsed.data;

  const existing = new Set((await listStatuses()).map((s) => s.key));
  if (statuses.some((s) => s.key != null && !existing.has(s.key))) {
    return fail("Someone else changed the statuses. Reload the page and try again.");
  }
  if (!AUTO_STATUS_KEYS.every((key) => statuses.some((s) => s.key === key))) {
    return fail("Upcoming, Ongoing and Closed can't be removed.");
  }
  const lowerNames = statuses.map((s) => s.name.toLowerCase());
  if (new Set(lowerNames).size !== lowerNames.length) {
    return fail("Two statuses have the same name.");
  }

  const { added, changed, removed } = await saveStatuses(statuses);
  const parts = [
    added && `added ${added}`,
    changed && `changed ${changed}`,
    removed && `removed ${removed}`,
  ].filter(Boolean);
  if (parts.length) {
    await logActivity({
      user: me,
      action: "update",
      entity: "status",
      summary: `Updated statuses (${parts.join(", ")})`,
    });
  }
  return { ok: true, message: "Statuses saved." } satisfies ActionResult;
}
