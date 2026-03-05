import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { generateRelatedKeywords } from "@/lib/providers/relatedKeywords";
import { calculateFinalScore, filterKeywords } from "@/lib/scoring/moneyScore";
import { DiscoveryResponse, MoneyKeywordItem } from "@/types";
import { logEvent } from "@/lib/supabase/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: "키워드를 입력해주세요." },
        { status: 400 }
      );
    }

    const seed = keyword.trim();
    const volumeProvider = createVolumeProvider();
    const serpProvider = createSerpProvider();

    // 1: 네이버 광고 API → 연관키워드 + 검색량
    const volumeData = await volumeProvider.getVolume([seed]);

    let allKeywords: string[];
    if (volumeData.length >= 5) {
      allKeywords = volumeData.map((v) => v.keyword);
    } else {
      allKeywords = generateRelatedKeywords(seed);
    }

    // 최대 30개
    const keywordsToAnalyze = allKeywords.slice(0, 30);

    // 2: SERP 분석 (문서수)
    const serpData = await serpProvider.analyze(keywordsToAnalyze);

    // 3: 검색량 맵 구성
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));

    // 4: MoneyScore 계산
    const scored = keywordsToAnalyze
      .map((kw, i) => {
        const vol = volumeMap.get(kw);
        const serp = serpData[i];
        if (!vol || !serp) return null;

        const result = calculateFinalScore({
          keyword: kw,
          volume: vol.totalVolume,
          docs: serp.totalDocCount,
        });

        const item: MoneyKeywordItem = {
          keyword: kw,
          pcVolume: vol.pcVolume,
          mobileVolume: vol.mobileVolume,
          totalVolume: vol.totalVolume,
          totalDocCount: serp.totalDocCount,
          moneyScore: result.moneyScore,
          commercialWeight: result.commercialWeight,
          volumeWeight: result.volumeWeight,
          finalScore: result.finalScore,
          commercialTokens: result.commercialTokens,
        };

        return item;
      })
      .filter((item): item is MoneyKeywordItem => item !== null);

    // 5: 정렬 (MoneyScore 내림차순) — 필터링은 클라이언트에서 수행
    const sorted = scored
      .filter((item) => Math.log(item.totalDocCount + 1) > 0)
      .sort((a, b) => b.moneyScore - a.moneyScore);

    const response: DiscoveryResponse = {
      keywords: sorted,
      seed,
      analyzedAt: new Date().toISOString(),
    };

    logEvent("discovery", { keyword: seed, result_count: sorted.length });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json(
      { error: "탐색 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
