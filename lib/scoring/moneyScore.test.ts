/**
 * MoneyScore 테스트
 * 실행: npx tsx lib/scoring/moneyScore.test.ts
 */

import {
  calculateMoneyScore,
  getCommercialWeight,
  calculateVolumeWeight,
  calculateFinalScore,
  filterKeywords,
  selectMainAndSub,
  MoneyScoreResult,
} from "./moneyScore";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) < tolerance;
}

// ── moneyScore 계산 ──
console.log("\n=== moneyScore 계산 ===");

assert(calculateMoneyScore(0, 0) === 0, "volume=0, docs=0 → 0");
assert(calculateMoneyScore(1000, 0) === 0, "docs=0 → 0 (log(1)=0이므로)");

const ms1 = calculateMoneyScore(5000, 10000);
// log(5001) / log(10001) ≈ 8.517 / 9.210 ≈ 0.9248
assert(approxEqual(ms1, 0.9248, 0.01), `volume=5000, docs=10000 → ${ms1.toFixed(4)} ≈ 0.9248`);

const ms2 = calculateMoneyScore(500, 100000);
// log(501) / log(100001) ≈ 6.217 / 11.513 ≈ 0.540
assert(approxEqual(ms2, 0.54, 0.01), `volume=500, docs=100000 → ${ms2.toFixed(4)} ≈ 0.54`);

const ms3 = calculateMoneyScore(10000, 1000);
// log(10001) / log(1001) ≈ 9.210 / 6.909 ≈ 1.333
assert(approxEqual(ms3, 1.333, 0.01), `volume=10000, docs=1000 → ${ms3.toFixed(4)} ≈ 1.333 (블루오션)`);

// ── Commercial Weight ──
console.log("\n=== Commercial Weight ===");

assert(getCommercialWeight("강아지 간식").weight === 1.0, "상업 토큰 0개 → 1.0");
assert(getCommercialWeight("에어컨 추천").weight === 1.2, "상업 토큰 1개(추천) → 1.2");
assert(getCommercialWeight("에어컨 추천 가격 비교").weight === 1.35, "상업 토큰 3개 → 1.35");
assert(getCommercialWeight("쿠폰 할인").weight === 1.35, "상업 토큰 2개(쿠폰,할인) → 1.35");

const cw = getCommercialWeight("에어컨 추천 가격");
assert(cw.tokens.length === 2, `토큰: ${cw.tokens.join(",")} (추천,가격)`);

// ── Volume Weight ──
console.log("\n=== Volume Weight ===");

const vw1 = calculateVolumeWeight(300);
assert(approxEqual(vw1, Math.log(301), 0.001), `volume=300 → ${vw1.toFixed(4)}`);

const vw2 = calculateVolumeWeight(10000);
assert(approxEqual(vw2, Math.log(10001), 0.001), `volume=10000 → ${vw2.toFixed(4)}`);

// ── FinalScore 통합 ──
console.log("\n=== FinalScore 통합 ===");

const r1 = calculateFinalScore({ keyword: "다이어트 식단", volume: 5000, docs: 10000 });
// moneyScore ≈ 0.9248, commercialWeight = 1.0, volumeWeight = log(5001) ≈ 8.517
// finalScore ≈ 0.9248 * 1.0 * 8.517 ≈ 7.876
console.log(`  다이어트 식단: moneyScore=${r1.moneyScore}, finalScore=${r1.finalScore}`);
assert(r1.commercialWeight === 1.0, "상업 토큰 없음 → 1.0");
assert(r1.finalScore > 7, "finalScore > 7");

const r2 = calculateFinalScore({ keyword: "에어컨 추천 가격", volume: 3000, docs: 5000 });
// commercialWeight = 1.35 (추천 + 가격)
console.log(`  에어컨 추천 가격: moneyScore=${r2.moneyScore}, finalScore=${r2.finalScore}, cw=${r2.commercialWeight}`);
assert(r2.commercialWeight === 1.35, "상업 토큰 2개 → 1.35");
assert(r2.finalScore > r1.finalScore * 0.5, "상업 키워드 가중치 효과 확인");

// ── 필터링 ──
console.log("\n=== 필터링 ===");

const items: MoneyScoreResult[] = [
  calculateFinalScore({ keyword: "A", volume: 100, docs: 1000 }),   // volume < 300 → 제거
  calculateFinalScore({ keyword: "B", volume: 500, docs: 3000 }),   // OK
  calculateFinalScore({ keyword: "C", volume: 1000, docs: 60000 }), // docs > 50000 → 제거
  calculateFinalScore({ keyword: "D", volume: 2000, docs: 10000 }), // OK
];

const filtered = filterKeywords(items, 300, 50000);
assert(filtered.length === 2, `필터 후 2개 (${filtered.map(i => i.keyword).join(",")})`);
assert(filtered.some(i => i.keyword === "B"), "B 포함");
assert(filtered.some(i => i.keyword === "D"), "D 포함");

// ── 메인/서브 선정 ──
console.log("\n=== 메인/서브 선정 ===");

const candidates: MoneyScoreResult[] = [
  calculateFinalScore({ keyword: "강아지 간식", volume: 5000, docs: 3000 }),
  calculateFinalScore({ keyword: "강아지 간식 추천", volume: 3000, docs: 2000 }),
  calculateFinalScore({ keyword: "강아지 사료", volume: 8000, docs: 20000 }),
  calculateFinalScore({ keyword: "고양이 사료", volume: 4000, docs: 5000 }),  // 관련 없음
  calculateFinalScore({ keyword: "강아지 간식 가격 비교", volume: 1000, docs: 500 }),
];

const { main, subs } = selectMainAndSub(candidates);
console.log(`  메인: ${main?.keyword} (finalScore=${main?.finalScore})`);
console.log(`  서브: ${subs.map(s => `${s.keyword}(${s.finalScore})`).join(", ")}`);
assert(main !== null, "메인 선정됨");
assert(subs.length > 0 && subs.length <= 3, `서브 1~3개 (${subs.length}개)`);
assert(!subs.some(s => s.keyword === "고양이 사료"), "고양이 사료는 관련성 낮아 제외");

// relatedKeywords에 포함되면 토큰 겹치지 않아도 서브로 가능
const { subs: subs2 } = selectMainAndSub(candidates, new Set(["고양이 사료"]));
console.log(`  relatedKeywords에 고양이 사료 추가 시 서브: ${subs2.map(s => s.keyword).join(", ")}`);

// ── 결과 ──
console.log(`\n=== 결과: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
