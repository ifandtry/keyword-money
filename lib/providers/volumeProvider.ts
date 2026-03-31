import { VolumeData, VolumeProvider } from "@/types";
import {
  type ApiUsageContext,
  getProviderRequestCostKrw,
  logApiUsage,
} from "@/lib/supabase/apiUsageLogger";
import crypto from "crypto";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim();
}

function uniqueKeywordsByTrim(keywords: string[]): string[] {
  const seen = new Set<string>();

  return keywords.filter((keyword) => {
    const normalizedKeyword = normalizeKeyword(keyword);
    if (!normalizedKeyword || seen.has(normalizedKeyword)) return false;
    seen.add(normalizedKeyword);
    return true;
  });
}

// ── 네이버 검색광고 API Provider ──

function generateSignature(
  timestamp: string,
  method: string,
  path: string,
  secretKey: string
): string {
  const message = `${timestamp}.${method}.${path}`;
  return crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");
}

interface NaverKeywordResult {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  monthlyAvePcClkCnt: number | string;
  monthlyAveMobileClkCnt: number | string;
  monthlyAvePcCtr: number | string;
  monthlyAveMobileCtr: number | string;
  plAvgDepth: number | string;
  compIdx: string;
}

class NaverAdsVolumeProvider implements VolumeProvider {
  private customerId: string;
  private apiKey: string;
  private secretKey: string;
  private baseUrl = "https://api.searchad.naver.com";
  private usageContext?: ApiUsageContext;

  constructor(
    customerId: string,
    apiKey: string,
    secretKey: string,
    usageContext?: ApiUsageContext
  ) {
    this.customerId = customerId;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.usageContext = usageContext;
  }

  /**
   * 시드 키워드 1개를 보내면 네이버 API가 연관키워드 + 검색량을 한꺼번에 반환.
   * keywords 배열의 첫 번째를 시드로 사용.
   */
  async getVolume(keywords: string[]): Promise<VolumeData[]> {
    const seed = keywords[0];
    if (!seed) return [];

    try {
      // 1차: 원본 시드로 시도
      let results = await this.fetchKeywordTool(seed);

      // 2차: 결과 없으면 공백 제거 버전으로 재시도
      if (results.length === 0 && seed.includes(" ")) {
        const noSpace = seed.replace(/\s+/g, "");
        console.log(`[NaverAds] Retrying without spaces: "${noSpace}"`);
        results = await this.fetchKeywordTool(noSpace);
      }

      // 3차: 여전히 없으면 핵심 명사(첫 단어 or 가장 긴 단어)로 재시도
      if (results.length === 0 && seed.includes(" ")) {
        const words = seed.split(/\s+/);
        const coreWord = words.reduce((a, b) => (a.length >= b.length ? a : b));
        if (coreWord !== seed && coreWord !== seed.replace(/\s+/g, "")) {
          console.log(`[NaverAds] Retrying with core word: "${coreWord}"`);
          results = await this.fetchKeywordTool(coreWord);
        }
      }

      return results;
    } catch (error) {
      console.error("Naver Ads API failed, returning empty:", error);
      return [];
    }
  }

  async getExactVolumes(keywords: string[]): Promise<VolumeData[]> {
    const exactMatches = await Promise.all(
      uniqueKeywordsByTrim(keywords).map((keyword) => this.findExactVolume(keyword))
    );

    return exactMatches.filter((item): item is VolumeData => item !== null);
  }

