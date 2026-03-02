import { NextRequest, NextResponse } from "next/server";

interface TrendDataPoint {
  period: string;
  ratio: number;
}

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();

    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "네이버 검색 API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 최근 12개월 트렌드 조회
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const body = {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      timeUnit: "month",
      keywordGroups: [
        { groupName: keyword, keywords: [keyword] },
      ],
    };

    const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DataLab API error:", err);
      return NextResponse.json({ error: "트렌드 조회 실패" }, { status: 500 });
    }

    const data = await res.json();
    const results: TrendDataPoint[] = data.results?.[0]?.data || [];

    // 마지막 달은 아직 진행 중이라 데이터가 낮으므로 제외
    const filtered = results.filter((d: TrendDataPoint) => {
      const periodDate = new Date(d.period);
      const now = new Date();
      return periodDate.getFullYear() !== now.getFullYear() || periodDate.getMonth() !== now.getMonth();
    });

    const trend = filtered.map((d: TrendDataPoint) => {
      const date = new Date(d.period);
      const month = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { month, ratio: Math.round(d.ratio * 10) / 10 };
    });

    return NextResponse.json({ keyword, trend });
  } catch (error) {
    console.error("Trend API error:", error);
    return NextResponse.json({ error: "트렌드 조회 중 오류 발생" }, { status: 500 });
  }
}
