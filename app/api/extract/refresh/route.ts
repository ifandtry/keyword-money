import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { calculateProfitScore } from "@/lib/scoring/profitScore";
import { KeywordItem, TitleSuggestion, BlogTitleAnalysis } from "@/types";
import { logEvent, calcOpenAICost } from "@/lib/supabase/logger";
import {
  calcOpenAICostKrw,
  createApiRequestId,
  runLoggedOpenAICall,
} from "@/lib/supabase/apiUsageLogger";
import { createClient } from "@/lib/supabase/server";

// 네이버 블로그 URL에서 blogId 추출
function extractBlogId(link: string): string | null {
  const match1 = link.match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
  if (match1) return match1[1];
  const match2 = link.match(/blogId=([^&]+)/);
  if (match2) return match2[1];
  return null;
}

// 블로그 일일 방문자 수 조회
async function fetchDailyVisitors(blogId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://blog.naver.com/NVisitorgp4Ajax.nhn?blogId=${blogId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: `https://blog.naver.com/${blogId}`,
        },
      }
    );
    if (!res.ok) return null;
    const xml = await res.text();
    const matches = [...xml.matchAll(/cnt="(\d+)"/g)];
    if (matches.length === 0) return null;
    return parseInt(matches[matches.length - 1][1], 10);
  } catch {
    return null;
  }
}

// 블로그 포스트 목록에서 댓글수 + 전체 포스팅 수 조회
async function fetchPostStats(
  blogId: string,
  logNo: string
): Promise<{ commentCount: number | null; totalPosts: number | null }> {
  try {
    const res = await fetch(
      `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&viewdate=&currentPage=1&categoryNo=&parentCategoryNo=&countPerPage=30`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: `https://blog.naver.com/${blogId}`,
        },
      }
    );
    if (!res.ok) return { commentCount: null, totalPosts: null };
    const text = await res.text();

    let totalPosts: number | null = null;
    const totalMatch = text.match(/"totalCount":"(\d+)"/);
    if (totalMatch) totalPosts = parseInt(totalMatch[1], 10);

    let commentCount: number | null = null;
    const commentRegex = new RegExp(`"logNo":"${logNo}"[^}]*"commentCount":"(\\d+)"`);
    const commentMatch = text.match(commentRegex);
    if (commentMatch) {
      commentCount = parseInt(commentMatch[1], 10);
    } else {
      const emptyRegex = new RegExp(`"logNo":"${logNo}"[^}]*"commentCount":""`);
      if (emptyRegex.test(text)) commentCount = 0;
    }

    return { commentCount, totalPosts };
  } catch {
    return { commentCount: null, totalPosts: null };
  }
}

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

