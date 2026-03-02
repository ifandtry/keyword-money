import { KeywordItem, VolumeData, SerpData } from "@/types";

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function calculateGrade(score: number): KeywordItem["grade"] {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  if (score >= 30) return "C";
  return "D";
}

// 포화도: 총문서수 / 월간 검색량 — 낮을수록 블루오션
function calculateSaturation(
  totalDocCount: number,
  totalVolume: number
): number {
  if (totalVolume === 0) return 999;
  return Number((totalDocCount / totalVolume).toFixed(1));
}

function generateReason(params: {
  volumeScore: number;
  saturation: number;
  hasDocs: boolean;
}): string {
  const parts: string[] = [];

  if (params.volumeScore > 0.7) parts.push("검색량 높음");
  else if (params.volumeScore < 0.3) parts.push("검색량 낮음");

  if (params.hasDocs) {
    if (params.saturation < 5) parts.push("블루오션(문서 적음)");
    else if (params.saturation < 20) parts.push("기회 있음");
    else if (params.saturation > 50) parts.push("레드오션(문서 많음)");
  }

  return parts.length > 0 ? parts.join(", ") : "보통 수준";
}

export function calculateProfitScore(
  volume: VolumeData,
  serp: SerpData
): KeywordItem {
  const volumeScore = normalize(volume.totalVolume, 0, 10000);
  const hasDocs = serp.totalDocCount > 0;
  const saturation = hasDocs
    ? calculateSaturation(serp.totalDocCount, volume.totalVolume)
    : 0;

  let rawScore: number;
  if (hasDocs) {
    // 포화도 낮을수록(블루오션) 점수 높음
    const saturationScore = 1 - normalize(saturation, 0, 100);
    rawScore =
      volumeScore * 0.4 +
      saturationScore * 0.6;
  } else {
    // 문서수 없을 때 검색량만으로 판단
    rawScore = volumeScore;
  }

  const profitScore = Math.round(Math.max(0, Math.min(100, rawScore * 100)));
  const grade = calculateGrade(profitScore);
  const reason = generateReason({
    volumeScore,
    saturation,
    hasDocs,
  });

  return {
    keyword: volume.keyword,
    pcVolume: volume.pcVolume,
    mobileVolume: volume.mobileVolume,
    totalVolume: volume.totalVolume,
    cpc: volume.cpc,
    totalDocCount: serp.totalDocCount,
    saturation,
    competition: serp.competition,
    commercialIntent: serp.commercialIntent,
    blogRatio: serp.blogRatio,
    profitScore,
    grade,
    reason,
  };
}
