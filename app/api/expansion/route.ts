import { NextRequest, NextResponse } from "next/server";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import {
  calculateFinalScore,
  filterKeywords,
  selectMainAndSub,
} from "@/lib/scoring/moneyScore";
import { ExpansionResponse, MoneyKeywordItem, BlogReference } from "@/types";
import { logEvent } from "@/lib/supabase/logger";

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

// 네이버 상위 블로그 5개 가져오기
async function fetchTopBlogs(keyword: string): Promise<BlogReference[]> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  try {
    const params = new URLSearchParams({
      query: keyword,
      display: "5",
      sort: "sim",
    });
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?${params.toString()}`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: {
      title: string;
      link: string;
      description: string;
      bloggername: string;
      postdate: string;
    }[] = (data.items || []).slice(0, 5);

    return items.map((item) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, "").slice(0, 150),
      bloggerName: item.bloggername,
      postDate: item.postdate
        ? `${item.postdate.slice(0, 4)}.${item.postdate.slice(4, 6)}.${item.postdate.slice(6, 8)}`
        : "",
    }));
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, minVolume = 300, maxDocs = 50000 } = body;

    if (
      !keyword ||
      typeof keyword !== "string" ||
      keyword.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "키워드를 입력해주세요." },
        { status: 400 }
      );
    }

    const seed = keyword.trim();
    const volumeProvider = createVolumeProvider();
    const serpProvider = createSerpProvider();

    // 1: 자동완성 키워드 + 광고 API 연관 키워드 동시 수집
    const [acKeywords, volumeData] = await Promise.all([
      fetchAutoComplete(seed),
      volumeProvider.getVolume([seed]),
    ]);

    console.log(
      `[Expansion] Autocomplete: ${acKeywords.length}, Ads API: ${volumeData.length}`
    );

    // 모든 후보 키워드 합치기 (중복 제거)
    const allKeywordsSet = new Set<string>();
    const acSet = new Set<string>(acKeywords);

    for (const v of volumeData) allKeywordsSet.add(v.keyword);
    for (const kw of acKeywords) allKeywordsSet.add(kw);

    const allKeywords = Array.from(allKeywordsSet).slice(0, 40);

    // 2: 검색량 데이터 보강 (자동완성 키워드 중 volumeData에 없는 것)
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));
    const needVolume = allKeywords.filter((kw) => !volumeMap.has(kw));

    if (needVolume.length > 0) {
      // 자동완성 키워드를 시드로 첫 번째 것으로 검색량 조회
      const extraVolume = await volumeProvider.getVolume([needVolume[0]]);
      for (const v of extraVolume) {
        if (!volumeMap.has(v.keyword)) {
          volumeMap.set(v.keyword, v);
        }
      }
    }

    // volumeData가 있는 키워드만 분석
    const keywordsWithVolume = allKeywords.filter((kw) => volumeMap.has(kw));

    // 3: SERP 분석 (문서수)
    const serpData = await serpProvider.analyze(keywordsWithVolume);

    // 4: MoneyScore + FinalScore 계산
    const allScored: MoneyKeywordItem[] = keywordsWithVolume
      .map((kw, i) => {
        const vol = volumeMap.get(kw);
        const serp = serpData[i];
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
        };
      })
      .filter((item): item is MoneyKeywordItem => item !== null);

    // 5: 필터링
    const filtered = allScored.filter(
      (item) =>
        item.totalVolume >= minVolume &&
        item.totalDocCount <= maxDocs &&
        Math.log(item.totalDocCount + 1) > 0
    );

    // 6: 메인/서브 자동 선정
    const scoreResults = filtered.map((item) =>
      calculateFinalScore({
        keyword: item.keyword,
        volume: item.totalVolume,
        docs: item.totalDocCount,
      })
    );

    const { main, subs } = selectMainAndSub(scoreResults, acSet);

    if (!main) {
      return NextResponse.json(
        { error: "조건에 맞는 키워드를 찾지 못했습니다." },
        { status: 404 }
      );
    }

    // MoneyKeywordItem으로 매핑
    const itemMap = new Map(filtered.map((item) => [item.keyword, item]));
    const mainKeyword = itemMap.get(main.keyword)!;
    const subKeywords = subs
      .map((s) => itemMap.get(s.keyword))
      .filter((s): s is MoneyKeywordItem => s != null);

    // 7: 메인 키워드 기준 상위 블로그 5개
    const topBlogs = await fetchTopBlogs(mainKeyword.keyword);

    const response: ExpansionResponse = {
      mainKeyword,
      subKeywords,
      allCandidates: filtered.sort((a, b) => b.finalScore - a.finalScore),
      topBlogs,
      analyzedAt: new Date().toISOString(),
    };

    logEvent("expansion", {
      keyword: seed,
      main: mainKeyword.keyword,
      sub_count: subKeywords.length,
    });

    console.log(
      `[Expansion] Main: ${mainKeyword.keyword}, Subs: ${subKeywords.map((s) => s.keyword).join(", ")}`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Expansion error:", error);
    return NextResponse.json(
      { error: "키워드 확장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
