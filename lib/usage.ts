import { getAdminClient } from "@/lib/supabase/admin";
import {
  PlanType,
  ActionType,
  PLAN_LIMITS,
  UsageCheckResult,
} from "@/types";

export const UNLIMITED_LIMIT = 999999;
export const GUEST_DISCOVERY_COOKIE = "keywordmoney_guest_discovery_usage";

type GuestUsageRecord = {
  date: string;
  count: number;
};

const ACTION_COLUMN: Record<ActionType, string> = {
  discovery: "discovery_count",
  analysis: "analysis_count",
  production: "production_count",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getAdminClient();
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function parseGuestUsage(raw: string | undefined): GuestUsageRecord {
  const today = getToday();

  if (!raw) {
    return { date: today, count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GuestUsageRecord>;
    if (parsed.date !== today) {
      return { date: today, count: 0 };
    }

    const count =
      typeof parsed.count === "number" && Number.isFinite(parsed.count)
        ? Math.max(0, Math.floor(parsed.count))
        : 0;

    return { date: today, count };
  } catch {
    return { date: today, count: 0 };
  }
}

function stringifyGuestUsage(record: GuestUsageRecord): string {
  return JSON.stringify(record);
}

export function getGuestUsageToday(rawCookie: string | undefined) {
  const record = parseGuestUsage(rawCookie);

  return {
    plan: "guest" as const,
    discovery: { used: record.count, limit: PLAN_LIMITS.free.discovery },
    analysis: { used: 0, limit: PLAN_LIMITS.free.analysis },
    production: { used: 0, limit: PLAN_LIMITS.free.production },
  };
}

export function checkAndIncrementGuestDiscoveryUsage(rawCookie: string | undefined) {
  const record = parseGuestUsage(rawCookie);
  const limit = PLAN_LIMITS.free.discovery;

  if (record.count >= limit) {
    return {
      allowed: false,
      plan: "guest" as const,
      used: record.count,
      limit,
      remaining: 0,
      cookieValue: stringifyGuestUsage(record),
    };
  }

  const nextRecord = {
    date: record.date,
    count: record.count + 1,
  };

  return {
    allowed: true,
    plan: "guest" as const,
    used: nextRecord.count,
    limit,
    remaining: limit - nextRecord.count,
    cookieValue: stringifyGuestUsage(nextRecord),
  };
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await db().auth.admin.getUserById(userId);
  if (!data?.user?.email) return false;
  return ADMIN_EMAILS.includes(data.user.email.toLowerCase());
}

export async function getUserPlan(userId: string): Promise<PlanType> {
  if (await isAdmin(userId)) return "pro";

  const { data: sub } = await db()
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    const { data: profile } = await db()
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .single();
    if (profile?.plan === "basic" || profile?.plan === "pro") {
      return profile.plan;
    }
  }

  return "free";
}

export async function checkAndIncrementUsage(
  userId: string,
  action: ActionType
): Promise<UsageCheckResult> {
  if (await isAdmin(userId)) {
    return { allowed: true, plan: "pro", used: 0, limit: UNLIMITED_LIMIT, remaining: UNLIMITED_LIMIT };
  }

  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan][action];
  const column = ACTION_COLUMN[action];
  const today = getToday();

  const { data: existing } = await db()
    .from("usage_daily")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  const currentCount = existing ? (existing[column] as number) : 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      plan,
      used: currentCount,
      limit,
      remaining: 0,
    };
  }

  if (!existing) {
    await db().from("usage_daily").insert({
      user_id: userId,
      date: today,
      discovery_count: action === "discovery" ? 1 : 0,
      analysis_count: action === "analysis" ? 1 : 0,
      production_count: action === "production" ? 1 : 0,
    });
  } else {
    await db()
      .from("usage_daily")
      .update({ [column]: currentCount + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("date", today);
  }

  return {
    allowed: true,
    plan,
    used: currentCount + 1,
    limit,
    remaining: limit - currentCount - 1,
  };
}

export async function getUsageToday(userId: string) {
  if (await isAdmin(userId)) {
    return {
      plan: "pro" as PlanType,
      discovery: { used: 0, limit: UNLIMITED_LIMIT },
      analysis: { used: 0, limit: UNLIMITED_LIMIT },
      production: { used: 0, limit: UNLIMITED_LIMIT },
    };
  }

  const plan = await getUserPlan(userId);
  const today = getToday();

  const { data } = await db()
    .from("usage_daily")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  return {
    plan,
    discovery: { used: data?.discovery_count ?? 0, limit: PLAN_LIMITS[plan].discovery },
    analysis: { used: data?.analysis_count ?? 0, limit: PLAN_LIMITS[plan].analysis },
    production: { used: data?.production_count ?? 0, limit: PLAN_LIMITS[plan].production },
  };
}
