"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { logClientEvent } from "@/lib/logClient";

interface ReviewProgramModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
}

export function ReviewProgramModal({ open, onClose, source }: ReviewProgramModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (open) {
      logClientEvent("review_program_modal_viewed", { source });
    }
  }, [open, source]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 sm:p-7">
        {/* 헤더 */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            초기 사용자 프로그램
          </div>
          <h2 className="text-xl font-bold leading-snug">
            블로그 후기 남기고
            <br />
            <span className="text-primary">6개월 무제한 이용권 받기</span>
          </h2>
        </div>

        {/* 대표 메시지 */}
        <div className="rounded-xl bg-muted/50 border border-border/50 px-5 py-4 mb-5 text-sm leading-[1.75] text-muted-foreground max-h-[40vh] overflow-y-auto">
          <p>
            안녕하세요.<br />
            키워드머니를 만들고 있는<br />
            <span className="font-semibold text-foreground">IF AND TRY</span> 대표 이진호입니다.
          </p>
          <p className="mt-3">아직 초기 서비스라 부족한 점이 많습니다.</p>
          <p className="mt-3">
            서비스를 사용해 보신 뒤<br />
            네이버 블로그 후기를 작성해주시면
          </p>
          <p className="mt-3 font-semibold text-foreground">
            6개월 동안 무제한으로 사용할 수 있는<br />
            구독권을 선물로 드리고 있습니다.
          </p>
          <p className="mt-3">앞으로도 많은 관심과 피드백 부탁드립니다.</p>
          <p className="mt-3">
            감사합니다.<br />
            <span className="font-medium text-foreground">이진호 드림</span>
          </p>
        </div>

        {/* 한정 안내 */}
        <p className="text-center text-[11px] text-muted-foreground mb-5">
          * 소수 인원 한정으로 진행되며, 조기 마감될 수 있습니다.
        </p>

        {/* CTA 버튼 */}
        <div className="space-y-2.5 mb-4">
          <button
            onClick={() => {
              logClientEvent("review_program_cta_blog_clicked", { source });
              onClose();
              router.push("/review-program");
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            블로그 후기 작성하러 가기
          </button>
          <button
            onClick={() => {
              logClientEvent("review_program_cta_submit_clicked", { source });
              onClose();
              router.push(`/review-program/submit${source ? `?source=${source}` : ""}`);
            }}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            후기 인증 제출하기
          </button>
        </div>

        {/* 보조 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              logClientEvent("review_program_dismissed", { source });
              onClose();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}
