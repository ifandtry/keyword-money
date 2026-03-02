import { SerpData, SerpProvider } from "@/types";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const COMMERCIAL_PATTERNS = [
  "추천", "가격", "비교", "후기", "구매", "할인", "순위",
  "최저가", "쿠폰", "브랜드", "리뷰", "사용기", "효과", "성분",
];

// ── 네이버 SERP 크롤링 Provider ──
// 전략: 상위 10개만 크롤링 (blogRatio, commercialIntent, competition)
// totalDocCount는 네이버 검색 OpenAPI 연결 시 활성화 예정

class NaverSerpProvider implements SerpProvider {
  private userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  async analyze(keywords: string[]): Promise<SerpData[]> {
    const CRAWL_LIMIT = 10;
    const results: SerpData[] = [];

    for (let i = 0; i < keywords.length; i++) {
      if (i < CRAWL_LIMIT) {
        try {
          const data = await this.crawlKeyword(keywords[i]);
          results.push(data);
        } catch (error) {
          console.error(`SERP crawl failed for "${keywords[i]}":`, error);
          results.push(this.estimateFromKeyword(keywords[i]));
        }
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
      } else {
        results.push(this.estimateFromKeyword(keywords[i]));
      }
    }

    return results;
  }

  private async crawlKeyword(keyword: string): Promise<SerpData> {
    const params = new URLSearchParams({
      where: "blog",
      query: keyword,
      sm: "tab_jum",
    });
    const url = `https://search.naver.com/search.naver?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        "Accept-Language": "ko-KR,ko;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const blogRatio = this.analyzeBlogRatio(html);
    const commercialIntent = this.analyzeCommercialIntent(keyword, html);
    const competition = this.analyzeCompetition(keyword, html);

    console.log(`[SERP] "${keyword}" → blogRatio=${blogRatio}, ci=${commercialIntent}, comp=${competition}`);

    return {
      keyword,
      totalDocCount: 0,
      blogPostCount: 0,
      blogRatio,
      commercialIntent,
      competition,
    };
  }

  private analyzeBlogRatio(html: string): number {
    const blogDomains = ["blog.naver.com", "m.blog.naver.com", "tistory.com", "velog.io", "brunch.co.kr"];
    const allLinks = html.match(/href="(https?:\/\/[^"]+)"/g) || [];

    const contentLinks = allLinks.filter(
      (link) =>
        !link.includes("search.naver.com") &&
        !link.includes("ader.naver.com") &&
        !link.includes("javascript") &&
        !link.includes("naver.com/search")
    );

    if (contentLinks.length === 0) return 0.5;

    const blogLinks = contentLinks.filter((link) =>
      blogDomains.some((domain) => link.includes(domain))
    );

    return Number(Math.min(blogLinks.length / Math.max(contentLinks.length, 1), 1).toFixed(2));
  }

  private analyzeCommercialIntent(keyword: string, html: string): number {
    let score = 0;

    const commercialHits = COMMERCIAL_PATTERNS.filter((p) => keyword.includes(p)).length;
    score += Math.min(commercialHits * 0.2, 0.5);

    const signals = ["shopping", "ad_section", "price", "최저가", "쇼핑", "구매", "할인", "무료배송"];
    const signalHits = signals.filter((s) => html.includes(s)).length;
    score += Math.min(signalHits * 0.05, 0.4);

    return Number(Math.min(score + 0.1, 1).toFixed(2));
  }

  private analyzeCompetition(keyword: string, html: string): number {
    let score = 0;

    if (html.includes("ad_section") || html.includes("pwl_nop")) {
      score += 0.2;
    }

    if (keyword.length <= 4) score += 0.2;
    else if (keyword.length <= 8) score += 0.1;

    // 페이지네이션 깊이로 경쟁도 추정
    const hasNext = html.includes("btn_next");
    const hasPagination = html.includes("sc_page");
    if (hasNext) score += 0.3;
    else if (hasPagination) score += 0.15;

    return Number(Math.min(score + 0.05, 1).toFixed(2));
  }

  private estimateFromKeyword(keyword: string): SerpData {
    const hasCommercial = COMMERCIAL_PATTERNS.some((p) => keyword.includes(p));
    const hash = simpleHash(keyword);

    return {
      keyword,
      totalDocCount: 0,
      blogPostCount: 0,
      blogRatio: Number(((hash % 60) / 100 + 0.2).toFixed(2)),
      commercialIntent: Number(
        (hasCommercial ? 0.5 + (hash % 40) / 100 : 0.15 + (hash % 35) / 100).toFixed(2)
      ),
      competition: Number(((hash % 70) / 100 + 0.1).toFixed(2)),
    };
  }
}

// ── Mock Provider (fallback) ──

class MockSerpProvider implements SerpProvider {
  async analyze(keywords: string[]): Promise<SerpData[]> {
    return keywords.map((keyword) => {
      const hasCommercial = COMMERCIAL_PATTERNS.some((p) => keyword.includes(p));
      const baseCI = hasCommercial ? 0.6 : 0.2;

      return {
        keyword,
        totalDocCount: 0,
        blogPostCount: 0,
        blogRatio: Number(((simpleHash(keyword + "_blog") % 80) / 100 + 0.1).toFixed(2)),
        commercialIntent: Number((baseCI + (simpleHash(keyword + "_ci") % 30) / 100).toFixed(2)),
        competition: Number(((simpleHash(keyword + "_comp") % 90) / 100 + 0.05).toFixed(2)),
      };
    });
  }
}

// ── Factory ──

export function createSerpProvider(): SerpProvider {
  if (process.env.DISABLE_SERP_CRAWLING === "true") {
    console.log("[SerpProvider] Using Mock (crawling disabled)");
    return new MockSerpProvider();
  }

  console.log("[SerpProvider] Using Naver SERP Crawler");
  return new NaverSerpProvider();
}