// 메인 키워드 변경 시 서브 키워드 + 제목 + 상위 블로그 재생성
export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const requestId = createApiRequestId();
    const body = await request.json();
    const {
      selectedKeyword,
      description,
    }: {
      selectedKeyword: KeywordItem;
      description: string;
    } = body;

    if (!selectedKeyword?.keyword) {
      return NextResponse.json({ error: "키워드가 필요합니다." }, { status: 400 });
    }

    const mainKw = selectedKeyword.keyword;
    console.log(`[Refresh] Main keyword: ${mainKw}`);

    const usageContext = {
      feature: "extract_refresh",
      requestId,
      userId: user?.id,
    };
    let analysisUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    // === Step 1: 선택한 메인 키워드로 서브 키워드 갱신 (네이버 광고 API → SERP → 수익점수) ===
    const volumeProvider = createVolumeProvider(usageContext);
    const serpProvider = createSerpProvider(usageContext);

    // 네이버 광고 API: 메인 키워드를 시드로 연관 키워드 + 검색량 조회
    const volumeData = await volumeProvider.getVolume([mainKw]);
    console.log(`[Refresh] Naver API returned ${volumeData.length} keywords`);

    // 메인 키워드 제외, 검색량 상위 20개
    const relatedVolumes = volumeData
      .filter((v) => v.keyword !== mainKw && v.totalVolume > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 20);

    const keywordsToAnalyze = relatedVolumes.slice(0, 15).map((v) => v.keyword);

    // SERP 분석 + 수익점수 계산
    const serpData = await serpProvider.analyze(keywordsToAnalyze);
    const volumeMap = new Map(volumeData.map((v) => [v.keyword, v]));

    const subKeywords: KeywordItem[] = keywordsToAnalyze
      .map((kw, i) => {
        const vol = volumeMap.get(kw);
        const serp = serpData[i];
        if (!vol || !serp) return null;
        return calculateProfitScore(vol, serp);
      })
      .filter((item): item is KeywordItem => item !== null)
      .sort((a, b) => b.profitScore - a.profitScore);

    console.log(`[Refresh] ${subKeywords.length} sub-keywords analyzed`);

    // === Step 1.5: 네이버 자동완성 연관검색어 가져오기 + 분석 ===
    const acKeywords = await fetchAutoComplete(mainKw);
    console.log(`[Refresh] Autocomplete: ${acKeywords.join(", ")}`);

    let autoCompleteKeywords: KeywordItem[] = [];
    if (acKeywords.length > 0) {
      const subKeywordMap = new Map(subKeywords.map((s) => [s.keyword, s]));
      const needAnalysis = acKeywords.filter((kw) => !subKeywordMap.has(kw) && !volumeMap.has(kw));

      const acAnalyzedMap = new Map<string, KeywordItem>();
      // 이미 volumeData에 있는 자동완성 키워드는 재사용
      for (const kw of acKeywords) {
        if (subKeywordMap.has(kw)) {
          acAnalyzedMap.set(kw, subKeywordMap.get(kw)!);
        }
      }

      if (needAnalysis.length > 0) {
        const acVolumeData = await volumeProvider.getVolume([needAnalysis[0]]);
        const acVolMap = new Map(acVolumeData.map((v) => [v.keyword, v]));
        const acToSerp = needAnalysis.filter((kw) => acVolMap.has(kw));
        if (acToSerp.length > 0) {
          const acSerpData = await serpProvider.analyze(acToSerp);
          for (let i = 0; i < acToSerp.length; i++) {
            const vol = acVolMap.get(acToSerp[i]);
            const serp = acSerpData[i];
            if (vol && serp) {
              const item = calculateProfitScore(vol, serp);
              acAnalyzedMap.set(item.keyword, item);
            }
          }
        }
        // volumeMap에 있지만 아직 분석 안된 것도 처리
        for (const kw of acKeywords) {
          if (!acAnalyzedMap.has(kw) && volumeMap.has(kw)) {
            const vol = volumeMap.get(kw)!;
            // SERP 데이터가 필요 - 간단히 serpProvider로 분석
            const serpResults = await serpProvider.analyze([kw]);
            if (serpResults[0]) {
              const item = calculateProfitScore(vol, serpResults[0]);
              acAnalyzedMap.set(item.keyword, item);
            }
          }
        }
      } else {
        // 모두 이미 분석된 경우 - volumeMap에 있는 것들 처리
        for (const kw of acKeywords) {
          if (!acAnalyzedMap.has(kw) && volumeMap.has(kw)) {
            const vol = volumeMap.get(kw)!;
            const serpResults = await serpProvider.analyze([kw]);
            if (serpResults[0]) {
              const item = calculateProfitScore(vol, serpResults[0]);
              acAnalyzedMap.set(item.keyword, item);
            }
          }
        }
      }

      autoCompleteKeywords = acKeywords
        .map((kw) => acAnalyzedMap.get(kw))
        .filter((item): item is KeywordItem => item != null)
        .sort((a, b) => b.profitScore - a.profitScore);
    }

    console.log(`[Refresh] ${autoCompleteKeywords.length} autocomplete keywords analyzed`);

    // === Step 2: 네이버 상위 블로그 먼저 크롤링 (제목 생성 시 참고하기 위해) ===
    const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    let topBlogTitles: BlogTitleAnalysis[] = [];
    let topBlogTitleList = "";

    if (searchClientId && searchClientSecret) {
      try {
        const blogParams = new URLSearchParams({
          query: mainKw,
          display: "5",
          sort: "sim",
        });
        const blogRes = await fetch(
          `https://openapi.naver.com/v1/search/blog.json?${blogParams.toString()}`,
          {
            headers: {
              "X-Naver-Client-Id": searchClientId,
              "X-Naver-Client-Secret": searchClientSecret,
            },
          }
        );

        if (blogRes.ok) {
          const blogData = await blogRes.json();
          const blogItems: {
            title: string;
            link: string;
            description: string;
            bloggername: string;
            postdate: string;
          }[] = (blogData.items || []).slice(0, 5);

          const cleanItems = blogItems.map((item) => ({
            title: item.title.replace(/<[^>]*>/g, ""),
            link: item.link,
            description: item.description.replace(/<[^>]*>/g, "").slice(0, 100),
            bloggerName: item.bloggername,
            postDate: item.postdate
              ? `${item.postdate.slice(0, 4)}.${item.postdate.slice(4, 6)}.${item.postdate.slice(6, 8)}`
              : "",
          }));

          if (cleanItems.length > 0) {
            topBlogTitleList = cleanItems
              .map((t, i) => `${i + 1}. "${t.title}"`)
              .join("\n");

            const blogTitleListFull = cleanItems
              .map((t, i) => `${i + 1}. "${t.title}" (블로그: ${t.bloggerName}, 날짜: ${t.postDate})`)
              .join("\n");

            const visitorCache = new Map<string, Promise<number | null>>();
            const getCachedVisitors = (bId: string) => {
              if (!visitorCache.has(bId)) {
                visitorCache.set(bId, fetchDailyVisitors(bId));
              }
              return visitorCache.get(bId)!;
            };

            const [analysisResult, statsResults] = await Promise.all([
              runLoggedOpenAICall({
                feature: "extract_refresh",
                requestId,
                userId: user?.id,
                model: "gpt-4o-mini",
                metaJson: {
                  step: "top_blog_analysis",
                  keyword: mainKw,
                  blog_item_count: cleanItems.length,
                },
                execute: () => openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "user",
                      content: `당신은 네이버 블로그 SEO 전문가입니다.

"${mainKw}" 키워드로 네이버 검색 시 상위에 노출되는 블로그 글들입니다:

${blogTitleListFull}

각 글을 분석해주세요:
- clickScore: 제목의 클릭 유도력 점수 (0~100)
- analysis: 제목 전략의 강점/약점 + 상위 노출 가능 요인을 1~2문장으로 분석

다음 JSON 형식으로 응답:
{
  "analyses": [
    { "clickScore": 75, "analysis": "분석 내용" }
  ]
}`,
                    },
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0.5,
                }),
              }),
              Promise.all(
                cleanItems.map(async (t) => {
                  const bId = extractBlogId(t.link);
                  if (!bId) return { commentCount: null, dailyVisitors: null, totalPosts: null };
                  const logNoMatch = t.link.match(/blog\.naver\.com\/[^/?]+\/(\d+)/) || t.link.match(/logNo=(\d+)/);
                  const lNo = logNoMatch?.[1] || "";
                  const [postStats, dailyVisitors] = await Promise.all([
                    lNo ? fetchPostStats(bId, lNo) : Promise.resolve({ commentCount: null, totalPosts: null }),
                    getCachedVisitors(bId),
                  ]);
                  return { commentCount: postStats.commentCount, dailyVisitors, totalPosts: postStats.totalPosts };
                })
              ),
            ]);

            analysisUsage = {
              prompt_tokens: analysisResult.usage?.prompt_tokens ?? 0,
              completion_tokens: analysisResult.usage?.completion_tokens ?? 0,
            };

            const analysisContent = analysisResult.choices[0]?.message?.content;
            if (analysisContent) {
              const parsed: { analyses: { clickScore: number; analysis: string }[] } =
                JSON.parse(analysisContent);

              topBlogTitles = cleanItems.map((t, i) => ({
                title: t.title,
                link: t.link,
                clickScore: parsed.analyses[i]?.clickScore ?? 0,
                analysis: parsed.analyses[i]?.analysis ?? "",
                bloggerName: t.bloggerName,
                postDate: t.postDate,
                description: t.description,
                commentCount: statsResults[i]?.commentCount ?? null,
                dailyVisitors: statsResults[i]?.dailyVisitors ?? null,
                totalPosts: statsResults[i]?.totalPosts ?? null,
              }));
            }
          }
        }
      } catch (e) {
        console.error("[Refresh] Blog fetch failed:", e);
      }
    }

    // === Step 3: 네이버 상위 제목을 참고하여 AI 제목 생성 ===
    const subSummary = subKeywords
      .slice(0, 8)
      .map(
        (item) =>
          `- ${item.keyword}: 검색량 ${item.totalVolume.toLocaleString()}, 수익점수 ${item.profitScore}(${item.grade}등급)`
      )
      .join("\n");

    const topTitlesRef = topBlogTitleList
      ? `\n## 현재 네이버 상위 노출 제목 (참고용)\n${topBlogTitleList}\n`
      : "";

    const titleResult = await runLoggedOpenAICall({
      feature: "extract_refresh",
      requestId,
      userId: user?.id,
      model: "gpt-4o-mini",
      metaJson: {
        step: "title_generation",
        main_keyword: mainKw,
        sub_keyword_count: subKeywords.length,
      },
      execute: () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `당신은 네이버 블로그 SEO 전문가입니다.

## 원래 블로그 글 주제
${description}

## 선택한 메인 키워드
${mainKw} (검색량: ${selectedKeyword.totalVolume.toLocaleString()}, 수익점수: ${selectedKeyword.profitScore}, 등급: ${selectedKeyword.grade})

## 서브 키워드
${subSummary}
${topTitlesRef}
## 요구사항
선택한 메인 키워드를 반드시 제목에 포함
- 네이버 상위 노출 제목의 패턴(키워드 배치, 후기/추천/비교 등의 포맷)을 참고하되, 그대로 베끼지 말고 차별화된 제목을 만들 것
- 각 제목에 클릭점수(0~100)와 수익성이 좋은 이유를 구체적으로 제공

다음 JSON 형식으로 응답:
{
  "titles": [
    { "title": "제목", "clickScore": 85, "reason": "이유" }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const titleContent = titleResult.choices[0]?.message?.content;
    let titles: TitleSuggestion[] = [];
    if (titleContent) {
      const parsed: { titles: TitleSuggestion[] } = JSON.parse(titleContent);
      titles = parsed.titles || [];
    }

    const totalTokens = {
      prompt_tokens:
        analysisUsage.prompt_tokens +
        (titleResult.usage?.prompt_tokens ?? 0),
      completion_tokens:
        analysisUsage.completion_tokens +
        (titleResult.usage?.completion_tokens ?? 0),
    };
    logEvent("extract_refresh", {
      main_keyword: mainKw,
      api_request_id: requestId,
      openai_tokens: totalTokens.prompt_tokens + totalTokens.completion_tokens,
      openai_cost_usd: calcOpenAICost(totalTokens),
      openai_cost_krw: calcOpenAICostKrw(totalTokens),
    }, user?.id);

    console.log(`[Refresh] Done! Titles: ${titles.length}, Blogs: ${topBlogTitles.length}, Subs: ${subKeywords.length}, AC: ${autoCompleteKeywords.length}`);
    return NextResponse.json({ titles, topBlogTitles, subKeywords, autoCompleteKeywords });
  } catch (error) {
    console.error("Extract refresh error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "갱신 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
