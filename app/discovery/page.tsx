"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/Stepper";
import { useUsageLimit } from "@/hooks/useUsageLimit";
import { DiscoveryResponse, MoneyKeywordItem, TrendingCategory } from "@/types";
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

  const { remaining, canUse, increment } = useUsageLimit();

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

      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw.trim() }),
        });

        if (!res.ok) {
          const err = await res.json();
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
    router.push(`/analysis?keyword=${encodeURIComponent(kw.keyword)}`);
  };

  const getSaturation = (item: MoneyKeywordItem) =>
    item.totalVolume > 0 ? item.totalDocCount / item.totalVolume : 999;

  // 클라이언트 사이드 필터 + 정렬
  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.keywords;
    if (minVolume > 0) {
      items = items.filter((item) => item.totalVolume >= minVolume);
    }
    if (maxDocs > 0) {
      items = items.filter((item) => item.totalDocCount <= maxDocs);
    }
    return [...items].sort((a, b) => {
      if (sortKey === "totalDocCount") return a[sortKey] - b[sortKey];
      if (sortKey === "saturation") return getSaturation(a) - getSaturation(b);
      return b[sortKey] - a[sortKey];
    });
  }, [data, minVolume, maxDocs, sortKey]);

  const totalCount = data?.keywords.length ?? 0;

  return (
    <main className="bg-background min-h-screen">
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

        {/* 결과 테이블 */}
        {data && !loading && (
          <section className="max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 헤더: 정렬 + 필터 */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-semibold">
                탐색 결과
                <span className="text-base font-normal text-muted-foreground ml-2">
                  {filtered.length}개
                  {filtered.length !== totalCount && (
                    <span className="text-xs"> / 전체 {totalCount}개</span>
                  )}
                </span>
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 필터 */}
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
                {/* 정렬 */}
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

            <p className="text-sm text-muted-foreground mb-4">
              키워드를 클릭하면 Step 2(키워드 확장)로 이동합니다.
            </p>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-border/30 p-8 text-center text-muted-foreground">
                필터 조건에 맞는 키워드가 없습니다. 필터를 조정해 보세요.
              </div>
            ) : (
              <div className="rounded-2xl overflow-x-auto border border-border/30 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>키워드</TableHead>
                      <TableHead className="text-right">PC</TableHead>
                      <TableHead className="text-right">모바일</TableHead>
                      <TableHead className="text-right">총검색량</TableHead>
                      <TableHead className="text-right">문서수</TableHead>
                      <TableHead className="text-right">포화도</TableHead>
                      <TableHead className="text-right">MoneyScore</TableHead>
                      <TableHead className="text-center">상업성</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item) => (
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
                        <TableCell className="text-right text-muted-foreground">
                          {item.pcVolume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.mobileVolume.toLocaleString()}
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
          </section>
        )}
      </div>
    </main>
  );
}
