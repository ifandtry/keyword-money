"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { logClientEvent } from "@/lib/logClient";

type UsageGateVariant = "guest" | "free";

interface UsageGateModalProps {
  open: boolean;
  variant: UsageGateVariant;
  onClose: () => void;
  source?: string;
}

const CONTENT = {
  guest: {
    badge: "로그인 후 계속 이용",
    title: "오늘의 무료 탐색 횟수를 모두 사용했어요",
    description:
      "로그인하면 탐색 결과를 계속 이어서 관리할 수 있어요. 무료 회원은 하루 5회까지 키워드 탐색을 사용할 수 있습니다.",
    primaryLabel: "로그인하러 가기",
    primaryHref: "/login",
    secondaryLabel: "나중에 할게요",
  },
  free: {
    badge: "구독 플랜 안내",
    title: "무료 플랜의 오늘 탐색 횟수를 모두 사용했어요",
    description:
      "구독 플랜으로 업그레이드하면 키워드 탐색을 무제한으로 사용할 수 있습니다.",
    primaryLabel: "구독 플랜 보기",
    primaryHref: "/pricing",
    secondaryLabel: "닫기",
  },
} as const;

export function UsageGateModal({ open, variant, onClose, source }: UsageGateModalProps) {
  const router = useRouter();
  const content = CONTENT[variant];

  useEffect(() => {
    if (open) {
      logClientEvent("usage_gate_modal_viewed", { source, variant });
    }
  }, [open, source, variant]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 sm:p-7">
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            {content.badge}
          </div>
          <h2 className="text-xl font-bold leading-snug">{content.title}</h2>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border/50 px-5 py-4 mb-5 text-sm leading-[1.75] text-muted-foreground">
          <p>{content.description}</p>
        </div>

        <div className="space-y-2.5 mb-4">
          <button
            onClick={() => {
              logClientEvent("usage_gate_modal_primary_clicked", { source, variant });
              onClose();
              router.push(content.primaryHref);
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {content.primaryLabel}
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => {
              logClientEvent("usage_gate_modal_dismissed", { source, variant });
              onClose();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {content.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
