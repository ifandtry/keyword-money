const SUFFIXES = [
  "추천",
  "가격",
  "비교",
  "후기",
  "순위",
  "방법",
  "효과",
  "부작용",
  "사용법",
  "장단점",
  "종류",
  "브랜드",
  "인기",
  "최저가",
  "할인",
  "정보",
  "구매",
  "선택",
  "팁",
  "주의사항",
  "효능",
  "성분",
  "원리",
  "차이",
  "대안",
  "초보",
  "입문",
  "전문가",
  "2026",
];

export function generateRelatedKeywords(seed: string): string[] {
  const keywords = [seed];
  for (const suffix of SUFFIXES) {
    keywords.push(`${seed} ${suffix}`);
    if (keywords.length >= 30) break;
  }
  return keywords.slice(0, 30);
}
