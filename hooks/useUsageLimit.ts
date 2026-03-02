"use client";

import { useState, useEffect } from "react";
import { UsageRecord } from "@/types";

const STORAGE_KEY = "keywordmoney_usage";
const DAILY_LIMIT = 500;

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getRecord(): UsageRecord {
  if (typeof window === "undefined") return { date: getToday(), count: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: getToday(), count: 0 };
    const record: UsageRecord = JSON.parse(raw);
    if (record.date !== getToday()) {
      return { date: getToday(), count: 0 };
    }
    return record;
  } catch {
    return { date: getToday(), count: 0 };
  }
}

export function useUsageLimit() {
  const [remaining, setRemaining] = useState(DAILY_LIMIT);

  useEffect(() => {
    setRemaining(Math.max(0, DAILY_LIMIT - getRecord().count));
  }, []);

  function canUse(): boolean {
    return getRecord().count < DAILY_LIMIT;
  }

  function increment(): boolean {
    if (!canUse()) return false;
    const record = getRecord();
    record.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setRemaining(Math.max(0, DAILY_LIMIT - record.count));
    return true;
  }

  return { remaining, canUse, increment, DAILY_LIMIT };
}
