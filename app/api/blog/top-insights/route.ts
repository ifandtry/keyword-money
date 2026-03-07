import { NextRequest, NextResponse } from "next/server";
import { analyzeTopPosts } from "@/lib/blog/analyzer";
import { logEvent } from "@/lib/supabase/logger";

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json();

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json(
        { error: "키워드를 입력해주세요" },
        { status: 400 }
      );
    }

    const result = await analyzeTopPosts(keyword.trim());
    logEvent("blog_top_insights", { keyword: keyword.trim(), successCount: result.successCount });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "분석 중 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
