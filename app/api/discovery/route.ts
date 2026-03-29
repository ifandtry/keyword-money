import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { generateRelatedKeywords } from "@/lib/providers/relatedKeywords";
import { calculateFinalScore, getCommercialWeight } from "@/lib/scoring/moneyScore";
import {
  DiscoveryRelatedKeywordItem,
  DiscoveryRelatedKeywordsDebug,
  DiscoveryResponse,
  MoneyKeywordItem,
} from "@/types";
import { logEvent } from "@/lib/supabase/logger";
import { createClient } from "@/lib/supabase/server";
import {
  GUEST_DISCOVERY_COOKIE,
  checkAndIncrementGuestDiscoveryUsage,
  checkAndIncrementUsage,
} from "@/lib/usage";

// 네이버 자동완성 연관검색어
async function fetchAutoComplete(keyword: string): Promise<string[]> {
  try {
    const seed = keyword.trim();
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(seed)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`,
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
      .map((item) => String(item[0] || "").trim())
      .filter((kw) => kw !== seed && kw.length > 1);
  } catch {
    return [];
  }
}

type VolumeLookupItem = {
  keyword: string;
  pcVolume: number;
  mobileVolume: number;
  totalVolume: number;
  cpc: number;
};

type SerpLookupItem = {
  totalDocCount: number;
};

function normalizeKeywordForMatch(keyword: string): string {
  return keyword.trim();
}

function normalizeKeywordWithoutSpaces(keyword: string): string {
  return keyword.replace(/\s+/g, "").trim();
}

function uniqueKeywordsByTrim(keywords: string[]): string[] {
  const seen = new Set<string>();

  return keywords.filter((keyword) => {
    const normalizedKeyword = normalizeKeywordForMatch(keyword);
    if (!normalizedKeyword || seen.has(normalizedKeyword)) return false;
    seen.add(normalizedKeyword);
    return true;
  });
}

function buildScoredItems(
  keywords: string[],
  volumeMap: Map<string, VolumeLookupItem>,
  serpMap: Map<string, SerpLookupItem>
): MoneyKeywordItem[] {
  return keywords
    .map((kw) => {
      const normalizedKeyword = normalizeKeywordForMatch(kw);
      const vol = volumeMap.get(normalizedKeyword);
      const serp = serpMap.get(normalizedKeyword);
      if (!vol || !serp || serp.totalDocCount <= 0) return null;

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
    .sort((a, b) => b.moneyScore - a.moneyScore);
}

function buildRelatedKeywordItems(
  keywords: string[],
  volumeMap: Map<string, VolumeLookupItem>,
  serpMap: Map<string, SerpLookupItem>
): DiscoveryRelatedKeywordItem[] {
  return keywords.map((keyword) => {
    const normalizedKeyword = normalizeKeywordForMatch(keyword);
    const volume = volumeMap.get(normalizedKeyword);
    const serp = serpMap.get(normalizedKeyword);
    const hasVolumeData = !!volume;
    const hasSerpData = !!serp && serp.totalDocCount > 0;
    const { weight: commercialWeight, tokens: commercialTokens } =
      getCommercialWeight(keyword);

    const item: DiscoveryRelatedKeywordItem = {
      keyword,
      pcVolume: volume?.pcVolume ?? null,
      mobileVolume: volume?.mobileVolume ?? null,
      totalVolume: volume?.totalVolume ?? null,
      totalDocCount: hasSerpData ? serp.totalDocCount : null,
      moneyScore: null,
      commercialWeight,
      volumeWeight: volume ? Number(Math.log(volume.totalVolume + 1).toFixed(4)) : null,
      finalScore: null,
      commercialTokens,
      hasVolumeData,
      hasSerpData,
    };

    if (!hasVolumeData && !hasSerpData) {
      item.debugReason = "missing_volume_and_serp_data";
      return item;
    }

    if (!hasVolumeData) {
      item.debugReason = "missing_volume_data";
      item.volumeWeight = null;
      return item;
    }

    if (!hasSerpData) {
      item.debugReason = "missing_serp_data";
      return item;
    }

    const result = calculateFinalScore({
      keyword,
      volume: volume.totalVolume,
      docs: serp.totalDocCount,
    });

    item.moneyScore = result.moneyScore;
    item.commercialWeight = result.commercialWeight;
    item.volumeWeight = result.volumeWeight;
    item.finalScore = result.finalScore;
    item.commercialTokens = result.commercialTokens;

    return item;
  });
}

function buildRelatedKeywordsDebug(
  items: DiscoveryRelatedKeywordItem[]
): DiscoveryRelatedKeywordsDebug {
  return {
    sourceCount: items.length,
    volumeMappedCount: items.filter((item) => item.hasVolumeData).length,
    serpAnalyzedCount: items.filter((item) => item.hasSerpData).length,
    scoredCount: items.filter((item) => item.moneyScore !== null && item.moneyScore !== undefined).length,
    missingVolumeKeywords: items
      .filter(
        (item) =>
          item.debugReason === "missing_volume_data" ||
          item.debugReason === "missing_volume_and_serp_data"
      )
      .map((item) => item.keyword),
    missingSerpKeywords: items
      .filter(
        (item) =>
          item.debugReason === "missing_serp_data" ||
          item.debugReason === "missing_volume_and_serp_data"
      )
      .map((item) => item.keyword),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword } = body;
    let guestUsage: ReturnType<typeof checkAndIncrementGuestDiscoveryUsage> | null = null;

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
    } else {
      guestUsage = checkAndIncrementGuestDiscoveryUsage(
        request.cookies.get(GUEST_DISCOVERY_COOKIE)?.value
      );

      if (!guestUsage.allowed) {
        const response = NextResponse.json(
          {
            error: "guest_limit",
            plan: guestUsage.plan,
            limit: guestUsage.limit,
            used: guestUsage.used,
          },
          { status: 403 }
        );

        response.cookies.set(GUEST_DISCOVERY_COOKIE, guestUsage.cookieValue, {
          path: "/",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
        });

        return response;
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
    const autoCompleteKeywordSet = new Set(
      acKeywords.map((kw) => normalizeKeywordForMatch(kw)).filter(Boolean)
    );

    adsKeywords = uniqueKeywordsByTrim(adsKeywords)
      .filter((kw) => !autoCompleteKeywordSet.has(normalizeKeywordForMatch(kw)))
      .slice(0, 30);

    // 자동완성/AI 탐색 키워드의 검색량 맵 구성
    const volumeMap = new Map(
      volumeData.map((v) => [normalizeKeywordForMatch(v.keyword), v])
    );

    const acOnly = uniqueKeywordsByTrim(acKeywords).filter(
      (kw) => !volumeMap.has(normalizeKeywordForMatch(kw))
    );
    const adsOnly = adsKeywords.filter(
      (kw) => !volumeMap.has(normalizeKeywordForMatch(kw))
    );

    // 자동완성 키워드는 공백 제거 버전으로만 검색량 조회 후 원문 키워드에 매핑
    const autoCompleteLookupMap = new Map<string, string[]>();
    for (const keyword of acOnly) {
      const lookupKeyword = normalizeKeywordWithoutSpaces(keyword);
      if (!lookupKeyword) continue;

      const mappedKeywords = autoCompleteLookupMap.get(lookupKeyword) ?? [];
      mappedKeywords.push(keyword);
      autoCompleteLookupMap.set(lookupKeyword, mappedKeywords);
    }

    const autoCompleteLookupKeywords = Array.from(autoCompleteLookupMap.keys());
    for (let i = 0; i < autoCompleteLookupKeywords.length; i += 10) {
      const batch = autoCompleteLookupKeywords.slice(i, i + 10);
      const exactVolumes = await volumeProvider.getExactVolumes(batch);

      for (const volume of exactVolumes) {
        const lookupKeyword = normalizeKeywordWithoutSpaces(volume.keyword);
        const originalKeywords = autoCompleteLookupMap.get(lookupKeyword) ?? [];

        for (const originalKeyword of originalKeywords) {
          const normalizedOriginalKeyword = normalizeKeywordForMatch(originalKeyword);
          if (!volumeMap.has(normalizedOriginalKeyword)) {
            volumeMap.set(normalizedOriginalKeyword, {
              ...volume,
              keyword: originalKeyword,
            });
          }
        }
      }
    }

    // AI 탐색 키워드는 기존 exact 검색량 조회 유지
    for (let i = 0; i < adsOnly.length; i += 10) {
      const batch = adsOnly.slice(i, i + 10);
      const exactVolumes = await volumeProvider.getExactVolumes(batch);

      for (const volume of exactVolumes) {
        const normalizedKeyword = normalizeKeywordForMatch(volume.keyword);
        if (!volumeMap.has(normalizedKeyword)) {
          volumeMap.set(normalizedKeyword, volume);
        }
      }
    }

    // 분석 대상 키워드 합치기 (SERP 한번에 조회)
    const allKeywords = uniqueKeywordsByTrim([...adsKeywords, ...acKeywords]);

    // 2: SERP 분석 (문서수)
    const serpData = await serpProvider.analyze(allKeywords);
    const serpMap = new Map(
      serpData.map((item) => [normalizeKeywordForMatch(item.keyword), item])
    );

    // 3: 각각 스코어링
    const adsScored = buildScoredItems(adsKeywords, volumeMap, serpMap);
    const relatedKeywords = buildRelatedKeywordItems(acKeywords, volumeMap, serpMap);
    const relatedKeywordsDebug = buildRelatedKeywordsDebug(relatedKeywords);

    const response: DiscoveryResponse = {
      keywords: adsScored,
      relatedKeywords,
      relatedKeywordsDebug,
      seed,
      analyzedAt: new Date().toISOString(),
    };

    logEvent(
      "discovery",
      { keyword: seed, result_count: adsScored.length + relatedKeywords.length },
      user?.id
    );

    const jsonResponse = NextResponse.json(response);

    if (guestUsage) {
      jsonResponse.cookies.set(GUEST_DISCOVERY_COOKIE, guestUsage.cookieValue, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return jsonResponse;
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json(
      { error: "탐색 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
