"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/Stepper";
import { useUsageLimit } from "@/hooks/useUsageLimit";
import { DiscoveryResponse, MoneyKeywordItem, TrendingCategory, BlogReference } from "@/types";
import { ReviewProgramModal } from "@/components/ReviewProgramModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  TrendingUp,
  Loader2,
  ArrowUpDown,
  Flame,
  ArrowRight,
  Filter,
  ChevronDown,
  Crown,
  Star,
  RefreshCw,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Toaster, toast } from "sonner";

type SortKey = "moneyScore" | "totalVolume" | "totalDocCount" | "finalScore" | "saturation";

export default function DiscoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          로딩 중...
        </div>
      }
    >
      <DiscoveryContent />
    </Suspense>
  );
}

function DiscoveryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [keyword, setKeyword] = useState(initialQuery);
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("moneyScore");

  // 결과에 대한 클라이언트 사이드 필터
  const [minVolume, setMinVolume] = useState(0);
  const [maxDocs, setMaxDocs] = useState(0); // 0 = 필터 없음

  const [trendingCategories, setTrendingCategories] = useState<
    TrendingCategory[]
  >([]);

  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllAds, setShowAllAds] = useState(false);

  // 상위 블로그
  const [topBlogs, setTopBlogs] = useState<BlogReference[]>([]);
  const [blogsLoading, setBlogsLoading] = useState(false);
  const [blogKeyword, setBlogKeyword] = useState<string>("");

  // 추천 키워드 수동 변경
  const [overrideMain, setOverrideMain] = useState<MoneyKeywordItem | null>(null);
  const [overrideSubs, setOverrideSubs] = useState<MoneyKeywordItem[] | null>(null);
  const [changeTarget, setChangeTarget] = useState<"main" | number | null>(null); // null=닫힘, "main"=메인, 0~2=서브 인덱스

  const { remaining, canUse, increment } = useUsageLimit();
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    fetch("/api/trending")
      .then((res) => res.json())
      .then((d) => {
        if (d.categories && d.categories.length > 0) {
          setTrendingCategories(d.categories);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(
    async (searchKeyword?: string) => {
      const kw = searchKeyword || keyword;
      if (!kw.trim()) {
        toast.error("키워드를 입력해주세요.");
        return;
      }
      if (!canUse()) {
        toast.error(
          "일일 사용 한도를 초과했습니다. 내일 다시 시도해주세요."
        );
        return;
      }

      setLoading(true);
      setError(null);
      setData(null);
      setShowAllRelated(false);
      setShowAllAds(false);
      setOverrideMain(null);
      setOverrideSubs(null);
      setTopBlogs([]);
      setBlogKeyword("");

      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw.trim() }),
        });

        if (!res.ok) {
          const err = await res.json();
          if (res.status === 403 && err.error === "paywall") {
            setShowReviewModal(true);
            setLoading(false);
            return;
          }
          throw new Error(err.error || "탐색 실패");
        }

        const result: DiscoveryResponse = await res.json();
        setData(result);
        increment();
      } catch (e) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    },
    [keyword, canUse, increment]
  );

  useEffect(() => {
    if (initialQuery && !data && !loading) {
      handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeywordClick = (kw: MoneyKeywordItem) => {
    setKeyword(kw.keyword);
    handleSearch(kw.keyword);
  };

  const getSaturation = (item: MoneyKeywordItem) =>
    item.totalVolume > 0 ? item.totalDocCount / item.totalVolume : 999;

  const applyFilterSort = useCallback(
    (items: MoneyKeywordItem[]) => {
      let filtered = items;
      if (minVolume > 0) {
        filtered = filtered.filter((item) => item.totalVolume >= minVolume);
      }
      if (maxDocs > 0) {
        filtered = filtered.filter((item) => item.totalDocCount <= maxDocs);
      }
      return [...filtered].sort((a, b) => {
        if (sortKey === "totalDocCount") return a[sortKey] - b[sortKey];
        if (sortKey === "saturation") return getSaturation(a) - getSaturation(b);
        return b[sortKey] - a[sortKey];
      });
    },
    [minVolume, maxDocs, sortKey]
  );

  // 클라이언트 사이드 필터 + 정렬
  const filteredAds = useMemo(() => {
    if (!data) return [];
    return applyFilterSort(data.keywords);
  }, [data, applyFilterSort]);

  const filteredRelated = useMemo(() => {
    if (!data) return [];
    return applyFilterSort(data.relatedKeywords ?? []);
  }, [data, applyFilterSort]);

  const totalAdsCount = data?.keywords.length ?? 0;
  const totalRelatedCount = data?.relatedKeywords?.length ?? 0;

  // 메인/서브 키워드 추천
  const recommended = useMemo(() => {
    if (!data) return null;
    const all = [...filteredAds, ...filteredRelated];
    // 중복 제거 (keyword 기준, 먼저 나온 것 우선)
    const seen = new Set<string>();
    const unique = all.filter((item) => {
      if (seen.has(item.keyword)) return false;
      seen.add(item.keyword);
      return true;
    });
    if (unique.length === 0) return null;

    const sorted = [...unique].sort((a, b) => b.finalScore - a.finalScore);
    const main = sorted[0];
    const rest = sorted.slice(1);
    const mainTokens = main.keyword.split(/\s+/).filter((t) => t.length > 0);

    // 1순위: 메인 키워드 토큰이 포함된 연관 키워드
    const related = rest.filter((c) =>
      mainTokens.some((token) => c.keyword.includes(token))
    );
    // 2순위: 토큰 겹침 없어도 FinalScore 상위 키워드
    const others = rest.filter(
      (c) => !mainTokens.some((token) => c.keyword.includes(token))
    );
    const subs = [...related, ...others].slice(0, 3);
    return { main, subs };
  }, [data, filteredAds, filteredRelated]);

  // 실제 표시될 메인/서브 (오버라이드 우선)
  const displayMain = overrideMain ?? recommended?.main ?? null;
  const displaySubs = overrideSubs ?? recommended?.subs ?? [];

  // 선택 다이얼로그용 전체 키워드 목록 (중복 제거, FinalScore순)
  const allCandidates = useMemo(() => {
    const all = [...filteredAds, ...filteredRelated];
    const seen = new Set<string>();
    return all
      .filter((item) => {
        if (seen.has(item.keyword)) return false;
        seen.add(item.keyword);
        return true;
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }, [filteredAds, filteredRelated]);

  const handleSelectKeyword = (item: MoneyKeywordItem) => {
    if (changeTarget === "main") {
      setOverrideMain(item);
      // 서브에서 새 메인과 같은 키워드 제거
      const currentSubs = overrideSubs ?? recommended?.subs ?? [];
      if (currentSubs.some((s) => s.keyword === item.keyword)) {
        setOverrideSubs(currentSubs.filter((s) => s.keyword !== item.keyword));
      }
    } else if (typeof changeTarget === "number") {
      const currentSubs = [...(overrideSubs ?? recommended?.subs ?? [])];
      // 이미 메인이거나 다른 서브에 있으면 교체
      const mainKw = (overrideMain ?? recommended?.main)?.keyword;
      if (item.keyword === mainKw) {
        setChangeTarget(null);
        return;
      }
      const existIdx = currentSubs.findIndex((s) => s.keyword === item.keyword);
      if (existIdx !== -1 && existIdx !== changeTarget) {
        // 이미 다른 서브 슬롯에 있으면 스왑
        currentSubs[existIdx] = currentSubs[changeTarget];
      }
      currentSubs[changeTarget] = item;
      setOverrideSubs(currentSubs);
    }
    setChangeTarget(null);
  };

  // displayMain 변경 시 상위 블로그 가져오기
  useEffect(() => {
    if (!displayMain || displayMain.keyword === blogKeyword) return;
    setBlogsLoading(true);
    setBlogKeyword(displayMain.keyword);
    fetch("/api/blog/top-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: displayMain.keyword }),
    })
      .then((res) => res.json())
      .then((d) => setTopBlogs(d.blogs || []))
      .catch(() => setTopBlogs([]))
      .finally(() => setBlogsLoading(false));
  }, [displayMain, blogKeyword]);

  return (
    <main className="bg-background min-h-screen">
      <ReviewProgramModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        source="discovery"
      />
      <Toaster richColors />
      <div className="container mx-auto px-4">
        <Stepper currentStep={1} />

        {/* 검색 영역 */}
        <section className="max-w-2xl mx-auto mb-8">
          <h1 className="text-2xl font-bold text-center mb-6">키워드 탐색</h1>
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
                onClick={() => handleSearch()}
                disabled={loading}
                className="h-12 px-6 rounded-xl btn-analyze gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 탐색중
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    탐색
                    <span className="text-xs opacity-70">
                      {remaining}/5
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* 인기 키워드 - 주제별 섹션 */}
        {!data && !loading && trendingCategories.length > 0 && (
          <section className="max-w-4xl mx-auto mb-12 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-6">
              <Flame className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold">주제별 인기 키워드</h2>
              <Badge
                variant="outline"
                className="text-xs bg-orange-50 text-orange-700 border-orange-200"
              >
                DataLab
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              클릭만으로 탐색을 시작하세요. 실시간 주제별 인기 검색어입니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {trendingCategories.map((cat) => (
                <div
                  key={cat.name}
                  className="rounded-2xl border border-border/30 p-4 bg-background shadow-sm"
                >
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                    {cat.name}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {cat.keywords.map((kw, i) => (
                      <button
                        key={kw}
                        onClick={() => {
                          setKeyword(kw);
                          handleSearch(kw);
                        }}
                        className="text-left rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-all duration-200 flex items-center gap-2"
                      >
                        <span className="text-xs font-bold text-muted-foreground/50 w-4">
                          {i + 1}
                        </span>
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 로딩 */}
        {loading && (
          <section className="max-w-4xl mx-auto pb-8">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </section>
        )}

        {/* 에러 */}
        {error && (
          <section className="max-w-4xl mx-auto pb-8">
            <div className="rounded-2xl bg-destructive/10 p-4 text-center text-destructive">
              {error}
            </div>
          </section>
        )}

        {/* 결과 영역 */}
        {data && !loading && (
          <section className="mx-auto pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 공통 필터/정렬 */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3 max-w-7xl mx-auto">
              <h2 className="text-xl font-semibold">탐색 결과</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select
                    value={String(minVolume)}
                    onValueChange={(v) => setMinVolume(Number(v))}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="최소 검색량" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">검색량 전체</SelectItem>
                      <SelectItem value="100">100 이상</SelectItem>
                      <SelectItem value="300">300 이상</SelectItem>
                      <SelectItem value="500">500 이상</SelectItem>
                      <SelectItem value="1000">1,000 이상</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(maxDocs)}
                    onValueChange={(v) => setMaxDocs(Number(v))}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="최대 문서수" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">문서수 전체</SelectItem>
                      <SelectItem value="10000">10,000 이하</SelectItem>
                      <SelectItem value="30000">30,000 이하</SelectItem>
                      <SelectItem value="50000">50,000 이하</SelectItem>
                      <SelectItem value="100000">100,000 이하</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select
                  value={sortKey}
                  onValueChange={(v) => setSortKey(v as SortKey)}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moneyScore">MoneyScore순</SelectItem>
                    <SelectItem value="finalScore">FinalScore순</SelectItem>
                    <SelectItem value="totalVolume">검색량순</SelectItem>
                    <SelectItem value="totalDocCount">문서수순</SelectItem>
                    <SelectItem value="saturation">포화도순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4 max-w-7xl mx-auto">
              키워드를 클릭하면 해당 키워드로 재탐색을 진행합니다.
            </p>

            {/* 2열 구조 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
              {/* 좌측: 네이버 연관검색어 */}
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-green-600" />
                  네이버 연관검색어
                  <span className="text-sm font-normal text-muted-foreground">
                    {filteredRelated.length}개
                    {filteredRelated.length !== totalRelatedCount && (
                      <span className="text-xs"> / 전체 {totalRelatedCount}개</span>
                    )}
                  </span>
                </h3>
                {filteredRelated.length === 0 ? (
                  <div className="rounded-2xl border border-border/30 p-8 text-center text-muted-foreground">
                    연관검색어 결과가 없습니다.
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-x-auto border border-border/30 shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>키워드</TableHead>
                          <TableHead className="text-right">총검색량</TableHead>
                          <TableHead className="text-right">문서수</TableHead>
                          <TableHead className="text-right">포화도</TableHead>
                          <TableHead className="text-right">MoneyScore</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(showAllRelated ? filteredRelated : filteredRelated.slice(0, 10)).map((item) => (
                          <TableRow
                            key={item.keyword}
                            className="cursor-pointer hover:bg-primary/5 transition-colors"
                            onClick={() => handleKeywordClick(item)}
                          >
                            <TableCell className="font-medium whitespace-nowrap">
                              {item.keyword}
                              {item.commercialTokens.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  {item.commercialTokens.join(" ")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.totalVolume.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.totalDocCount > 0
                                ? item.totalDocCount.toLocaleString()
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.totalDocCount > 0 && item.totalVolume > 0 ? (
                                <span
                                  className={
                                    getSaturation(item) < 5
                                      ? "text-green-600 font-medium"
                                      : getSaturation(item) > 50
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {getSaturation(item).toFixed(1)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className="money-score-gold"
                                data-tier={
                                  item.moneyScore >= 1.2
                                    ? "jackpot"
                                    : item.moneyScore >= 1.0
                                      ? "great"
                                      : item.moneyScore >= 0.8
                                        ? "good"
                                        : "normal"
                                }
                              >
                                {item.moneyScore.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredRelated.length > 10 && !showAllRelated && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => setShowAllRelated(true)}
                  >
                    <ChevronDown className="h-4 w-4" />
                    더보기 ({filteredRelated.length - 10}개 더)
                  </Button>
                )}
              </div>

              {/* 우측: 네이버 광고 API 기반 */}
              <div>
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  AI 기반 탐색
                  <span className="text-sm font-normal text-muted-foreground">
                    {filteredAds.length}개
                    {filteredAds.length !== totalAdsCount && (
                      <span className="text-xs"> / 전체 {totalAdsCount}개</span>
                    )}
                  </span>
                </h3>
                {filteredAds.length === 0 ? (
                  <div className="rounded-2xl border border-border/30 p-8 text-center text-muted-foreground">
                    필터 조건에 맞는 키워드가 없습니다.
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-x-auto border border-border/30 shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>키워드</TableHead>
                          <TableHead className="text-right">총검색량</TableHead>
                          <TableHead className="text-right">문서수</TableHead>
                          <TableHead className="text-right">포화도</TableHead>
                          <TableHead className="text-right">MoneyScore</TableHead>
                          <TableHead className="text-center">상업성</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(showAllAds ? filteredAds : filteredAds.slice(0, 10)).map((item) => (
                          <TableRow
                            key={item.keyword}
                            className="cursor-pointer hover:bg-primary/5 transition-colors"
                            onClick={() => handleKeywordClick(item)}
                          >
                            <TableCell className="font-medium whitespace-nowrap">
                              {item.keyword}
                              {item.commercialTokens.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  {item.commercialTokens.join(" ")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.totalVolume.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.totalDocCount > 0
                                ? item.totalDocCount.toLocaleString()
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.totalDocCount > 0 && item.totalVolume > 0 ? (
                                <span
                                  className={
                                    getSaturation(item) < 5
                                      ? "text-green-600 font-medium"
                                      : getSaturation(item) > 50
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {getSaturation(item).toFixed(1)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className="money-score-gold"
                                data-tier={
                                  item.moneyScore >= 1.2
                                    ? "jackpot"
                                    : item.moneyScore >= 1.0
                                      ? "great"
                                      : item.moneyScore >= 0.8
                                        ? "good"
                                        : "normal"
                                }
                              >
                                {item.moneyScore.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.commercialWeight > 1 ? (
                                <Badge className="bg-amber-500 text-white text-xs">
                                  x{item.commercialWeight}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredAds.length > 10 && !showAllAds && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2 text-sm text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => setShowAllAds(true)}
                  >
                    <ChevronDown className="h-4 w-4" />
                    더보기 ({filteredAds.length - 10}개 더)
                  </Button>
                )}
              </div>
            </div>

            {/* 메인/서브 키워드 추천 */}
            {recommended && displayMain && (
              <>
                <div className="max-w-7xl mx-auto my-8">
                  <hr className="border-border/40" />
                </div>
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    추천 키워드 조합
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    위 탐색 결과를 기반으로 FinalScore가 높은 키워드를 메인/서브로 추천합니다.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 메인 키워드 */}
                    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">메인 키워드</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => setChangeTarget("main")}
                        >
                          <RefreshCw className="h-3 w-3" />
                          변경
                        </Button>
                      </div>
                      <p className="text-xl font-bold mb-4">{displayMain.keyword}</p>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground block text-xs">총검색량</span>
                          <span className="font-semibold">{displayMain.totalVolume.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">문서수</span>
                          <span className="font-semibold">{displayMain.totalDocCount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">MoneyScore</span>
                          <span
                            className="font-semibold money-score-gold"
                            data-tier={
                              displayMain.moneyScore >= 1.2 ? "jackpot"
                                : displayMain.moneyScore >= 1.0 ? "great"
                                : displayMain.moneyScore >= 0.8 ? "good"
                                : "normal"
                            }
                          >
                            {displayMain.moneyScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {displayMain.commercialTokens.length > 0 && (
                        <div className="mt-3">
                          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                            {displayMain.commercialTokens.join(" ")}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* 서브 키워드 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">서브 키워드</span>
                        <span className="text-xs text-muted-foreground">함께 쓰면 좋은 키워드</span>
                      </div>
                      {displaySubs.length === 0 ? (
                        <div className="rounded-xl border border-border/30 p-4 text-sm text-muted-foreground text-center">
                          적합한 서브 키워드를 찾지 못했습니다.
                        </div>
                      ) : (
                        displaySubs.map((sub, idx) => (
                          <div
                            key={sub.keyword}
                            className="rounded-xl border border-border/30 bg-background p-4"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{sub.keyword}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                onClick={() => setChangeTarget(idx)}
                              >
                                <RefreshCw className="h-3 w-3" />
                                변경
                              </Button>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>검색량 <strong className="text-foreground">{sub.totalVolume.toLocaleString()}</strong></span>
                              <span>문서수 <strong className="text-foreground">{sub.totalDocCount.toLocaleString()}</strong></span>
                              <span>MoneyScore{" "}
                                <strong
                                  className="money-score-gold"
                                  data-tier={
                                    sub.moneyScore >= 1.2 ? "jackpot"
                                      : sub.moneyScore >= 1.0 ? "great"
                                      : sub.moneyScore >= 0.8 ? "good"
                                      : "normal"
                                  }
                                >
                                  {sub.moneyScore.toFixed(2)}
                                </strong>
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 콘텐츠 아이디어 CTA */}
                  <div className="mt-6 flex justify-center">
                    <Button
                      className="gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:text-blue-800 shadow-none"
                      onClick={() => {
                        const base = pathname.startsWith("/keyword/") ? "/keyword/ideas" : "/production";
                        const subParams = displaySubs.map((s) => s.keyword).join(",");
                        router.push(
                          `${base}?main=${encodeURIComponent(displayMain?.keyword ?? "")}&subs=${encodeURIComponent(subParams)}`
                        );
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                      이 키워드로 콘텐츠 아이디어 뽑으러 가기
                    </Button>
                  </div>
                </div>

                {/* 키워드 변경 다이얼로그 */}
                <Dialog open={changeTarget !== null} onOpenChange={(open) => !open && setChangeTarget(null)}>
                  <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>
                        {changeTarget === "main" ? "메인 키워드 변경" : "서브 키워드 변경"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto -mx-6 px-6">
                      <div className="space-y-1">
                        {allCandidates.map((item) => {
                          const isCurrentMain = item.keyword === displayMain?.keyword;
                          const isCurrentSub = displaySubs.some((s) => s.keyword === item.keyword);
                          const isCurrent =
                            (changeTarget === "main" && isCurrentMain) ||
                            (typeof changeTarget === "number" && displaySubs[changeTarget]?.keyword === item.keyword);

                          return (
                            <button
                              key={item.keyword}
                              className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                                isCurrent
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : isCurrentMain || isCurrentSub
                                    ? "text-muted-foreground hover:bg-muted/50"
                                    : "hover:bg-muted"
                              }`}
                              onClick={() => handleSelectKeyword(item)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{item.keyword}</span>
                                {isCurrentMain && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">메인</Badge>
                                )}
                                {isCurrentSub && !isCurrentMain && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">서브</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                <span>{item.totalVolume.toLocaleString()}</span>
                                <span
                                  className="money-score-gold"
                                  data-tier={
                                    item.moneyScore >= 1.2 ? "jackpot"
                                      : item.moneyScore >= 1.0 ? "great"
                                      : item.moneyScore >= 0.8 ? "good"
                                      : "normal"
                                  }
                                >
                                  {item.moneyScore.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* 상위 블로그 글 */}
            {displayMain && (
              <>
                <div className="max-w-7xl mx-auto my-8">
                  <hr className="border-border/40" />
                </div>
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    상위 블로그 포스팅 예시
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    <strong>&quot;{displayMain.keyword}&quot;</strong> 검색 시 상위에 노출되는 블로그 글 5개입니다.
                  </p>

                  {blogsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : topBlogs.length === 0 ? (
                    <div className="rounded-2xl border border-border/30 p-8 text-center text-muted-foreground">
                      상위 블로그 글을 찾지 못했습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topBlogs.map((blog, i) => (
                        <a
                          key={i}
                          href={blog.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl border border-border/30 bg-background p-4 hover:bg-muted/50 hover:border-primary/30 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                                {blog.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {blog.description}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{blog.bloggerName}</span>
                                {blog.postDate && <span>{blog.postDate}</span>}
                              </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 상위 글 분석 CTA */}
                  {topBlogs.length > 0 && (
                    <div className="mt-6 flex justify-center">
                      <Button
                        variant="outline"
                        className="gap-2 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-400 transition-all"
                        onClick={() => {
                          const base = pathname.startsWith("/keyword/") ? "/blog/top-insights" : "/blog/top-insights";
                          router.push(`${base}?keyword=${encodeURIComponent(displayMain?.keyword ?? "")}`);
                        }}
                      >
                        <Search className="h-4 w-4" />
                        상위 글 분석하러 가기
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
