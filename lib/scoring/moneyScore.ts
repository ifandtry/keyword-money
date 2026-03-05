/**
 * MoneyScore 계산 모듈
 *
 * moneyScore = log(volume + 1) / log(docs + 1)
 * commercialWeight: 상업적 의도 토큰 기반 가중치
 * volumeWeight = log(volume + 1)
 * finalScore = moneyScore * commercialWeight * volumeWeight
 */

const COMMERCIAL_TOKENS = [
  "추천", "가격", "비용", "후기", "비교", "순위",
  "TOP", "할인", "예약", "구매", "상품", "쿠폰",
];

export interface MoneyScoreInput {
  keyword: string;
  volume: number;
  docs: number;
}

export interface MoneyScoreResult {
  keyword: string;
  volume: number;
  docs: number;
  moneyScore: number;
  commercialWeight: number;
  volumeWeight: number;
  finalScore: number;
  commercialTokens: string[];
}

export function calculateMoneyScore(volume: number, docs: number): number {
  const logDocs = Math.log(docs + 1);
  if (logDocs <= 0) return 0;
  return Math.log(volume + 1) / logDocs;
}

export function getCommercialWeight(keyword: string): {
  weight: number;
  tokens: string[];
} {
  const matched = COMMERCIAL_TOKENS.filter((token) =>
    keyword.includes(token)
  );
  let weight = 1.0;
  if (matched.length >= 2) weight = 1.35;
  else if (matched.length >= 1) weight = 1.2;
  return { weight, tokens: matched };
}

export function calculateVolumeWeight(volume: number): number {
  return Math.log(volume + 1);
}

export function calculateFinalScore(input: MoneyScoreInput): MoneyScoreResult {
  const moneyScore = calculateMoneyScore(input.volume, input.docs);
  const { weight: commercialWeight, tokens: commercialTokens } =
    getCommercialWeight(input.keyword);
  const volumeWeight = calculateVolumeWeight(input.volume);
  const finalScore = moneyScore * commercialWeight * volumeWeight;

  return {
    keyword: input.keyword,
    volume: input.volume,
    docs: input.docs,
    moneyScore: Number(moneyScore.toFixed(4)),
    commercialWeight,
    volumeWeight: Number(volumeWeight.toFixed(4)),
    finalScore: Number(finalScore.toFixed(4)),
    commercialTokens,
  };
}

export function filterKeywords(
  items: MoneyScoreResult[],
  minVolume = 300,
  maxDocs = 50000
): MoneyScoreResult[] {
  return items.filter(
    (item) =>
      item.volume >= minVolume &&
      item.docs <= maxDocs &&
      Math.log(item.docs + 1) > 0
  );
}

export function selectMainAndSub(
  candidates: MoneyScoreResult[],
  relatedKeywords: Set<string> = new Set()
): { main: MoneyScoreResult | null; subs: MoneyScoreResult[] } {
  if (candidates.length === 0) return { main: null, subs: [] };

  const sorted = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
  const main = sorted[0];

  const mainTokens = main.keyword
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const subs = sorted
    .slice(1)
    .filter((candidate) => {
      const hasTokenOverlap = mainTokens.some((token) =>
        candidate.keyword.includes(token)
      );
      const isRelated = relatedKeywords.has(candidate.keyword);
      return hasTokenOverlap || isRelated;
    })
    .slice(0, 3);

  return { main, subs };
}
