import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createVolumeProvider } from "@/lib/providers/volumeProvider";
import { createSerpProvider } from "@/lib/providers/serpProvider";
import { calculateProfitScore } from "@/lib/scoring/profitScore";
import { ExtractResponse, KeywordItem, VolumeData, BlogTitleAnalysis } from "@/types";
import { logEvent, calcOpenAICost } from "@/lib/supabase/logger";
import {
  calcOpenAICostKrw,
  createApiRequestId,
  runLoggedOpenAICall,
} from "@/lib/supabase/apiUsageLogger";
import { createClient } from "@/lib/supabase/server";

// 네이버 블로그 URL에서 blogId 추출
function extractBlogId(link: string): string | null {
  // 형태 1: https://blog.naver.com/blogid/logno
  const match1 = link.match(/blog\.naver\.com\/([^/?]+)\/(\d+)/);
  if (match1) return match1[1];
  // 형태 2: https://blog.naver.com/PostView.naver?blogId=xxx
  const match2 = link.match(/blogId=([^&]+)/);
  if (match2) return match2[1];
  return null;
}

// 블로그 일일 방문자 수 조회 (NVisitorgp4Ajax XML API)
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
    // XML에서 가장 최근 날짜의 방문자 수 추출
    const matches = [...xml.matchAll(/cnt="(\d+)"/g)];
    if (matches.length === 0) return null;
    // 마지막 항목이 오늘(또는 가장 최근)
    return parseInt(matches[matches.length - 1][1], 10);
  } catch {
    return null;
  }
}

