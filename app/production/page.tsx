"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/Stepper";
import { useUsageLimit } from "@/hooks/useUsageLimit";
import { ProductionResponse } from "@/types";
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  FileText,
  ListOrdered,
  Plus,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";

export default function ProductionPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center text-muted-foreground">로딩 중...</div>}>
      <ProductionContent />
    </Suspense>
  );
}

function ProductionContent() {
  const searchParams = useSearchParams();
  const mainParam = searchParams.get("main") || "";
  const subParam = searchParams.get("sub") || "";

  const [mainKeyword, setMainKeyword] = useState(mainParam);
  const [subInput, setSubInput] = useState("");
  const [subKeywords, setSubKeywords] = useState<string[]>(
    subParam ? subParam.split(",").filter(Boolean) : []
  );
  const [data, setData] = useState<ProductionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedOutline, setCopiedOutline] = useState(false);

  const { canUse, increment } = useUsageLimit();

  const handleGenerate = useCallback(async () => {
    if (!mainKeyword.trim()) {
      toast.error("메인 키워드를 입력해주세요.");
      return;
    }
    if (!canUse()) {
      toast.error("일일 사용 한도를 초과했습니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainKeyword: mainKeyword.trim(),
          subKeywords,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "생성 실패");
      }

      const result: ProductionResponse = await res.json();
      setData(result);
      increment();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [mainKeyword, subKeywords, canUse, increment]);

  // URL params에 main이 있으면 자동 생성
  useEffect(() => {
    if (mainParam && !data && !loading) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSubKeyword = () => {
    const kw = subInput.trim();
    if (kw && !subKeywords.includes(kw)) {
      setSubKeywords((prev) => [...prev, kw]);
      setSubInput("");
    }
  };

  const removeSubKeyword = (kw: string) => {
    setSubKeywords((prev) => prev.filter((s) => s !== kw));
  };

  const copyTitle = async (title: string, idx: number) => {
    await navigator.clipboard.writeText(title);
    toast.success("제목이 복사되었습니다!");
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const copyOutline = async () => {
    if (!data) return;
    const text = [
      `# ${data.outline.title}`,
      "",
      ...data.outline.sections.flatMap((s) => [
        `## ${s.heading}`,
        ...s.points.map((p) => `- ${p}`),
        "",
      ]),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("개요가 복사되었습니다!");
    setCopiedOutline(true);
    setTimeout(() => setCopiedOutline(false), 1500);
  };

  const hasParams = !!mainParam;

  return (
    <main className="bg-background min-h-screen">
      <Toaster richColors />
      <div className="container mx-auto px-4">
        <Stepper currentStep={3} />

        <section className="max-w-2xl mx-auto mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">콘텐츠 아이디어 구상</h1>
          <p className="text-muted-foreground text-sm">
            메인 + 서브 키워드로 돈 되는 제목과 글 구조를 생성합니다
          </p>
        </section>

        {/* 입력 영역 (Step2에서 온 경우 pre-filled) */}
        {(!hasParams || !data) && !loading && (
          <section className="max-w-2xl mx-auto mb-8 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-background p-5 shadow-lg shadow-black/[0.04] border border-border/30 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  메인 키워드
                </label>
                <Input
                  placeholder="메인 키워드를 입력하세요"
                  value={mainKeyword}
                  onChange={(e) => setMainKeyword(e.target.value)}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  서브 키워드
                </label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="서브 키워드 추가"
                    value={subInput}
                    onChange={(e) => setSubInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubKeyword()}
                    className="h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSubKeyword}
                    className="h-9"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {subKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => removeSubKeyword(kw)}
                    >
                      {kw}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !mainKeyword.trim()}
                className="w-full h-12 rounded-xl btn-analyze gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 생성 중...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    콘텐츠 아이디어 생성
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {/* 로딩 */}
        {loading && (
          <section className="max-w-3xl mx-auto pb-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground">
                AI가 콘텐츠 아이디어를 생성하고 있습니다...
              </p>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 mt-8 rounded-2xl" />
          </section>
        )}

        {/* 에러 */}
        {error && (
          <section className="max-w-3xl mx-auto pb-8">
            <div className="rounded-2xl bg-destructive/10 p-4 text-center text-destructive">
              {error}
            </div>
          </section>
        )}

        {/* 결과 */}
        {data && !loading && (
          <section className="max-w-4xl mx-auto pb-12 space-y-10">
            {/* 키워드 요약 */}
            <div className="flex items-center justify-center gap-2 flex-wrap animate-in fade-in duration-300">
              <Badge className="bg-amber-100 text-amber-800 text-sm px-3 py-1">
                메인: {mainKeyword}
              </Badge>
              {subKeywords.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="text-sm px-3 py-1"
                >
                  {kw}
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                disabled={loading}
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 생성
              </Button>
            </div>

            {/* 제목 10개 */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-4">
                <ListOrdered className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  돈 되는 콘텐츠 제목 ({data.titles.length}개)
                </h2>
              </div>
              <div className="space-y-2">
                {data.titles.map((title, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-background p-4 border border-border/30 shadow-sm gap-3 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-bold text-muted-foreground w-6 shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-sm">{title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => copyTitle(title, i)}
                    >
                      {copiedIdx === i ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* 글 개요 */}
            {data.outline && data.outline.sections.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <h2 className="text-xl font-semibold">글 구조/개요</h2>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyOutline}
                    className="gap-1"
                  >
                    {copiedOutline ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    복사
                  </Button>
                </div>

                <Card className="rounded-2xl border border-border/30 shadow-sm">
                  <CardContent className="pt-6 pb-6 px-6">
                    <h3 className="text-lg font-bold mb-6">
                      {data.outline.title}
                    </h3>
                    <div className="space-y-6">
                      {data.outline.sections.map((section, i) => (
                        <div key={i}>
                          <h4 className="font-semibold text-base mb-2 flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {i + 1}
                            </span>
                            {section.heading}
                          </h4>
                          <ul className="space-y-1.5 pl-8">
                            {section.points.map((point, j) => (
                              <li
                                key={j}
                                className="text-sm text-muted-foreground list-disc"
                              >
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 하단 네비게이션 */}
            <div className="flex justify-center gap-4 pt-4">
              <Link href="/discovery">
                <Button variant="outline" className="gap-1">
                  새 키워드 탐색
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={handleGenerate}
                disabled={loading}
                className="gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                다시 생성
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
