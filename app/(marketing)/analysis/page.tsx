"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/Stepper";
import { useUsageLimit } from "@/hooks/useUsageLimit";
import { ExpansionResponse, MoneyKeywordItem, BlogReference } from "@/types";
import {
  Loader2,
  ArrowRight,
  ExternalLink,
  Crown,
  Star,
  BookOpen,
} from "lucide-react";
import { Toaster, toast } from "sonner";

function KeywordCard({
  item,
  isMain,
}: {
  item: MoneyKeywordItem;
  isMain: boolean;
}) {
  return (
    <Card
      className={`rounded-2xl transition-all ${
        isMain
          ? "neu-glow-gold ring-2 ring-primary/30"
          : "border border-border/30 shadow-sm"
      }`}
    >
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-center gap-2 mb-3">
          {isMain ? (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs gap-1">
              <Crown className="h-3 w-3" /> 메인 키워드
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1"
            >
              <Star className="h-3 w-3" /> 서브 키워드
            </Badge>
          )}
          {item.commercialTokens.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
            >
              {item.commercialTokens.join(" ")}
            </Badge>
          )}
        </div>
        <p className={`font-bold mb-3 ${isMain ? "text-xl" : "text-lg"}`}>
          {item.keyword}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">총검색량</p>
            <p className="font-semibold">
              {item.totalVolume.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">총문서수</p>
            <p className="font-medium text-muted-foreground">
              {item.totalDocCount > 0
                ? item.totalDocCount.toLocaleString()
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">MoneyScore</p>
            <p className="font-bold text-lg">{item.moneyScore.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">FinalScore</p>
            <p className="font-bold text-lg text-primary">
              {item.finalScore.toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BlogList({ blogs }: { blogs: BlogReference[] }) {
  if (blogs.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-green-600" />
        <h2 className="text-xl font-semibold">
          참고용: 네이버 상단 블로그
        </h2>
        <Badge variant="outline" className="text-xs">
          {blogs.length}개
        </Badge>
      </div>
      <div className="space-y-3">
        {blogs.map((blog, i) => (
          <a
            key={i}
            href={blog.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-muted/30 p-4 border border-border/20 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm mb-1">{blog.title}</p>
                {blog.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                    {blog.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">
                    {blog.bloggerName}
                  </span>
                  {blog.postDate && <span>{blog.postDate}</span>}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center text-muted-foreground">로딩 중...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}

function AnalysisContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keywordParam = searchParams.get("keyword") || "";
  const isWorkspace = pathname.startsWith("/keyword/");

  const [data, setData] = useState<ExpansionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKeyword, setInputKeyword] = useState(keywordParam);

  const { canUse, increment } = useUsageLimit();

  const handleExpand = useCallback(
    async (kw: string) => {
      if (!kw.trim()) return;
      if (!canUse()) {
        toast.error("일일 사용 한도를 초과했습니다.");
        return;
      }

      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch("/api/expansion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw.trim() }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "확장 실패");
        }

        const result: ExpansionResponse = await res.json();
        setData(result);
        increment();
      } catch (e) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    },
    [canUse, increment]
  );

  useEffect(() => {
    if (keywordParam && !data && !loading) {
      handleExpand(keywordParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoToProduction = () => {
    if (!data) return;
    const params = new URLSearchParams();
    params.set("main", data.mainKeyword.keyword);
    if (data.subKeywords.length > 0) {
      params.set(
        "sub",
        data.subKeywords.map((s) => s.keyword).join(",")
      );
    }
    const base = isWorkspace ? "/keyword/ideas" : "/production";
    router.push(`${base}?${params.toString()}`);
  };

  return (
    <main className="bg-background min-h-screen">
      <Toaster richColors />
      <div className="container mx-auto px-4">
        <Stepper currentStep={2} />

        <section className="max-w-2xl mx-auto mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">키워드 분석 및 확장</h1>
          {keywordParam && !data && !loading && (
            <p className="text-muted-foreground">
              &ldquo;{keywordParam}&rdquo; 키워드를 확장 분석합니다
            </p>
          )}
        </section>

        {/* 키워드 입력 폼 */}
        {!loading && !data && (
          <section className="max-w-lg mx-auto mb-8 animate-in fade-in duration-300">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inputKeyword.trim()) return;
                const base = isWorkspace ? "/keyword/analyze" : "/analysis";
                router.push(`${base}?keyword=${encodeURIComponent(inputKeyword.trim())}`);
                handleExpand(inputKeyword.trim());
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputKeyword}
                onChange={(e) => setInputKeyword(e.target.value)}
                placeholder="분석할 키워드를 입력하세요"
                className="flex-1 h-12 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="submit"
                size="lg"
                className="h-12 px-6 rounded-xl btn-analyze"
                disabled={!inputKeyword.trim()}
              >
                분석 시작
              </Button>
            </form>
          </section>
        )}

        {/* 로딩 */}
        {loading && (
          <section className="max-w-4xl mx-auto pb-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground">
                자동완성 + 연관 키워드 수집 및 분석 중...
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 mt-8 rounded-2xl" />
          </section>
        )}

        {/* 에러 */}
        {error && (
          <section className="max-w-4xl mx-auto pb-8">
            <div className="rounded-2xl bg-destructive/10 p-4 text-center text-destructive">
              {error}
            </div>
            <div className="text-center mt-4">
              <Link href={isWorkspace ? "/keyword/discover" : "/discovery"}>
                <Button variant="outline">키워드 탐색으로 돌아가기</Button>
              </Link>
            </div>
          </section>
        )}

        {/* 결과 */}
        {data && !loading && (
          <section className="max-w-5xl mx-auto pb-12 space-y-10">
            {/* 메인 + 서브 키워드 카드 */}
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KeywordCard item={data.mainKeyword} isMain={true} />
                {data.subKeywords.map((sub) => (
                  <KeywordCard
                    key={sub.keyword}
                    item={sub}
                    isMain={false}
                  />
                ))}
              </div>
            </div>

            {/* CTA: 콘텐츠 아이디어 만들기 */}
            <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
              <Button
                size="lg"
                onClick={handleGoToProduction}
                className="h-14 px-8 text-base rounded-2xl gap-2 btn-analyze"
              >
                이 키워드로 콘텐츠 아이디어 만들기
                <ArrowRight className="h-5 w-5" />
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                메인: {data.mainKeyword.keyword} / 서브:{" "}
                {data.subKeywords.map((s) => s.keyword).join(", ")}
              </p>
            </div>

            {/* 상위 블로그 */}
            <BlogList blogs={data.topBlogs} />

            {/* 전체 후보 키워드 목록 (접기/펼치기) */}
            <details className="animate-in fade-in duration-300">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
                전체 후보 키워드 {data.allCandidates.length}개 보기
              </summary>
              <div className="rounded-2xl overflow-x-auto border border-border/30 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium">키워드</th>
                      <th className="text-right p-3 font-medium">검색량</th>
                      <th className="text-right p-3 font-medium">문서수</th>
                      <th className="text-right p-3 font-medium">
                        MoneyScore
                      </th>
                      <th className="text-right p-3 font-medium">
                        FinalScore
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.allCandidates.map((item) => {
                      const isMain =
                        item.keyword === data.mainKeyword.keyword;
                      const isSub = data.subKeywords.some(
                        (s) => s.keyword === item.keyword
                      );
                      return (
                        <tr
                          key={item.keyword}
                          className={`border-b ${isMain ? "bg-amber-50" : isSub ? "bg-blue-50/50" : ""}`}
                        >
                          <td className="p-3 font-medium">
                            {item.keyword}
                            {isMain && (
                              <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-800">
                                메인
                              </Badge>
                            )}
                            {isSub && (
                              <Badge className="ml-2 text-[10px] bg-blue-100 text-blue-800">
                                서브
                              </Badge>
                            )}
                          </td>
                          <td className="text-right p-3">
                            {item.totalVolume.toLocaleString()}
                          </td>
                          <td className="text-right p-3 text-muted-foreground">
                            {item.totalDocCount > 0
                              ? item.totalDocCount.toLocaleString()
                              : "-"}
                          </td>
                          <td className="text-right p-3 font-bold">
                            {item.moneyScore.toFixed(2)}
                          </td>
                          <td className="text-right p-3 font-bold text-primary">
                            {item.finalScore.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}
