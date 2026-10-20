import {
  CircleCheck,
  Database,
  FileInput,
  FilePen,
  Globe,
  HardDrive,
  type LucideIcon,
  OctagonAlert,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { useRevalidator } from "react-router";

import { assertAdmin, userContext } from "~/lib/auth.server";
import { SITE } from "~/lib/branding";
import { FREE_LIMITS, getCloudflareUsage } from "~/lib/cloudflare-usage.server";
import type { Route } from "./+types/metrics";

export function meta({}: Route.MetaArgs) {
  return [{ title: `Metrics | ${SITE.name}` }];
}

export async function loader({ context }: Route.LoaderArgs) {
  assertAdmin(context.get(userContext));
  return { usage: await getCloudflareUsage(), limits: FREE_LIMITS };
}

const number = new Intl.NumberFormat("en-PH");
const compact = new Intl.NumberFormat("en-PH", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dayLabel = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const timeLabel = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 || value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** At 70% the meter turns amber, at 90% red. */
function levelOf(share: number) {
  if (share >= 0.9) {
    return {
      label: "Near the limit",
      icon: OctagonAlert,
      bar: "bg-red-600",
      chip: "bg-red-50 text-red-700 ring-red-200",
    };
  }
  if (share >= 0.7) {
    return {
      label: "Getting close",
      icon: TriangleAlert,
      bar: "bg-amber-500",
      chip: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }
  return {
    label: "Well within",
    icon: CircleCheck,
    bar: "bg-navy-600",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
}

export default function Metrics({ loaderData }: Route.ComponentProps) {
  const { usage, limits } = loaderData;
  const revalidator = useRevalidator();
  const refreshing = revalidator.state !== "idle";
  const today = usage.days[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-navy-900">Metrics</h1>
          <p className="text-xs text-slate-500">
            Cloudflare free plan usage. Daily limits reset at 8:00 AM
            Philippine time (00:00 UTC).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Updated {timeLabel.format(new Date(usage.fetchedAt))}
          </span>
          <button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </button>
        </div>
      </div>

      {!usage.configured && <SetupNotice />}

      {usage.errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="font-medium">Some usage couldn’t be loaded from Cloudflare.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {usage.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {today && (
          <>
            <UsageCard
              icon={Globe}
              title="Requests today"
              detail={`${number.format(today.errors)} errors · whole account`}
              used={today.requests}
              limit={limits.requestsPerDay}
            />
            <UsageCard
              icon={FileInput}
              title="Database rows read today"
              detail={`${number.format(today.readQueries)} read queries`}
              used={today.rowsRead}
              limit={limits.rowsReadPerDay}
            />
            <UsageCard
              icon={FilePen}
              title="Database rows written today"
              detail={`${number.format(today.writeQueries)} write queries`}
              used={today.rowsWritten}
              limit={limits.rowsWrittenPerDay}
            />
          </>
        )}
        {usage.databaseBytes != null && (
          <UsageCard
            icon={HardDrive}
            title="Database size"
            detail="This app’s database"
            used={usage.databaseBytes}
            limit={limits.databaseBytes}
            format={formatBytes}
          />
        )}
      </div>

      {usage.days.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <Database className="size-4 text-slate-400" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-900">Last 7 days</h2>
            <span className="text-xs text-slate-500">
              Days in UTC. Cloudflare can take a few minutes to count new activity.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 text-right font-medium">Requests</th>
                  <th className="px-3 py-2 text-right font-medium">Errors</th>
                  <th className="px-3 py-2 text-right font-medium">DB queries</th>
                  <th className="px-3 py-2 text-right font-medium">Rows read</th>
                  <th className="px-3 py-2 text-right font-medium">Rows written</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {usage.days.map((day, i) => (
                  <tr key={day.date} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-900">
                      {dayLabel.format(new Date(`${day.date}T00:00:00Z`))}
                      {i === 0 && (
                        <span className="ml-1.5 text-xs text-slate-500">(today)</span>
                      )}
                    </td>
                    <DayCell value={day.requests} limit={limits.requestsPerDay} />
                    <td className="px-3 py-2 text-right text-slate-600">
                      {number.format(day.errors)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {number.format(day.readQueries + day.writeQueries)}
                    </td>
                    <DayCell value={day.rowsRead} limit={limits.rowsReadPerDay} />
                    <DayCell value={day.rowsWritten} limit={limits.rowsWrittenPerDay} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function UsageCard({
  icon: Icon,
  title,
  detail,
  used,
  limit,
  format = (n) => number.format(n),
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const share = used / limit;
  const level = levelOf(share);
  const LevelIcon = level.icon;
  const percent = share * 100;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
            <Icon className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-medium text-slate-700">{title}</h2>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${level.chip}`}
        >
          <LevelIcon className="size-3" aria-hidden />
          {level.label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums">
        {format(used)}
        <span className="ml-1 text-sm font-normal text-slate-500">
          of {format(limit)}
        </span>
      </p>
      <div
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={`${format(used)} of ${format(limit)}`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className={`h-full rounded-full ${level.bar}`}
          style={{ width: `${Math.min(100, Math.max(used > 0 ? 1 : 0, percent))}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs text-slate-500">
        <span>{detail}</span>
        <span className="tabular-nums">
          {percent < 0.1 && used > 0 ? "<0.1" : percent.toFixed(1)}%
        </span>
      </div>
    </section>
  );
}

/** A day's count, flagged when that day came close to the daily limit. */
function DayCell({ value, limit }: { value: number; limit: number }) {
  const share = value / limit;
  const level = share >= 0.7 ? levelOf(share) : null;
  const LevelIcon = level?.icon;
  return (
    <td
      className="px-3 py-2 text-right whitespace-nowrap text-slate-800"
      title={`${number.format(value)} of ${compact.format(limit)} (${(share * 100).toFixed(1)}%)`}
    >
      {LevelIcon && (
        <LevelIcon
          className={`mr-1 inline size-3.5 align-[-2px] ${share >= 0.9 ? "text-red-600" : "text-amber-600"}`}
          aria-label={level.label}
        />
      )}
      {number.format(value)}
    </td>
  );
}

function SetupNotice() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy-50 text-navy-700">
          <Settings2 className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">
            Connect Cloudflare to see requests and database usage
          </h2>
          <p className="text-xs text-slate-500">
            Only the database size is shown until an API token is added.
          </p>
        </div>
      </div>
      <ol className="list-decimal space-y-2 py-3 pr-4 pl-9 text-sm text-slate-700">
        <li>
          In the Cloudflare dashboard, open{" "}
          <span className="font-medium">My Profile → API Tokens → Create Token</span>{" "}
          and make a custom token with the permission{" "}
          <span className="font-medium">Account → Account Analytics → Read</span>.
        </li>
        <li>
          Copy your <span className="font-medium">Account ID</span> from the
          Workers &amp; Pages overview.
        </li>
        <li>
          Add both to the site, then deploy again:
          <pre className="mt-1 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-100">
            {`npx wrangler pages secret put CLOUDFLARE_ACCOUNT_ID --project-name husay
npx wrangler pages secret put CLOUDFLARE_API_TOKEN --project-name husay
npm run deploy`}
          </pre>
          <p className="hint">
            On your computer, put them in a <code>.dev.vars</code> file instead
            (see <code>.dev.vars.example</code>).
          </p>
        </li>
      </ol>
    </section>
  );
}
