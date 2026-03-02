import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { TransformResponse } from "@/types";

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
    const { originalText, keywords } = body;

    if (!originalText || typeof originalText !== "string" || !originalText.trim()) {
      return NextResponse.json(
        { error: "변환할 글을 입력해주세요." },
        { status: 400 }
      );
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "키워드를 선택해주세요." },
        { status: 400 }
      );
    }

    const prompt = `당신은 네이버 블로그 SEO 전문가입니다.

아래 블로그 글에 수익성 높은 키워드를 자연스럽게 삽입하여 "돈 되는 글"로 변환해주세요.

## 삽입할 키워드
${keywords.map((k: string) => `- ${k}`).join("\n")}

## 원본 글
${originalText}

## 요구사항
1. 원본 글의 톤과 맥락을 유지하면서 키워드를 자연스럽게 녹여 넣을 것
2. 억지로 모든 키워드를 넣지 말고, 문맥에 맞는 것만 삽입할 것
3. 네이버 블로그 SEO에 최적화된 형태로 변환할 것
4. 과장이나 허위 내용 금지

다음 JSON 형식으로 응답해주세요:
{
  "transformedText": "변환된 전체 글 (마크다운)",
  "titles": [
    { "title": "추천 제목 1", "clickScore": 85, "reason": "클릭률 높은 이유" },
    { "title": "추천 제목 2", "clickScore": 78, "reason": "클릭률 높은 이유" },
    { "title": "추천 제목 3", "clickScore": 72, "reason": "클릭률 높은 이유" },
    { "title": "추천 제목 4", "clickScore": 68, "reason": "클릭률 높은 이유" },
    { "title": "추천 제목 5", "clickScore": 60, "reason": "클릭률 높은 이유" }
  ],
  "changes": ["변경사항 1", "변경사항 2"],
  "seoTips": ["SEO 팁 1", "SEO 팁 2"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI 응답이 비어있습니다.");
    }

    const parsed: TransformResponse = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Transform error:", error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "글 변환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
