import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { generateRelatedKeywords } from "@/lib/providers/relatedKeywords";
import { calculateProfitScore } from "@/lib/scoring/profitScore";
import { AnalyzeResponse } from "@/types";

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

    // 1단계: 네이버 광고 API에 시드 키워드 전달 → 연관키워드 + 검색량 한번에 수신
    const volumeData = await volumeProvider.getVolume([seed]);

    let keywordsToAnalyze: string[];

    if (volumeData.length >= 5) {
      // 네이버 API가 연관키워드를 반환한 경우 → 최대 30개 사용
      keywordsToAnalyze = volumeData.slice(0, 30).map((v) => v.keyword);
      console.log(
        `[Analyze] Using ${keywordsToAnalyze.length} keywords from Naver API`
      );
    } else {
      // Mock이거나 API 실패 시 → 패턴 생성
      keywordsToAnalyze = generateRelatedKeywords(seed);
      console.log("[Analyze] Using pattern-generated keywords (fallback)");
    }

    // 2단계: SERP 크롤링 (월간문서수, 월간블로그수, 블로그비율, 경쟁도)
    const serpData = await serpProvider.analyze(keywordsToAnalyze);

    // 3단계: 검색량 데이터 매핑
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));

    // 4단계: 점수 계산
    const items = keywordsToAnalyze
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

    items.sort((a, b) => b.profitScore - a.profitScore);

    const response: AnalyzeResponse = {
      items,
      seed,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
