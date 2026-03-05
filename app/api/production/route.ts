import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ProductionResponse } from "@/types";
import { logEvent, calcOpenAICost } from "@/lib/supabase/logger";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = await request.json();
    const { mainKeyword, subKeywords } = body;

    if (!mainKeyword || typeof mainKeyword !== "string") {
      return NextResponse.json(
        { error: "메인 키워드가 필요합니다." },
        { status: 400 }
      );
    }

    const subs: string[] = Array.isArray(subKeywords) ? subKeywords : [];
    const subList = subs.map((kw) => `- ${kw}`).join("\n");

    // 제목 10개 + 글 개요를 한번의 LLM 호출로 생성 (비용 최소화)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `당신은 네이버 블로그 SEO 및 수익화 전문가입니다.

## 메인 키워드
${mainKeyword}

## 서브 키워드
${subList}

## 요구사항

### 1. 돈 되는 콘텐츠 제목 10개
- 메인 키워드를 반드시 포함하되, 서브 키워드도 자연스럽게 섞어 다양성 확보
- 네이버 검색 사용자가 클릭하고 싶은 제목 (후기, 추천, 비교, 순위, TOP, 가격 등 활용)
- 서로 다른 패턴/톤의 제목으로 다양하게 생성 (리스트형, 비교형, 경험형, 정보형 등)
- 제목 길이: 20~40자

### 2. 글 전체 개요 1개
- 메인 키워드 + 서브 키워드를 자연스럽게 커버하는 블로그 글 구조
- 섹션 4~6개로 구성
- 각 섹션마다 핵심 포인트 2~3개 (bullet)

다음 JSON 형식으로 응답해주세요:
{
  "titles": ["제목1", "제목2", ...],
  "outline": {
    "title": "글 전체 제목",
    "sections": [
      {
        "heading": "섹션 제목",
        "points": ["포인트1", "포인트2", "포인트3"]
      }
    ]
  }
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM 응답이 비어있습니다.");
    }

    const parsed: {
      titles: string[];
      outline: { title: string; sections: { heading: string; points: string[] }[] };
    } = JSON.parse(content);

    const response: ProductionResponse = {
      titles: parsed.titles || [],
      outline: {
        title: parsed.outline?.title || mainKeyword,
        sections: (parsed.outline?.sections || []).map((s) => ({
          heading: s.heading,
          points: s.points || [],
        })),
      },
      generatedAt: new Date().toISOString(),
    };

    const totalTokens = {
      prompt_tokens: completion.usage?.prompt_tokens ?? 0,
      completion_tokens: completion.usage?.completion_tokens ?? 0,
    };
    logEvent("production", {
      main_keyword: mainKeyword,
      sub_keywords: subs.join(", "),
      openai_tokens: totalTokens.prompt_tokens + totalTokens.completion_tokens,
      openai_cost_usd: calcOpenAICost(totalTokens),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Production error:", error);

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
            : "콘텐츠 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
