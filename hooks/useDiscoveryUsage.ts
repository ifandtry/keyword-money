"use client";

import { useCallback, useEffect, useState } from "react";

const UNLIMITED_LIMIT = 999999;
const GUEST_DISCOVERY_LIMIT = 5;

type DiscoveryUsageResponse = {
  plan: "guest" | "free" | "basic" | "pro";
  discovery: {
    used: number;
    limit: number;
  };
};

const FALLBACK_USAGE: DiscoveryUsageResponse = {
  plan: "guest",
  discovery: {
    used: 0,
    limit: GUEST_DISCOVERY_LIMIT,
  },
};

export function useDiscoveryUsage() {
  const [usage, setUsage] = useState<DiscoveryUsageResponse>(FALLBACK_USAGE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/usage", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("usage_fetch_failed");
      }

      const data = (await response.json()) as DiscoveryUsageResponse;
      setUsage(data);
    } catch {
      setUsage(FALLBACK_USAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const plan = usage.plan;
  const used = usage.discovery.used;
  const limit = usage.discovery.limit;
  const isUnlimited = limit >= UNLIMITED_LIMIT;
  const remaining = isUnlimited ? UNLIMITED_LIMIT : Math.max(0, limit - used);
  const canUse = loading ? true : isUnlimited || remaining > 0;

  return {
    plan,
    used,
    limit,
    remaining,
    loading,
    isUnlimited,
    canUse,
    refresh,
  };
}
