"use client";

import Link from "next/link";
import { logClientEvent } from "@/lib/logClient";
import { PageHeader } from "@/components/workspace/PageHeader";

export default function ReviewProgramPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="초기 사용자 프로그램"
        description="블로그 후기를 남기고 1년 무제한 이용권을 받으세요"
      />

      {/* 안내 */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">참여 방법</h2>
        <div className="space-y-4">
          {[
            { step: "1", title: "서비스 사용해보기", desc: "키워드 탐색, 콘텐츠 아이디어 등 기능을 자유롭게 사용해보세요." },
            { step: "2", title: "네이버 블로그에 후기 작성", desc: "사용 경험을 솔직하게 블로그에 작성해주세요. 스크린샷 포함 시 더 좋습니다." },
            { step: "3", title: "후기 인증 제출", desc: "작성한 블로그 글 URL을 제출하면 검토 후 1년 무제한 이용권이 지급됩니다." },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-bold">
                {item.step}
              </div>
              <div>
                <p className="font-semibold text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 작성 가이드 */}
      <div className="rounded-2xl border border-border/30 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">후기 작성 가이드</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• 네이버 블로그에 300자 이상 작성</li>
          <li>• 키워드머니 사용 화면 스크린샷 1장 이상 포함</li>
          <li>• 솔직한 사용 후기 (장점, 아쉬운 점 모두 OK)</li>
          <li>• 제목 예시: &ldquo;키워드머니 사용 후기 - 블로그 키워드 분석 도구&rdquo;</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/review-program/submit"
          onClick={() => logClientEvent("review_page_cta_click", { cta: "submit" })}
          className="flex-1 text-center px-6 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          후기 인증 제출하기
        </Link>
        <Link
          href="/keyword/discover"
          onClick={() => logClientEvent("review_page_cta_click", { cta: "try_service" })}
          className="flex-1 text-center px-6 py-3 rounded-xl text-sm font-semibold border border-border hover:bg-muted/50 transition-colors"
        >
          서비스 먼저 사용해보기
        </Link>
      </div>
    </div>
  );
}