// 블로그 포스트 목록에서 댓글수 + 전체 포스팅 수 조회 (PostTitleListAsync)
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

    // 전체 포스팅 수
    let totalPosts: number | null = null;
    const totalMatch = text.match(/"totalCount":"(\d+)"/);
    if (totalMatch) totalPosts = parseInt(totalMatch[1], 10);

    // 해당 logNo의 commentCount
    let commentCount: number | null = null;
    const commentRegex = new RegExp(
      `"logNo":"${logNo}"[^}]*"commentCount":"(\\d+)"`
    );
    const commentMatch = text.match(commentRegex);
    if (commentMatch) {
      commentCount = parseInt(commentMatch[1], 10);
    } else {
      const emptyRegex = new RegExp(
        `"logNo":"${logNo}"[^}]*"commentCount":""`
      );
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
    const { description } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "블로그 글 설명을 입력해주세요." },
        { status: 400 }
      );
    }

    const desc = description.trim();
    const usageContext = {
      feature: "extract",
      requestId,
      userId: user?.id,
    };
    let blogAnalysisUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    // Step 1: GPT로 넓은 시드 키워드 추출 (2~4글자 짧은 핵심어)
    console.log("[Extract] Step 1: Extracting seed keywords...");
    const extractCompletion = await runLoggedOpenAICall({
      feature: "extract",
      requestId,
      userId: user?.id,
      model: "gpt-4o-mini",
      metaJson: {
        step: "seed_extraction",
        description_length: desc.length,
      },
      execute: () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `당신은 네이버 블로그 SEO 전문가입니다.
아래 블로그 글 설명에서 네이버 검색량이 높을 만한 **핵심 시드 키워드**를 추출하세요.

## 블로그 글 설명
${desc}

## 요구사항
- seeds: 검색량이 많을 것으로 예상되는 넓고 짧은 핵심 키워드 3~5개
- 시드 키워드는 반드시 1~3단어, 짧고 일반적인 형태 (예: "예식장", "결혼준비", "웨딩홀")
- 너무 구체적이거나 긴 키워드 금지 (예: "예식장암행투어후기" ❌ → "예식장" ✅)
- 공백 없이 붙여쓰기 (예: "결혼준비", "다이어트식단")
- 서로 다른 관점/주제의 시드를 골고루 뽑을 것

다음 JSON 형식으로 응답해주세요:
{
  "seeds": ["시드1", "시드2", "시드3"]
}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const extractContent = extractCompletion.choices[0]?.message?.content;
    if (!extractContent) {
      throw new Error("키워드 추출 응답이 비어있습니다.");
    }

    const extracted: { seeds: string[] } = JSON.parse(extractContent);
    if (!extracted.seeds?.length) {
      throw new Error("키워드 추출 결과가 올바르지 않습니다.");
    }

    const seeds = extracted.seeds.slice(0, 5);
    console.log(`[Extract] Seeds: ${seeds.join(", ")}`);

    // Step 2: 각 시드로 네이버 광고 API 호출 → 연관 키워드 + 검색량 수집
    console.log("[Extract] Step 2: Fetching related keywords from Naver Ads API...");
    const volumeProvider = createVolumeProvider(usageContext);
    const allVolumeMap = new Map<string, VolumeData>();

    for (let i = 0; i < seeds.length; i++) {
      const results = await volumeProvider.getVolume([seeds[i]]);
      console.log(`[Extract] Seed "${seeds[i]}" → ${results.length} related keywords`);
      for (const v of results) {
        // 검색량이 더 높은 데이터를 우선 보존
        const existing = allVolumeMap.get(v.keyword);
        if (!existing || v.totalVolume > existing.totalVolume) {
          allVolumeMap.set(v.keyword, v);
        }
      }
      if (i < seeds.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    console.log(`[Extract] Total unique keywords collected: ${allVolumeMap.size}`);

    // Step 3: 검색량 상위 키워드 선정
    const topKeywords = Array.from(allVolumeMap.values())
      .filter((v) => v.totalVolume > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 20);

    if (topKeywords.length === 0) {
      throw new Error("검색량이 있는 키워드를 찾지 못했습니다. 다른 주제로 시도해주세요.");
    }

    const keywordsToAnalyze = topKeywords.map((v) => v.keyword);
    console.log(`[Extract] ${keywordsToAnalyze.length} keywords selected for SERP analysis`);

    // Step 4: SERP 분석 (네이버 검색 API + 크롤링)
    console.log("[Extract] Step 3: Analyzing SERP...");
    const serpProvider = createSerpProvider(usageContext);
    const serpData = await serpProvider.analyze(keywordsToAnalyze);

    // Step 5: 수익점수 계산
    console.log("[Extract] Step 4: Calculating profit scores...");
    const analyzedItems: KeywordItem[] = keywordsToAnalyze
      .map((kw, i) => {
        const vol = allVolumeMap.get(kw);
        const serp = serpData[i];
        if (!vol || !serp) return null;
        return calculateProfitScore(vol, serp);
      })
      .filter((item): item is KeywordItem => item !== null)
      .sort((a, b) => b.profitScore - a.profitScore);

    if (analyzedItems.length === 0) {
      throw new Error("키워드 분석에 실패했습니다.");
    }

    // Step 6: GPT로 메인/서브 키워드 선정 (제목은 블로그 크롤링 후 생성)
    console.log("[Extract] Step 5: Selecting main keyword and sub keywords...");
    const keywordSummary = analyzedItems
      .slice(0, 15)
      .map(
        (item) =>
          `- ${item.keyword}: 검색량 ${item.totalVolume.toLocaleString()}, 수익점수 ${item.profitScore}(${item.grade}등급), 포화도 ${item.saturation}`
      )
      .join("\n");

    const selectionCompletion = await runLoggedOpenAICall({
      feature: "extract",
      requestId,
      userId: user?.id,
      model: "gpt-4o-mini",
      metaJson: {
        step: "keyword_selection",
        analyzed_item_count: analyzedItems.length,
      },
      execute: () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `당신은 네이버 블로그 SEO 전문가입니다.

## 원래 블로그 글 주제
${desc}

## 네이버 실제 키워드 분석 결과
${keywordSummary}

## 요구사항
위 분석 데이터를 보고:

1. **mainKeywordCandidates**: 메인 타겟 키워드 후보 3개를 선정하세요
   - 글 주제와 가장 관련 있으면서 수익점수가 높은 키워드 3개
   - 위 분석 결과 목록에서 선택
   - 가장 추천하는 순서대로 나열

2. **subKeywords**: 서브 키워드 5~8개를 선정하세요
   - 메인 키워드 후보 1순위와 직접적으로 관련된 키워드 위주로 선택
   - 메인 키워드를 검색하는 사람이 함께 궁금해할 만한 키워드
   - 위 분석 결과 목록에서 선택

다음 JSON 형식으로 응답해주세요:
{
  "mainKeywordCandidates": ["후보1", "후보2", "후보3"],
  "subKeywords": ["서브1", "서브2"]
}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const selectionContent = selectionCompletion.choices[0]?.message?.content;
    if (!selectionContent) {
      throw new Error("키워드 선정 응답이 비어있습니다.");
    }

    const selection: {
      mainKeywordCandidates: string[];
      subKeywords: string[];
    } = JSON.parse(selectionContent);

    // 분석 결과에서 GPT가 선정한 키워드 매칭
    const analyzedMap = new Map(analyzedItems.map((item) => [item.keyword, item]));

    // 메인 키워드 후보 3개
    const mainKeywordCandidates = (selection.mainKeywordCandidates || [])
      .map((kw) => analyzedMap.get(kw))
      .filter((item): item is KeywordItem => item != null);

    // 후보가 부족하면 수익점수 상위에서 보충
    if (mainKeywordCandidates.length < 2) {
      const candidateSet = new Set(mainKeywordCandidates.map((i) => i.keyword));
      const extras = analyzedItems
        .filter((item) => !candidateSet.has(item.keyword))
        .slice(0, 3 - mainKeywordCandidates.length);
      mainKeywordCandidates.push(...extras);
    }

    const mainCandidateSet = new Set(mainKeywordCandidates.map((i) => i.keyword));

    const subKeywordItems = selection.subKeywords
      .map((kw) => analyzedMap.get(kw))
      .filter((item): item is KeywordItem => item != null && !mainCandidateSet.has(item.keyword));

    // GPT가 선정하지 않은 고수익 키워드도 추가 (수익점수 상위)
    if (subKeywordItems.length < 5) {
      const selectedSet = new Set([...mainCandidateSet, ...subKeywordItems.map((i) => i.keyword)]);
      const extras = analyzedItems
        .filter((item) => !selectedSet.has(item.keyword))
        .slice(0, 5 - subKeywordItems.length);
      subKeywordItems.push(...extras);
    }

    // Step 7: 네이버 자동완성 연관검색어 가져오기 + 분석
    console.log("[Extract] Step 6: Fetching autocomplete keywords...");
    const mainKwForAC = mainKeywordCandidates[0]?.keyword || analyzedItems[0]?.keyword;
    const acKeywords = mainKwForAC ? await fetchAutoComplete(mainKwForAC) : [];
    console.log(`[Extract] Autocomplete: ${acKeywords.join(", ")}`);

    let autoCompleteKeywords: KeywordItem[] = [];
    if (acKeywords.length > 0) {
      // 이미 분석된 키워드는 재사용, 나머지는 새로 분석
      const needAnalysis = acKeywords.filter((kw) => !analyzedMap.has(kw));
      const acAnalyzedMap = new Map<string, KeywordItem>();

      if (needAnalysis.length > 0) {
        const acVolumeData = await volumeProvider.getVolume([needAnalysis[0]]);
        const acVolumeMap = new Map(acVolumeData.map((v) => [v.keyword, v]));
        // needAnalysis 중 volumeData에서 찾을 수 없는 것은 개별 조회 불필요 (자동완성이므로 첫 시드로 충분)
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

    // Step 8: 네이버 상위 블로그 제목 수집 + 분석 (제목 생성보다 먼저)
    console.log("[Extract] Step 7: Fetching top Naver blog titles...");
    let topBlogTitles: BlogTitleAnalysis[] = [];
    let topBlogTitleList = "";
    const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    const mainKeywordForSearch = mainKeywordCandidates[0] || analyzedItems[0];
    if (searchClientId && searchClientSecret) {
      try {
        const blogParams = new URLSearchParams({
          query: mainKeywordForSearch.keyword,
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

            const [blogAnalysisResult, blogStatsResults] = await Promise.all([
              runLoggedOpenAICall({
                feature: "extract",
                requestId,
                userId: user?.id,
                model: "gpt-4o-mini",
                metaJson: {
                  step: "top_blog_analysis",
                  keyword: mainKeywordForSearch.keyword,
                  blog_item_count: cleanItems.length,
                },
                execute: () => openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "user",
                      content: `당신은 네이버 블로그 SEO 전문가입니다.

"${mainKeywordForSearch.keyword}" 키워드로 네이버 검색 시 상위에 노출되는 블로그 글들입니다:

${blogTitleListFull}

각 글을 분석해주세요:
- clickScore: 제목의 클릭 유도력 점수 (0~100)
- analysis: 제목 전략의 강점/약점 + 상위 노출 가능 요인을 1~2문장으로 분석

다음 JSON 형식으로 응답해주세요:
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

            blogAnalysisUsage = {
              prompt_tokens: blogAnalysisResult.usage?.prompt_tokens ?? 0,
              completion_tokens: blogAnalysisResult.usage?.completion_tokens ?? 0,
            };

            const blogAnalysisContent = blogAnalysisResult.choices[0]?.message?.content;
            if (blogAnalysisContent) {
              const parsed: { analyses: { clickScore: number; analysis: string }[] } =
                JSON.parse(blogAnalysisContent);

              topBlogTitles = cleanItems.map((t, i) => ({
                title: t.title,
                link: t.link,
                clickScore: parsed.analyses[i]?.clickScore ?? 0,
                analysis: parsed.analyses[i]?.analysis ?? "",
                bloggerName: t.bloggerName,
                postDate: t.postDate,
                description: t.description,
                commentCount: blogStatsResults[i]?.commentCount ?? null,
                dailyVisitors: blogStatsResults[i]?.dailyVisitors ?? null,
                totalPosts: blogStatsResults[i]?.totalPosts ?? null,
              }));
            }
          }
        }
      } catch (e) {
        console.error("[Extract] Blog title fetch failed:", e);
      }
    }

    // Step 8: 네이버 상위 제목을 참고하여 AI 제목 생성
    console.log("[Extract] Step 7: Generating titles with blog reference...");
    const subSummary = subKeywordItems
      .slice(0, 8)
      .map(
        (item) =>
          `- ${item.keyword}: 검색량 ${item.totalVolume.toLocaleString()}, 수익점수 ${item.profitScore}(${item.grade}등급)`
      )
      .join("\n");

    const topTitlesRef = topBlogTitleList
      ? `\n## 현재 네이버 상위 노출 제목 (참고용)\n${topBlogTitleList}\n`
      : "";

    const titleCompletion = await runLoggedOpenAICall({
      feature: "extract",
      requestId,
      userId: user?.id,
      model: "gpt-4o-mini",
      metaJson: {
        step: "title_generation",
        main_keyword: mainKeywordForSearch.keyword,
        sub_keyword_count: subKeywordItems.length,
      },
      execute: () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `당신은 네이버 블로그 SEO 전문가입니다.

## 원래 블로그 글 주제
${desc}

## 메인 키워드
${mainKeywordForSearch.keyword} (검색량: ${mainKeywordForSearch.totalVolume.toLocaleString()}, 수익점수: ${mainKeywordForSearch.profitScore}, 등급: ${mainKeywordForSearch.grade})

## 서브 키워드
${subSummary}
${topTitlesRef}
## 요구사항
메인 키워드와 서브 키워드를 활용하여 수익성이 높은 블로그 제목 5개를 추천하세요.
- 메인 키워드를 반드시 제목에 포함
- 네이버 상위 노출 제목의 패턴(키워드 배치, 후기/추천/비교 등의 포맷)을 참고하되, 그대로 베끼지 말고 차별화된 제목을 만들 것
- 각 제목에 클릭점수(0~100)와 수익성이 좋은 이유를 구체적으로 제공
- 이유에는 검색량, 포화도, 수익점수 데이터를 근거로 포함

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

    const titleContent = titleCompletion.choices[0]?.message?.content;
    let generatedTitles: { title: string; clickScore: number; reason: string }[] = [];
    if (titleContent) {
      const parsed: { titles: { title: string; clickScore: number; reason: string }[] } = JSON.parse(titleContent);
      generatedTitles = parsed.titles || [];
    }

    const response: ExtractResponse = {
      mainKeywordCandidates,
      subKeywords: subKeywordItems,
      autoCompleteKeywords,
      titles: generatedTitles,
      topBlogTitles,
      description: desc,
      analyzedAt: new Date().toISOString(),
    };

    // 토큰 사용량 집계
    const totalTokens = {
      prompt_tokens:
        (extractCompletion.usage?.prompt_tokens ?? 0) +
        (selectionCompletion.usage?.prompt_tokens ?? 0) +
        blogAnalysisUsage.prompt_tokens +
        (titleCompletion.usage?.prompt_tokens ?? 0),
      completion_tokens:
        (extractCompletion.usage?.completion_tokens ?? 0) +
        (selectionCompletion.usage?.completion_tokens ?? 0) +
        blogAnalysisUsage.completion_tokens +
        (titleCompletion.usage?.completion_tokens ?? 0),
    };
    logEvent("extract", {
      description: desc.slice(0, 100),
      api_request_id: requestId,
      openai_tokens: totalTokens.prompt_tokens + totalTokens.completion_tokens,
      openai_cost_usd: calcOpenAICost(totalTokens),
      openai_cost_krw: calcOpenAICostKrw(totalTokens),
    }, user?.id);

    console.log(`[Extract] Done! Main candidates: ${mainKeywordCandidates.map((c) => c.keyword).join(", ")}, Subs: ${subKeywordItems.length}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Extract error:", error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "키워드 추출 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
