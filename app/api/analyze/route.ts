import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { generateRelatedKeywords } from "@/lib/providers/relatedKeywords";
import { calculateProfitScore } from "@/lib/scoring/profitScore";
import { AnalyzeResponse, KeywordItem } from "@/types";
import { createApiRequestId } from "@/lib/supabase/apiUsageLogger";
import { logEvent } from "@/lib/supabase/logger";
import { createClient } from "@/lib/supabase/server";

// 네이버 자동완성 연관검색어 가져오기
async function fetchAutoComplete(keyword: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const requestId = createApiRequestId();
    const usageContext = {
      feature: "analysis",
      requestId,
      userId: user?.id,
    };

    const seed = keyword.trim();

    const volumeProvider = createVolumeProvider(usageContext);
    const serpProvider = createSerpProvider(usageContext);

    // 1단계: 네이버 광고 API에 시드 키워드 전달 → 연관키워드 + 검색량 한번에 수신
    const volumeData = await volumeProvider.getVolume([seed]);

    let allKeywords: string[];

    if (volumeData.length >= 5) {
      allKeywords = volumeData.map((v) => v.keyword);
      console.log(
        `[Analyze] Naver API returned ${allKeywords.length} keywords`
      );
    } else {
      allKeywords = generateRelatedKeywords(seed);
      console.log("[Analyze] Using pattern-generated keywords (fallback)");
    }

    // 시드 키워드 찾기 (공백 제거 후 비교)
    const seedNorm = seed.replace(/\s+/g, "");
    const seedKeyword = allKeywords.find(
      (kw) => kw === seed || kw.replace(/\s+/g, "") === seedNorm
    ) || seed;

    // 연관 키워드: 시드 제외 최대 30개
    const relatedKeywords = allKeywords
      .filter((kw) => kw !== seedKeyword)
      .slice(0, 30);

    // 시드 + 연관 합쳐서 분석
    const keywordsToAnalyze = [seedKeyword, ...relatedKeywords];

    // 2단계: SERP 분석 (총문서수 등)
    const serpData = await serpProvider.analyze(keywordsToAnalyze);

    // 3단계: 검색량 데이터 매핑
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));

    // 4단계: 점수 계산
    const allItems = keywordsToAnalyze
      .map((kw, i) => {
        const vol = volumeMap.get(kw) || {
          keyword: kw,
          pcVolume: 0,
          mobileVolume: 0,
          totalVolume: 0,
          cpc: 0,
        };
        const serp = serpData[i];
        if (!serp) return null;
        return calculateProfitScore(vol, serp);
      })
      .filter((item) => item !== null);

    // 시드 키워드는 첫 번째, 연관 키워드는 수익점수 내림차순
    const seedItem = allItems[0];
    const relatedItems = allItems.slice(1).sort((a, b) => b.profitScore - a.profitScore);

    // 5단계: 네이버 자동완성 연관검색어 가져오기 + 분석
    const acKeywords = await fetchAutoComplete(seed);
    console.log(`[Analyze] Autocomplete: ${acKeywords.join(", ")}`);

    let autoCompleteKeywords: KeywordItem[] = [];
    if (acKeywords.length > 0) {
      const analyzedMap = new Map(allItems.map((item) => [item.keyword, item]));
      const needAnalysis = acKeywords.filter((kw) => !analyzedMap.has(kw));

      const acAnalyzedMap = new Map<string, KeywordItem>();

      if (needAnalysis.length > 0) {
        const acVolumeData = await volumeProvider.getVolume([needAnalysis[0]]);
        const acVolumeMap = new Map(acVolumeData.map((v) => [v.keyword, v]));
        const acToSerp = needAnalysis.filter((kw) => acVolumeMap.has(kw));
        if (acToSerp.length > 0) {
          const acSerpData = await serpProvider.analyze(acToSerp);
          for (let i = 0; i < acToSerp.length; i++) {
            const vol = acVolumeMap.get(acToSerp[i]);
            const serp = acSerpData[i];
            if (vol && serp) {
              const item = calculateProfitScore(vol, serp);
              acAnalyzedMap.set(item.keyword, item);
            }
          }
        }
      }

      autoCompleteKeywords = acKeywords
        .map((kw) => analyzedMap.get(kw) || acAnalyzedMap.get(kw))
        .filter((item): item is KeywordItem => item != null)
        .sort((a, b) => b.profitScore - a.profitScore);
    }

    const response: AnalyzeResponse = {
      seedItem: seedItem || null,
      items: relatedItems,
      autoCompleteKeywords,
      seed: seedKeyword,
      analyzedAt: new Date().toISOString(),
    };

    logEvent("analyze", {
      keyword: seed,
      result_count: relatedItems.length,
      api_request_id: requestId,
    }, user?.id);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
