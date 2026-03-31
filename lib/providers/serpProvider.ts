import { SerpData, SerpProvider } from "@/types";
import {
  type ApiUsageContext,
  getProviderRequestCostKrw,
  logApiUsage,
} from "@/lib/supabase/apiUsageLogger";

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

// ── 네이버 SERP 크롤링 + 검색 API Provider ──

class NaverSerpProvider implements SerpProvider {
  private userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  private clientId: string;
  private clientSecret: string;
  private hasSearchApi: boolean;
  private usageContext?: ApiUsageContext;

  constructor(
    clientId?: string,
    clientSecret?: string,
    usageContext?: ApiUsageContext
  ) {
    this.clientId = clientId || "";
    this.clientSecret = clientSecret || "";
    this.hasSearchApi = !!(clientId && clientSecret);
    this.usageContext = usageContext;
  }

  async analyze(keywords: string[]): Promise<SerpData[]> {
    const CRAWL_LIMIT = 10;
    const results: SerpData[] = [];

    // 네이버 검색 API로 전체 키워드 총문서수 조회 (5개씩 batch, API 있을 때만)
    const docCounts: Map<string, number> = new Map();
    if (this.hasSearchApi) {
      const BATCH_SIZE = 5;
      for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
        const batch = keywords.slice(i, i + BATCH_SIZE);
        const counts = await Promise.all(
          batch.map(async (kw) => {
            try {
              const total = await this.fetchBlogTotal(kw);
              return { keyword: kw, total };
            } catch {
              return { keyword: kw, total: 0 };
            }
          })
        );
        counts.forEach((c) => docCounts.set(c.keyword, c.total));
        if (i + BATCH_SIZE < keywords.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      console.log(`[SERP] Fetched blog totals for ${keywords.length} keywords via Naver Search API`);
    }

    // SERP 크롤링 (상위 10개만)
    for (let i = 0; i < keywords.length; i++) {
      const totalDocCount = docCounts.get(keywords[i]) || 0;

      if (i < CRAWL_LIMIT) {
        try {
          const data = await this.crawlKeyword(keywords[i], totalDocCount);
          results.push(data);
        } catch (error) {
          console.error(`SERP crawl failed for "${keywords[i]}":`, error);
          results.push(this.estimateFromKeyword(keywords[i], totalDocCount));
        }
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
      } else {
        results.push(this.estimateFromKeyword(keywords[i], totalDocCount));
      }
    }

    return results;
  }

  private async fetchBlogTotal(keyword: string): Promise<number> {
    const params = new URLSearchParams({ query: keyword, display: "1" });
    const url = `https://openapi.naver.com/v1/search/blog.json?${params.toString()}`;
    const startedAt = Date.now();

    try {
      const res = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": this.clientId,
          "X-Naver-Client-Secret": this.clientSecret,
        },
      });

      const latencyMs = Date.now() - startedAt;

      if (!res.ok) {
        await this.logUsage(
          `http_${res.status}`,
          latencyMs,
          {
            endpoint: "/v1/search/blog.json",
            keyword,
            http_status: res.status,
          },
          getProviderRequestCostKrw("naver_search")
        );
        return 0;
      }

      const data = await res.json();
      await this.logUsage(
        "success",
        latencyMs,
        {
          endpoint: "/v1/search/blog.json",
          keyword,
          http_status: res.status,
          total: data.total || 0,
        },
        getProviderRequestCostKrw("naver_search")
      );

      return data.total || 0;
    } catch (error) {
      await this.logUsage(
        "error",
        Date.now() - startedAt,
        {
          endpoint: "/v1/search/blog.json",
          keyword,
          error_message: error instanceof Error ? error.message : "unknown_error",
        },
        getProviderRequestCostKrw("naver_search")
      );
      throw error;
    }
  }

  private async crawlKeyword(keyword: string, totalDocCount: number): Promise<SerpData> {
    const params = new URLSearchParams({
      where: "blog",
      query: keyword,
      sm: "tab_jum",
    });
    const url = `https://search.naver.com/search.naver?${params.toString()}`;
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          "Accept-Language": "ko-KR,ko;q=0.9",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        await this.logUsage(`http_${response.status}`, latencyMs, {
          endpoint: "/search.naver",
          keyword,
          http_status: response.status,
        });
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const blogRatio = this.analyzeBlogRatio(html);
      const commercialIntent = this.analyzeCommercialIntent(keyword, html);
      const competition = this.analyzeCompetition(keyword, html);

      await this.logUsage("success", latencyMs, {
        endpoint: "/search.naver",
        keyword,
        blog_ratio: blogRatio,
        commercial_intent: commercialIntent,
        competition,
      });

      console.log(`[SERP] "${keyword}" → docs=${totalDocCount.toLocaleString()}, blogRatio=${blogRatio}, comp=${competition}`);

      return {
        keyword,
        totalDocCount,
        blogPostCount: 0,
        blogRatio,
        commercialIntent,
        competition,
      };
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("HTTP "))) {
        await this.logUsage("error", Date.now() - startedAt, {
          endpoint: "/search.naver",
          keyword,
          error_message: error instanceof Error ? error.message : "unknown_error",
        });
      }
      throw error;
    }
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

    const hasNext = html.includes("btn_next");
    const hasPagination = html.includes("sc_page");
    if (hasNext) score += 0.3;
    else if (hasPagination) score += 0.15;

    return Number(Math.min(score + 0.05, 1).toFixed(2));
  }

  private estimateFromKeyword(keyword: string, totalDocCount: number): SerpData {
    const hasCommercial = COMMERCIAL_PATTERNS.some((p) => keyword.includes(p));
    const hash = simpleHash(keyword);

    return {
      keyword,
      totalDocCount,
      blogPostCount: 0,
      blogRatio: Number(((hash % 60) / 100 + 0.2).toFixed(2)),
      commercialIntent: Number(
        (hasCommercial ? 0.5 + (hash % 40) / 100 : 0.15 + (hash % 35) / 100).toFixed(2)
      ),
      competition: Number(((hash % 70) / 100 + 0.1).toFixed(2)),
    };
  }

  private async logUsage(
    status: string,
    latencyMs: number,
    metaJson: Record<string, unknown>,
    estimatedCostKrw = 0
  ) {
    if (!this.usageContext) return;

    await logApiUsage({
      provider: "naver_search",
      feature: this.usageContext.feature,
      requestId: this.usageContext.requestId,
      userId: this.usageContext.userId,
      estimatedCostKrw,
      status,
      latencyMs,
      metaJson,
    });
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

export function createSerpProvider(usageContext?: ApiUsageContext): SerpProvider {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (process.env.DISABLE_SERP_CRAWLING === "true") {
    console.log("[SerpProvider] Using Mock (crawling disabled)");
    return new MockSerpProvider();
  }

  if (clientId && clientSecret) {
    console.log("[SerpProvider] Using Naver SERP Crawler + Search API (blog total)");
  } else {
    console.log("[SerpProvider] Using Naver SERP Crawler (no Search API keys)");
  }

  return new NaverSerpProvider(clientId, clientSecret, usageContext);
}
