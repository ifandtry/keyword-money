import { NextRequest, NextResponse } from "next/server";
import { BlogReference } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();
    if (!keyword || typeof keyword !== "string") {
      return NextResponse.json({ error: "키워드를 입력해주세요." }, { status: 400 });
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ blogs: [] });
    }

    const params = new URLSearchParams({
      query: keyword.trim(),
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

    if (!res.ok) {
      return NextResponse.json({ blogs: [] });
    }

    const data = await res.json();
    const items: {
      title: string;
      link: string;
      description: string;
      bloggername: string;
      postdate: string;
    }[] = (data.items || []).slice(0, 5);

    const blogs: BlogReference[] = items.map((item) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, "").slice(0, 150),
      bloggerName: item.bloggername,
      postDate: item.postdate
        ? `${item.postdate.slice(0, 4)}.${item.postdate.slice(4, 6)}.${item.postdate.slice(6, 8)}`
        : "",
    }));

    return NextResponse.json({ blogs });
  } catch {
    return NextResponse.json({ blogs: [] });
  }
}
