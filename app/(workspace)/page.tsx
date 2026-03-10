"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  BarChart3,
  Link2,
  FileText,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const FALLBACK_KEYWORDS = [
  "다이어트 식단",
  "아이폰 케이스 추천",
  "강아지 간식",
  "부업 추천",
  "제주도 여행",
  "육아 용품",
  "인테리어 소품",
  "건강 보조제",
];

function TrendingTicker({ keywords }: { keywords: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const offsetRef = useRef(0);

  // 2벌이면 무한 루프 가능
  const doubled = [...keywords, ...keywords];

  const nudge = (direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    // 첫 번째 카드의 실제 너비 + gap(8px) 만큼 이동
    const firstCard = track.children[0] as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.offsetWidth + 8 : 100;
    const style = getComputedStyle(track);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const current = matrix.m41;
    const delta = direction === "right" ? -cardWidth : cardWidth;
    offsetRef.current = current + delta;
    track.style.transition = "transform 0.3s ease";
    track.style.animationPlayState = "paused";
    track.style.transform = `translateX(${offsetRef.current}px)`;
  };

  const handleMouseEnter = () => {
    setHovered(true);
    const track = trackRef.current;
    if (track) {
      const style = getComputedStyle(track);
      const matrix = new DOMMatrixReadOnly(style.transform);
      offsetRef.current = matrix.m41;
      track.style.animationPlayState = "paused";
      track.style.transform = `translateX(${offsetRef.current}px)`;
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    const track = trackRef.current;
    if (track) {
      track.style.transition = "";
      track.style.transform = "";
      track.style.animationPlayState = "";
    }
  };

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 좌우 페이드 */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* 좌측 화살표 */}
      <button
        onClick={() => nudge("left")}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 flex items-center justify-center rounded-full bg-background border border-border/50 shadow-sm text-muted-foreground hover:text-foreground transition-opacity ${
          hovered ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* 우측 화살표 */}
      <button
        onClick={() => nudge("right")}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 flex items-center justify-center rounded-full bg-background border border-border/50 shadow-sm text-muted-foreground hover:text-foreground transition-opacity ${
          hovered ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* 트랙 — CSS animation으로 무한 루프 */}
      <div
        ref={trackRef}
        className="flex gap-2 py-3 animate-ticker w-max"
      >
        {doubled.map((kw, i) => (
          <Link
            key={`${kw}-${i}`}
            href={`/keyword/discover?q=${encodeURIComponent(kw)}`}
            className="shrink-0 rounded-full border border-border/30 bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
          >
            {kw}
          </Link>
        ))}
      </div>
    </div>
  );
}

const quickStartCards = [
  {
    icon: Search,
    title: "키워드 탐색 시작하기",
    desc: "검색량·문서수·상업성을 AI가 분석해 수익화 가능성이 높은 키워드를 찾아드립니다",
    href: "/keyword/discover",
    color: "text-primary",
    bgColor: "bg-primary/5",
  },
  {
    icon: BarChart3,
    title: "상위 글 특징 분석 보기",
    desc: "상위 블로그 5개의 글자수·이미지수·구조를 분석해 공통 패턴을 발견합니다",
    href: "/blog/top-insights",
    color: "text-green-600",
    bgColor: "bg-green-500/5",
  },
  {
    icon: Link2,
    title: "내 글 URL 분석하기",
    desc: "내 블로그 글의 구조·키워드·이미지를 분석해 개선 포인트를 제안합니다",
    href: "/blog/url-analyzer",
    color: "text-violet-600",
    bgColor: "bg-violet-500/5",
    comingSoon: true,
  },
  {
    icon: FileText,
    title: "콘텐츠 아이디어 만들기",
    desc: "선정된 키워드로 돈 되는 제목 10개와 글 구조를 자동 생성합니다",
    href: "/keyword/ideas",
    color: "text-amber-600",
    bgColor: "bg-amber-500/5",
  },
];

export default function WorkspaceHome() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>(FALLBACK_KEYWORDS);
  const [showComingSoon, setShowComingSoon] = useState(false);

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

  const handleSearch = () => {
    if (keyword.trim()) {
      router.push(`/keyword/discover?q=${encodeURIComponent(keyword.trim())}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤드라인 */}
      <section className="text-center pt-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          돈이 되는 키워드, AI가 찾아드립니다
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          검색량·문서수·상업성·상위 블로그 분석까지 종합해 수익화 가능성을 점수로 제시합니다
        </p>
      </section>

      {/* 검색창 */}
      <section className="max-w-xl mx-auto mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <div className="rounded-2xl bg-background p-3 shadow-lg shadow-black/[0.04] border border-border/30">
          <div className="flex gap-2">
            <Input
              placeholder="어떤 키워드가 돈이 되는 키워드일까요?"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-12 text-base border-0 shadow-none focus-visible:ring-0"
            />
            <Button
              onClick={handleSearch}
              className="h-12 px-6 rounded-xl btn-analyze gap-2"
            >
              <Search className="h-4 w-4" />
              탐색
            </Button>
          </div>
        </div>
      </section>

      {/* 트렌딩 키워드 롤링 */}
      <section className="max-w-xl mx-auto mb-6 sm:mb-10 animate-in fade-in duration-500 delay-200">
        <div className="flex items-center gap-1.5 px-1 mb-1">
          <TrendingUp className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground/50">실시간 인기 키워드</span>
        </div>
        <TrendingTicker keywords={trendingKeywords} />
      </section>

      {/* 빠른 시작 카드 */}
      <section className="mb-8 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        <h2 className="text-lg font-semibold mb-4">빠른 시작</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickStartCards.map((card) =>
            card.comingSoon ? (
              <button
                key={card.href}
                type="button"
                onClick={() => setShowComingSoon(true)}
                className="group rounded-2xl border border-border/30 p-5 hover:border-border/60 hover:shadow-sm transition-all duration-200 text-left relative"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 rounded-xl p-2.5 ${card.bgColor}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      {card.title}
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                        준비중
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                </div>
              </button>
            ) : (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-2xl border border-border/30 p-5 hover:border-border/60 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 rounded-xl p-2.5 ${card.bgColor}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{card.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      {/* 블로그 분석 도구 */}
      <section className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-lg font-semibold">블로그 분석 도구</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: "상위 글 분석", desc: "상위 5개 글의 공통 패턴 발견", href: "/blog/top-insights" },
            { title: "내 글 비교", desc: "상위 글과 내 글의 차이점 분석", href: "/blog/compare", comingSoon: true },
            { title: "상위노출 가능성", desc: "내 글의 상위노출 점수 측정", href: "/blog/ranking-chance", comingSoon: true },
          ].map((item) =>
            item.comingSoon ? (
              <button
                key={item.href}
                type="button"
                onClick={() => setShowComingSoon(true)}
                className="rounded-xl border border-border/30 p-4 text-center hover:border-border/60 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium flex items-center justify-center gap-2">
                  {item.title}
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                    준비중
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-border/30 p-4 text-center hover:border-border/60 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </Link>
            )
          )}
        </div>
      </section>

      {/* 준비중 모달 */}
      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>준비 중인 기능입니다</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            현재 준비 중인 기능입니다. 빠른 시일 내에 제공할 예정이니 조금만 기다려주세요!
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
