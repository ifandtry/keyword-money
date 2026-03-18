import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { generateRelatedKeywords } from "@/lib/providers/relatedKeywords";
import { calculateFinalScore } from "@/lib/scoring/moneyScore";
import { DiscoveryResponse, MoneyKeywordItem } from "@/types";
import { logEvent } from "@/lib/supabase/logger";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementUsage } from "@/lib/usage";

// 네이버 자동완성 연관검색어
async function fetchAutoComplete(keyword: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: string[][] = data.items?.[0] || [];
    return items
      .map((item) => item[0])
      .filter((kw) => kw !== keyword && kw.length > 1);
  } catch {
    return [];
  }
}

function buildScoredItems(
  keywords: string[],
  volumeMap: Map<string, { keyword: string; pcVolume: number; mobileVolume: number; totalVolume: number; cpc: number }>,
  serpMap: Map<string, { totalDocCount: number }>
): MoneyKeywordItem[] {
  return keywords
    .map((kw) => {
      const vol = volumeMap.get(kw);
      const serp = serpMap.get(kw);
      if (!vol || !serp) return null;

      const result = calculateFinalScore({
        keyword: kw,
        volume: vol.totalVolume,
        docs: serp.totalDocCount,
      });

      return {
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
      } as MoneyKeywordItem;
    })
    .filter((item): item is MoneyKeywordItem => item !== null)
    .filter((item) => Math.log(item.totalDocCount + 1) > 0)
    .sort((a, b) => b.moneyScore - a.moneyScore);
}

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

    // 사용량 제한 체크
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const usage = await checkAndIncrementUsage(user.id, "discovery");
        if (!usage.allowed) {
          return NextResponse.json(
            { error: "paywall", plan: usage.plan, limit: usage.limit, used: usage.used },
            { status: 403 }
          );
        }
      } catch {
        // usage 체크 실패 시 통과 허용
      }
    }

    const seed = keyword.trim();
    const volumeProvider = createVolumeProvider();
    const serpProvider = createSerpProvider();

    // 1: 네이버 자동완성 + 광고 API 동시 호출
    const [acKeywords, volumeData] = await Promise.all([
      fetchAutoComplete(seed),
      volumeProvider.getVolume([seed]),
    ]);

    // 광고 API 기반 키워드
    let adsKeywords: string[];
    if (volumeData.length >= 5) {
      adsKeywords = volumeData.map((v) => v.keyword);
    } else {
      adsKeywords = generateRelatedKeywords(seed);
    }
    adsKeywords = adsKeywords.slice(0, 30);

    // 연관검색어 중 광고 API에 없는 것만 추려서 검색량 보강
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));
    const acOnly = acKeywords.filter((kw) => !volumeMap.has(kw));

    // 누락된 자동완성 키워드를 5개씩 배치로 검색량 조회
    for (let i = 0; i < acOnly.length; i += 5) {
      const batch = acOnly.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map((kw) => volumeProvider.getVolume([kw]))
      );
      for (const results of batchResults) {
        for (const v of results) {
          if (!volumeMap.has(v.keyword)) volumeMap.set(v.keyword, v);
        }
      }
    }

    // 분석 대상 키워드 합치기 (SERP 한번에 조회)
    const allKeywordsSet = new Set([...adsKeywords, ...acKeywords]);
    const allKeywords = Array.from(allKeywordsSet);

    // 2: SERP 분석 (문서수)
    const serpData = await serpProvider.analyze(allKeywords);
    const serpMap = new Map(serpData.map((s, i) => [allKeywords[i], s]));

    // 3: 각각 스코어링
    const adsScored = buildScoredItems(adsKeywords, volumeMap, serpMap);
    const acScored = buildScoredItems(
      acKeywords.filter((kw) => volumeMap.has(kw)),
      volumeMap,
      serpMap
    );

    const response: DiscoveryResponse = {
      keywords: adsScored,
      relatedKeywords: acScored,
      seed,
      analyzedAt: new Date().toISOString(),
    };

    logEvent("discovery", { keyword: seed, result_count: adsScored.length + acScored.length }, user?.id);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json(
      { error: "탐색 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
