import { NextResponse } from "next/server";
import { TrendingCategory } from "@/types";

interface KeywordRank {
  rank: number;
  keyword: string;
  linkId: string;
}

interface DataLabResponse {
  statusCode: number;
  returnCode: number;
  range: string;
  ranks: KeywordRank[];
}

const CATEGORIES = [
  { cid: "50000008", name: "생활/건강" },
  { cid: "50000009", name: "여가/생활편의" },
  { cid: "50000006", name: "식품" },
  { cid: "50000002", name: "화장품/미용" },
  { cid: "50000003", name: "디지털/가전" },
  { cid: "50000004", name: "가구/인테리어" },
  { cid: "50000007", name: "스포츠/레저" },
  { cid: "50000005", name: "출산/육아" },
];

async function fetchCategoryKeywords(
  cid: string,
  dateStr: string
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      cid,
      timeUnit: "date",
      startDate: dateStr,
      endDate: dateStr,
      page: "1",
      count: "5",
      age: "",
      gender: "",
      device: "",
    });

    const res = await fetch(
      "https://datalab.naver.com/shoppingInsight/getCategoryKeywordRank.naver",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded; charset=UTF-8",
          Referer:
            "https://datalab.naver.com/shoppingInsight/sCategory.naver",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: params.toString(),
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return [];
    const data: DataLabResponse = await res.json();
    return (data.ranks || []).map((r) => r.keyword);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // 모든 카테고리를 병렬로 가져오기
    const results = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const keywords = await fetchCategoryKeywords(cat.cid, dateStr);
        return { name: cat.name, keywords };
      })
    );

    // 키워드가 있는 카테고리만 반환
    const categories: TrendingCategory[] = results.filter(
      (c) => c.keywords.length > 0
    );

    // 하위 호환: 기존 `keywords` 필드도 유지 (첫 카테고리 또는 전체 합산)
    const allKeywords = categories.flatMap((c) => c.keywords);
    const uniqueKeywords = [...new Set(allKeywords)].slice(0, 10);

    return NextResponse.json({ keywords: uniqueKeywords, categories });
  } catch (error) {
    console.error("Trending API error:", error);
    return NextResponse.json({ keywords: [], categories: [] });
  }
}
