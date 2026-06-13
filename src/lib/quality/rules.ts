export const forbiddenInvestmentPhrases = [
  "무조건 매수",
  "급등 확정",
  "수익 보장",
  "지금 사야",
  "손실 없음",
  "100% 적중"
];

export function findForbiddenPhrases(text: string, phrases = forbiddenInvestmentPhrases): string[] {
  return phrases.filter((phrase) => text.includes(phrase));
}
