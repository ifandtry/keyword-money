"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { logClientEvent } from "@/lib/logClient";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  BarChart3,
  Image,
  FileText,
  Hash,
  Lightbulb,
  ListOrdered,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { TopPostsAnalysis } from "@/types/blog";

export default function TopInsightsPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">로딩 중...</div>}>
      <TopInsightsContent />
    </Suspense>
  );
}

function TopInsightsContent() {
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("keyword") || "";

  const [keyword, setKeyword] = useState(initialKeyword);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TopPostsAnalysis | null>(null);
  const [error, setError] = useState("");

  const handleAnalyze = useCallback(async (q?: string) => {
    const query = (q ?? keyword).trim();
    if (!query) return;

    logClientEvent("blog_cta_click", { cta: "top_insights_analyze", keyword: query });
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/blog/top-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "분석에 실패했습니다");
      } else {
        setResult(data);
      }
    } catch {
      setError("서버 연결에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  // URL 파라미터로 키워드가 넘어오면 자동 분석
  useEffect(() => {
    if (initialKeyword && !result && !loading) {
      handleAnalyze(initialKeyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="상위 글 특징 분석"
        description="키워드 검색 결과 상위 블로그 글들의 공통 패턴을 분석합니다"
      />

      {/* 입력 */}
      <Card className="p-4 mb-6">
        <div className="flex gap-2">
          <Input
            placeholder="분석할 키워드를 입력하세요 (예: 다이어트 식단)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="h-11"
          />
          <Button
            onClick={() => handleAnalyze()}
            disabled={loading || !keyword.trim()}
            className="h-11 px-6 gap-2 shrink-0"
          >
            <Search className="h-4 w-4" />
            분석
          </Button>
        </div>
        {!initialKeyword && !result && !loading && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <Link
              href="/keyword/discover"
              className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              돈이 되는 키워드 탐색이 필요한 경우
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </Card>

      {/* 로딩 */}
      {loading && (
        <div className="space-y-4">
          <Card className="p-6">
            <Skeleton className="h-5 w-48 mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </Card>
          <p className="text-center text-sm text-muted-foreground">
            상위 블로그를 분석 중입니다... (최대 30초 소요)
          </p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <Card className="p-6 border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 통계 */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              상위 글 평균 통계
              <Badge variant="secondary" className="text-xs">
                {result.successCount}/{result.totalCount}개 분석 성공
              </Badge>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                label="평균 글자수"
                value={`${result.avgTextLength.toLocaleString()}자`}
                sub={`${result.minTextLength.toLocaleString()}~${result.maxTextLength.toLocaleString()}`}
              />
              <StatCard
                icon={<Image className="h-4 w-4" />}
                label="평균 이미지"
                value={`${result.avgImageCount}개`}
              />
              <StatCard
                icon={<ListOrdered className="h-4 w-4" />}
                label="평균 섹션"
                value={`${result.avgSectionCount}개`}
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                label="평균 문단"
                value={`${result.avgParagraphCount}개`}
              />
            </div>
          </Card>

          {/* 인사이트 */}
          {result.insights.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                분석 인사이트
              </h3>
              <ul className="space-y-2">
                {result.insights.map((insight, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary mt-0.5">-</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 공통 키워드 */}
          {result.commonSubKeywords.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-green-600" />
                공통 서브 키워드
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.commonSubKeywords.map((kw) => (
                  <Badge key={kw.keyword} variant="outline" className="text-xs">
                    {kw.keyword}
                    <span className="ml-1 text-muted-foreground">
                      ({kw.count}개 글)
                    </span>
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* 추천 아웃라인 */}
          {result.recommendedOutline.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-violet-600" />
                추천 글 구조
              </h3>
              <ol className="space-y-1.5">
                {result.recommendedOutline.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm flex items-start gap-2"
                  >
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* 개별 글 목록 */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">분석된 글 목록</h3>
            <div className="space-y-3">
              {result.posts.map((post, i) => (
                <div
                  key={i}
                  className="text-sm border border-border/30 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium truncate">
                      {post.title || `글 ${i + 1}`}
                    </span>
                    {post.error && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        실패
                      </Badge>
                    )}
                  </div>
                  {!post.error && (
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{post.textLength.toLocaleString()}자</span>
                      <span>이미지 {post.imageCount}개</span>
                      <span>섹션 {post.sectionCount}개</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/30 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