  private async fetchKeywordTool(seed: string): Promise<VolumeData[]> {
    const path = "/keywordstool";
    const method = "GET";
    const timestamp = String(Date.now());
    const signature = generateSignature(
      timestamp,
      method,
      path,
      this.secretKey
    );

    const params = new URLSearchParams({
      hintKeywords: seed,
      showDetail: "1",
    });

    const url = `${this.baseUrl}${path}?${params.toString()}`;

    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": this.apiKey,
          "X-Customer": this.customerId,
          "X-Signature": signature,
        },
      });

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const errorText = await response.text();
        await this.logUsage(`http_${response.status}`, latencyMs, {
          endpoint: path,
          seed,
          http_status: response.status,
          error_text: errorText.slice(0, 500),
        });
        console.error(
          `Naver Ads API error (${response.status}):`,
          errorText
        );
        return [];
      }

      const data = await response.json();
      const keywordList: NaverKeywordResult[] = data.keywordList || [];

      await this.logUsage("success", latencyMs, {
        endpoint: path,
        seed,
        http_status: response.status,
        keyword_count: keywordList.length,
      });

      console.log(
        `[NaverAds] Seed "${seed}" → ${keywordList.length} keywords returned`
      );

      return keywordList.map((item) => {
        const pcVol = this.parseCount(item.monthlyPcQcCnt);
        const mobileVol = this.parseCount(item.monthlyMobileQcCnt);
        const cpc = this.estimateCpc(item);

        return {
          keyword: item.relKeyword,
          pcVolume: pcVol,
          mobileVolume: mobileVol,
          totalVolume: pcVol + mobileVol,
          cpc,
        };
      });
    } catch (error) {
      await this.logUsage("error", Date.now() - startedAt, {
        endpoint: path,
        seed,
        error_message: error instanceof Error ? error.message : "unknown_error",
      });
      throw error;
    }
  }

  private async findExactVolume(keyword: string): Promise<VolumeData | null> {
    const targetKeyword = normalizeKeyword(keyword);
    if (!targetKeyword) return null;

    const lookupSeeds = this.buildLookupSeeds(targetKeyword);

    for (const seed of lookupSeeds) {
      const results = await this.fetchKeywordTool(seed);
      const exactMatch = results.find(
        (item) => normalizeKeyword(item.keyword) === targetKeyword
      );

      if (exactMatch) {
        return {
          ...exactMatch,
          keyword: targetKeyword,
        };
      }
    }

    return null;
  }

  private buildLookupSeeds(keyword: string): string[] {
    const seeds = [keyword];

    if (!keyword.includes(" ")) {
      return seeds;
    }

    const noSpace = keyword.replace(/\s+/g, "");
    if (normalizeKeyword(noSpace) && !seeds.includes(noSpace)) {
      seeds.push(noSpace);
    }

    const words = keyword.split(/\s+/).filter((word) => word.length > 0);
    if (words.length > 0) {
      const coreWord = words.reduce((a, b) => (a.length >= b.length ? a : b));
      if (coreWord && !seeds.includes(coreWord)) {
        seeds.push(coreWord);
      }
    }

    return seeds;
  }

  private parseCount(value: number | string): number {
    if (typeof value === "number") return value;
    if (value === "< 10") return 5;
    const parsed = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  private estimateCpc(item: NaverKeywordResult): number {
    const compIdx = String(item.compIdx);
    const pcClicks = this.parseCount(item.monthlyAvePcClkCnt);
    const mobileClicks = this.parseCount(item.monthlyAveMobileClkCnt);
    const totalClicks = pcClicks + mobileClicks;

    let baseCpc: number;
    if (compIdx === "높음") baseCpc = 1500;
    else if (compIdx === "중간") baseCpc = 800;
    else baseCpc = 300;

    if (totalClicks > 1000) baseCpc *= 1.3;
    else if (totalClicks > 500) baseCpc *= 1.1;

    return Math.round(baseCpc);
  }

  private async logUsage(
    status: string,
    latencyMs: number,
    metaJson: Record<string, unknown>
  ) {
    if (!this.usageContext) return;

    await logApiUsage({
      provider: "naver_ads",
      feature: this.usageContext.feature,
      requestId: this.usageContext.requestId,
      userId: this.usageContext.userId,
      estimatedCostKrw: getProviderRequestCostKrw("naver_ads"),
      status,
      latencyMs,
      metaJson,
    });
  }
}

// ── Mock Provider (fallback) ──

class MockVolumeProvider implements VolumeProvider {
  async getVolume(keywords: string[]): Promise<VolumeData[]> {
    return keywords.map((keyword) => {
      const total =
        Math.round((500 + (simpleHash(keyword) % 9500)) / 10) * 10;
      const mobileRatio = 0.6 + (simpleHash(keyword + "_mr") % 26) / 100;
      const mobileVolume = Math.round((total * mobileRatio) / 10) * 10;
      const pcVolume = total - mobileVolume;
      return {
        keyword,
        pcVolume,
        mobileVolume,
        totalVolume: total,
        cpc: 100 + (simpleHash(keyword + "_cpc") % 2900),
      };
    });
  }

  async getExactVolumes(keywords: string[]): Promise<VolumeData[]> {
    return keywords
      .map((keyword) => normalizeKeyword(keyword))
      .filter((keyword) => keyword.length > 0)
      .map((keyword) => {
        const total =
          Math.round((500 + (simpleHash(keyword) % 9500)) / 10) * 10;
        const mobileRatio = 0.6 + (simpleHash(keyword + "_mr") % 26) / 100;
        const mobileVolume = Math.round((total * mobileRatio) / 10) * 10;
        const pcVolume = total - mobileVolume;

        return {
          keyword,
          pcVolume,
          mobileVolume,
          totalVolume: total,
          cpc: 100 + (simpleHash(keyword + "_cpc") % 2900),
        };
      });
  }
}

// ── Factory ──

export function createVolumeProvider(usageContext?: ApiUsageContext): VolumeProvider {
  const customerId = process.env.NAVER_ADS_CUSTOMER_ID;
  const apiKey = process.env.NAVER_ADS_API_KEY;
  const secretKey = process.env.NAVER_ADS_SECRET_KEY;

  if (customerId && apiKey && secretKey) {
    console.log("[VolumeProvider] Using Naver Ads API");
    return new NaverAdsVolumeProvider(customerId, apiKey, secretKey, usageContext);
  }

  console.log("[VolumeProvider] Using Mock (no Naver Ads credentials)");
  return new MockVolumeProvider();
}
