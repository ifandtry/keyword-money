"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { KeywordTable } from "@/components/KeywordTable";
import { TagModal } from "@/components/TagModal";
import { TransformSection } from "@/components/TransformSection";
import { TrendChart } from "@/components/TrendChart";
import { useUsageLimit } from "@/hooks/useUsageLimit";
import { AnalyzeResponse } from "@/types";
import { Search, TrendingUp, Wand2, Zap } from "lucide-react";
import { Toaster, toast } from "sonner";

const gradeColors: Record<string, string> = {
  S: "bg-yellow-500 text-black hover:bg-yellow-500",
  A: "bg-green-500 text-white hover:bg-green-500",
  B: "bg-blue-500 text-white hover:bg-blue-500",
  C: "bg-gray-500 text-white hover:bg-gray-500",
  D: "bg-red-500 text-white hover:bg-red-500",
};

const EXAMPLE_KEYWORDS = [
  "다이어트 식단",
  "아이폰 케이스 추천",
  "강아지 간식",
  "부업 추천",
  "제주도 여행",
];

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(
    new Set()
  );

  const [tagOpen, setTagOpen] = useState(false);

  const { remaining, canUse, increment } = useUsageLimit();

  const handleAnalyze = async (searchKeyword?: string) => {
    const kw = searchKeyword || keyword;
    if (!kw.trim()) {
      toast.error("키워드를 입력해주세요.");
      return;
    }
    if (!canUse()) {
      toast.error("일일 사용 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeData(null);
    setSelectedKeywords(new Set());

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "분석 실패");
      }

      const data: AnalyzeResponse = await res.json();
      setAnalyzeData(data);
      increment();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <Toaster richColors />

      {/* Hero */}
      <section className="container mx-auto px-4 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          키워드머니
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          돈이 되는 키워드를 AI가 찾아드립니다
        </p>

        {/* 검색 */}
        <div className="mx-auto mt-8 flex max-w-xl gap-2">
          <Input
            placeholder="수익성 높은 키워드를 검색하세요"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className="h-12 text-base"
          />
          <Button
            onClick={() => handleAnalyze()}
            disabled={analyzing}
            className="h-12 px-6"
          >
            {analyzing ? (
              "분석중..."
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" /> 분석
              </>
            )}
          </Button>
        </div>

        {/* 예시 키워드 */}
        <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-2">
          {EXAMPLE_KEYWORDS.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setKeyword(ex);
                handleAnalyze(ex);
              }}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          오늘 남은 횟수: {remaining}/5
        </p>
      </section>

      {/* 로딩 */}
      {analyzing && (
        <section className="container mx-auto px-4 pb-8">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </section>
      )}

      {/* 에러 */}
      {analyzeError && (
        <section className="container mx-auto px-4 pb-8">
          <div className="rounded-md bg-destructive/10 p-4 text-center text-destructive">
            {analyzeError}
          </div>
        </section>
      )}

      {/* 결과 */}
      {analyzeData && !analyzing && (() => {
        const seedItem = analyzeData.seedItem;
        const relatedItems = analyzeData.items;
        return (
          <section className="container mx-auto px-4 pb-8 space-y-8">
            {/* 시드 키워드 카드 */}
            {seedItem && (
              <div>
                <h2 className="mb-3 text-2xl font-semibold">
                  시드 키워드
                </h2>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">키워드</p>
                        <p className="text-xl font-bold">{seedItem.keyword}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">PC</p>
                        <p className="text-lg font-semibold">{seedItem.pcVolume.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">모바일</p>
                        <p className="text-lg font-semibold">{seedItem.mobileVolume.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">총검색량</p>
                        <p className="text-lg font-semibold">{seedItem.totalVolume.toLocaleString()}</p>
                      </div>
                      {seedItem.totalDocCount > 0 && (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">총문서수</p>
                          <p className="text-lg font-semibold text-muted-foreground">{seedItem.totalDocCount.toLocaleString()}</p>
                        </div>
                      )}
                      {seedItem.totalDocCount > 0 && (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">포화도</p>
                          <p className={`text-lg font-semibold ${seedItem.saturation < 5 ? "text-green-600" : seedItem.saturation > 50 ? "text-red-500" : ""}`}>
                            {seedItem.saturation.toFixed(1)}
                          </p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">수익점수</p>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{seedItem.profitScore}</p>
                          <Badge className={gradeColors[seedItem.grade]}>{seedItem.grade}</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{seedItem.reason}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 월별 검색 트렌드 */}
            {analyzeData.seed && (
              <TrendChart keyword={analyzeData.seed} />
            )}

            {/* 연관 키워드 테이블 */}
            <div>
              <h2 className="mb-3 text-2xl font-semibold">
                연관 키워드 ({relatedItems.length}개)
              </h2>
              <KeywordTable
                items={relatedItems}
                selectedKeywords={selectedKeywords}
                onToggleKeyword={toggleKeyword}
                onOpenTagModal={() => setTagOpen(true)}
              />
            </div>

            <Separator />

            {/* 글 변환 섹션 */}
            <TransformSection
              selectedKeywords={Array.from(selectedKeywords)}
              onTransformUsed={() => increment()}
            />
          </section>
        );
      })()}

      {/* 기능 소개 (결과 없을 때) */}
      {!analyzeData && !analyzing && (
        <section className="container mx-auto grid gap-4 px-4 pb-16 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-primary" />
              <CardTitle>수익성 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                검색량, CPC, 경쟁도를 종합해 수익 가능성을 점수로 제시합니다.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Wand2 className="h-8 w-8 text-primary" />
              <CardTitle>블로그 글 변환</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                기존 블로그 글에 수익 키워드를 자연스럽게 삽입해 &ldquo;돈 되는
                글&rdquo;로 변환합니다.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-primary" />
              <CardTitle>태그 & CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                키워드를 다양한 태그 형식으로 복사하고 CSV로 내보냅니다.
              </CardDescription>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Tag Modal */}
      <TagModal
        open={tagOpen}
        onClose={() => setTagOpen(false)}
        keywords={Array.from(selectedKeywords)}
      />
    </main>
  );
}
