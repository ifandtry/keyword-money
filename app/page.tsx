"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  FileText,
  TrendingUp,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Toaster } from "sonner";

const FALLBACK_KEYWORDS = [
  "다이어트 식단",
  "아이폰 케이스 추천",
  "강아지 간식",
  "부업 추천",
  "제주도 여행",
];

export default function Home() {
  const [trendingKeywords, setTrendingKeywords] =
    useState<string[]>(FALLBACK_KEYWORDS);

  useEffect(() => {
    fetch("/api/trending")
      .then((res) => res.json())
      .then((d) => {
        if (d.keywords && d.keywords.length > 0) {
          setTrendingKeywords(d.keywords);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="bg-background">
      <Toaster richColors />

      {/* Hero */}
      <section className="relative overflow-hidden container mx-auto px-4 pt-24 pb-16 text-center">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl lg:text-5xl">
            검색량만 보는 시대는 끝났습니다
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            돈이 되는 키워드를 찾고, 바로 콘텐츠 아이디어까지 만들어 보세요.
            <br className="hidden sm:block" />
            AI가 검색량, 문서수, 상업적 의도를 종합 분석해 수익화 가능성을 점수로 제시합니다.
          </p>
        </div>

        {/* CTA 2개 */}
        <div className="mx-auto mt-12 flex flex-col sm:flex-row max-w-xl justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <Link href="/discovery" className="flex-1">
            <Button
              size="lg"
              className="w-full h-14 text-base rounded-2xl gap-2 btn-analyze"
            >
              <Search className="h-5 w-5" />
              머니 키워드 찾으러 가기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/production" className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base rounded-2xl gap-2 border-2"
            >
              <FileText className="h-5 w-5" />
              머니 콘텐츠 찾으러 가기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* 인기 검색어 */}
        <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-2 animate-in fade-in duration-700 delay-400">
          <span className="text-xs text-muted-foreground/60 self-center mr-1">
            <TrendingUp className="inline h-3 w-3 mr-0.5" />
            인기
          </span>
          {trendingKeywords.map((kw) => (
            <Link
              key={kw}
              href={`/discovery?q=${encodeURIComponent(kw)}`}
              className="rounded-full bg-background px-3.5 py-1.5 text-sm text-muted-foreground border border-border/30 hover:border-primary/30 hover:text-primary transition-all duration-200"
            >
              {kw}
            </Link>
          ))}
        </div>
      </section>

      {/* 기능 카드 */}
      <section className="container mx-auto grid gap-6 px-4 pb-20 sm:grid-cols-3">
        {[
          {
            icon: Search,
            title: "Step 1. 키워드 탐색",
            desc: "검색량과 문서수를 분석해 MoneyScore를 계산하고, 돈이 되는 키워드를 찾아냅니다.",
            delay: "delay-0",
          },
          {
            icon: Zap,
            title: "Step 2. 키워드 확장",
            desc: "자동완성과 연관 키워드를 수집하고, AI가 메인/서브 키워드를 자동 선정합니다.",
            delay: "delay-100",
          },
          {
            icon: FileText,
            title: "Step 3. 콘텐츠 아이디어",
            desc: "선정된 키워드로 돈 되는 제목 10개와 글 구조/개요를 자동 생성합니다.",
            delay: "delay-200",
          },
        ].map(({ icon: Icon, title, desc, delay }) => (
          <Card
            key={title}
            className={`group relative overflow-hidden rounded-3xl border border-border/30 shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-700 ${delay}`}
          >
            <CardHeader className="relative pb-2">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                <Icon className="h-6 w-6 text-primary icon-hover" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-0">
              <CardDescription className="leading-relaxed">
                {desc}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
