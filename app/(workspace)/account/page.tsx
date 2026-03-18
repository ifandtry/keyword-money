"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlanType } from "@/types";
import { PageHeader } from "@/components/workspace/PageHeader";

interface UsageData {
  plan: PlanType;
  discovery: { used: number; limit: number };
  analysis: { used: number; limit: number };
  production: { used: number; limit: number };
}

const PLAN_LABELS: Record<PlanType, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

export default function AccountPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => res.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  const plan = usage?.plan ?? "free";

  const formatLimit = (limit: number) =>
    limit >= 999999 ? "무제한" : `${limit}`;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="내 계정" />

      {/* 현재 플랜 */}
      <div className="rounded-2xl border border-border/30 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">현재 플랜</h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-bold">{PLAN_LABELS[plan]}</span>
          {plan === "free" && (
            <Link
              href="/review-program"
              className="text-sm font-semibold text-primary hover:underline"
            >
              후기 작성하고 업그레이드
            </Link>
          )}
        </div>
        {plan === "free" && (
          <p className="text-sm text-muted-foreground">
            블로그 후기를 작성하시면 6개월 무제한 이용권을 받을 수 있습니다.
          </p>
        )}
      </div>

      {/* 사용량 */}
      <div className="rounded-2xl border border-border/30 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">오늘의 사용량</h2>
        {usage ? (
          <div className="space-y-4">
            {([
              { label: "키워드 탐색", key: "discovery" as const },
              { label: "키워드 분석", key: "analysis" as const },
              { label: "콘텐츠 생성", key: "production" as const },
            ] as const).map(({ label, key }) => {
              const data = usage[key];
              const isUnlimited = data.limit >= 999999;
              const pct = isUnlimited
                ? 0
                : data.limit > 0
                  ? Math.min((data.used / data.limit) * 100, 100)
                  : 100;

              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {data.used} / {formatLimit(data.limit)}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100
                            ? "bg-destructive"
                            : pct >= 80
                              ? "bg-amber-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  {isUnlimited && (
                    <div className="text-xs text-muted-foreground">무제한</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        )}
      </div>

      {/* 후기 프로그램 CTA */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-6">
        <h2 className="text-lg font-semibold mb-2">초기 사용자 프로그램</h2>
        <p className="text-sm text-muted-foreground mb-4">
          블로그 후기를 작성해주시면 6개월 무제한 이용권을 선물로 드립니다.
        </p>
        <Link
          href="/review-program"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          프로그램 참여하기
        </Link>
      </div>
    </div>
  );
}
