import { env } from "cloudflare:workers";

/**
 * Workers Free plan limits this app can run into. The daily ones are shared by
 * the whole Cloudflare account and reset at 00:00 UTC (8:00 AM Philippine time).
 * https://developers.cloudflare.com/workers/platform/limits/
 * https://developers.cloudflare.com/d1/platform/pricing/
 */
export const FREE_LIMITS = {
  requestsPerDay: 100_000,
  rowsReadPerDay: 5_000_000,
  rowsWrittenPerDay: 100_000,
  databaseBytes: 500 * 1024 * 1024,
} as const;

/** Days of history shown, today included. */
const DAYS = 7;

export type DailyUsage = {
  date: string; // YYYY-MM-DD, UTC
  requests: number;
  errors: number;
  readQueries: number;
  writeQueries: number;
  rowsRead: number;
  rowsWritten: number;
};

export type CloudflareUsage = {
  /** False when the API token or account ID isn't set. */
  configured: boolean;
  /** Newest first. Empty when not configured. */
  days: DailyUsage[];
  /** Size of this app's D1 database, straight from D1. */
  databaseBytes: number | null;
  /** Parts of the analytics that couldn't be loaded. */
  errors: string[];
  fetchedAt: string;
};

type Secrets = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

function utcDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

type Group<S> = { sum: S; dimensions: { date: string; scriptName?: string } };

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare answered ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as {
    data?: { viewer: { accounts: T[] } } | null;
    errors?: { message: string }[] | null;
  };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  const account = body.data?.viewer.accounts[0];
  if (!account) throw new Error("Account not found for this API token");
  return account;
}

// Pages Functions (this app) and any other Workers on the account share the
// 100,000 requests a day. Pages may also be listed among the Workers as
// "pages-worker--…", so those are skipped there to avoid counting them twice.
const PAGES_QUERY = `
  query ($account: string!, $start: Date!, $end: Date!) {
    viewer {
      accounts(filter: { accountTag: $account }) {
        pagesFunctionsInvocationsAdaptiveGroups(
          limit: 1000
          filter: { date_geq: $start, date_leq: $end }
        ) {
          sum { requests errors }
          dimensions { date }
        }
      }
    }
  }`;

const WORKERS_QUERY = `
  query ($account: string!, $start: Date!, $end: Date!) {
    viewer {
      accounts(filter: { accountTag: $account }) {
        workersInvocationsAdaptive(
          limit: 1000
          filter: { date_geq: $start, date_leq: $end }
        ) {
          sum { requests errors }
          dimensions { date scriptName }
        }
      }
    }
  }`;

const D1_QUERY = `
  query ($account: string!, $start: Date!, $end: Date!) {
    viewer {
      accounts(filter: { accountTag: $account }) {
        d1AnalyticsAdaptiveGroups(
          limit: 1000
          filter: { date_geq: $start, date_leq: $end }
        ) {
          sum { readQueries writeQueries rowsRead rowsWritten }
          dimensions { date }
        }
      }
    }
  }`;

type RequestSums = { requests: number; errors: number };
type D1Sums = Pick<DailyUsage, "readQueries" | "writeQueries" | "rowsRead" | "rowsWritten">;

async function getDatabaseBytes(): Promise<number | null> {
  try {
    const result = await env.DB.prepare("SELECT 1").run();
    return result.meta.size_after ?? null;
  } catch {
    return null;
  }
}

export async function getCloudflareUsage(): Promise<CloudflareUsage> {
  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } =
    env as unknown as Secrets;
  const fetchedAt = new Date().toISOString();
  const databaseBytes = await getDatabaseBytes();
  if (!account || !token) {
    return { configured: false, days: [], databaseBytes, errors: [], fetchedAt };
  }

  const days = new Map<string, DailyUsage>();
  for (let i = 0; i < DAYS; i++) {
    const date = utcDate(i);
    days.set(date, {
      date,
      requests: 0,
      errors: 0,
      readQueries: 0,
      writeQueries: 0,
      rowsRead: 0,
      rowsWritten: 0,
    });
  }
  const variables = { account, start: utcDate(DAYS - 1), end: utcDate(0) };
  const addRequests = (groups: Group<RequestSums>[]) => {
    for (const { sum, dimensions } of groups) {
      if (dimensions.scriptName?.startsWith("pages-worker--")) continue;
      const day = days.get(dimensions.date);
      if (!day) continue;
      day.requests += sum.requests;
      day.errors += sum.errors;
    }
  };

  const errors: string[] = [];
  const settle = async (label: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await Promise.all([
    settle("Pages requests", async () => {
      const result = await graphql<{
        pagesFunctionsInvocationsAdaptiveGroups: Group<RequestSums>[];
      }>(token, PAGES_QUERY, variables);
      addRequests(result.pagesFunctionsInvocationsAdaptiveGroups);
    }),
    settle("Workers requests", async () => {
      const result = await graphql<{
        workersInvocationsAdaptive: Group<RequestSums>[];
      }>(token, WORKERS_QUERY, variables);
      addRequests(result.workersInvocationsAdaptive);
    }),
    settle("D1 database", async () => {
      const result = await graphql<{ d1AnalyticsAdaptiveGroups: Group<D1Sums>[] }>(
        token,
        D1_QUERY,
        variables,
      );
      for (const { sum, dimensions } of result.d1AnalyticsAdaptiveGroups) {
        const day = days.get(dimensions.date);
        if (!day) continue;
        day.readQueries += sum.readQueries;
        day.writeQueries += sum.writeQueries;
        day.rowsRead += sum.rowsRead;
        day.rowsWritten += sum.rowsWritten;
      }
    }),
  ]);

  return { configured: true, days: [...days.values()], databaseBytes, errors, fetchedAt };
}
