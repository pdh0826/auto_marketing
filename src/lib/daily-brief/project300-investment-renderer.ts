import { buildProject300CategoryLinks } from "@/lib/tistory/project300";
import type { InvestmentJudgmentLedger, InvestmentWritingEvidencePack } from "./investment-writing-contract";
import type { InvestmentWritingOutline, InvestmentStockNarrativeAssignment } from "./investment-writing-outline";
import type { DailyBriefEtfPick, DailyBriefOfficialDisclosureItem, DailyBriefResearchItem, DailyBriefStockPick } from "./types";

const UPSIGNAL_LINK = "[급등포착](https://upsignal.co.kr/)";

export function renderProject300InvestmentPost(input: {
  title: string;
  evidencePack: InvestmentWritingEvidencePack;
  judgmentLedger: InvestmentJudgmentLedger;
  outline: InvestmentWritingOutline;
  stocks: DailyBriefStockPick[];
  etfs: DailyBriefEtfPick[];
  researchItems: DailyBriefResearchItem[];
  disclosureItems: DailyBriefOfficialDisclosureItem[];
  heroMedia: string;
  stockMediaByCode: Map<string, string>;
  etfMedia: string | null;
}) {
  if (!input.stocks.length && input.etfs.length) {
    return renderEtfOnlyPost(input);
  }
  const sections = input.outline.stockAssignments
    .filter((assignment) => assignment.role !== "table_only")
    .map((assignment) => renderStockAssignment(input, assignment))
    .filter(Boolean);
  const etfSection = input.outline.includeEtfSection ? renderEtfSection(input) : "";
  const judgmentOpening = renderJudgmentOpening(input.judgmentLedger, input.outline.centerJudgment);
  const temporal = input.evidencePack.temporalContext;
  const marketDateLabel = temporal.dataDate.replaceAll("-", ".");
  const links = buildProject300CategoryLinks();

  return `# ${input.title}

${input.heroMedia}

## ${buildOpeningHeading(input.outline)}

이 글은 ${marketDateLabel} ${UPSIGNAL_LINK} 화면에 잡힌 신호와 확인된 자료를 정리해서, 오늘 시장에서 눈에 띄는 투자 흐름을 찾아보겠습니다. ${temporal.isWeekend ? `${temporal.dataWeekday}에 지난 거래일 신호를 다시 살펴보는 글입니다.` : "당일 시장에서 어떤 종목이 먼저 움직였는지 차근차근 살펴보겠습니다."}

${buildNaturalOpening(input.outline, input.stocks)}${judgmentOpening ? ` ${judgmentOpening}` : ""}

오늘 살펴볼 종목은 ${joinNames(input.stocks.map((stock) => stock.name))}입니다. 먼저 현재가와 시스템 목표가가 어느 정도 차이 나는지 표에서 한 번 살펴보겠습니다.

## ${marketDateLabel} 급등포착 신호 요약

| 종목 | 최근 신호 | 현재가 | 시스템 진입가 | 시스템 목표가 | 시스템 손절선 | 점수 |
| --- | --- | --- | --- | --- | --- | --- |
${input.stocks.map(renderStockRow).join("\n")}

${renderCompactReviewBridge(input.stocks)}

진입가·목표가·손절선은 ${UPSIGNAL_LINK} 시스템에서 계산한 값입니다. 나름 의미 있는 기준이지만 이것만으로 결론을 내리기보다는, 아래 차트에서 가격 흐름과 함께 더 자세히 볼까요? 실제 진입 시점에 매매 계획을 세울 때 참고하는 기준으로 보면 딱 좋겠습니다.

${sections.join("\n\n")}

${etfSection}

${renderPracticalFaq(input.stocks)}

## 다음 거래일에 확인할 내용

${renderNextConditions(input.judgmentLedger, input.outline)}

${input.evidencePack.channel === "project300_tistory" ? renderCrossLinks(links) : ""}

## 마무리

신호가 좋아 보여도 실제 가격과 거래량이 따라오지 않으면 결과는 달라질 수 있습니다. 반대로 비슷해 보이는 종목이라도 업종 수급과 개별 재료에 따라 움직임은 갈립니다. 이번 기록은 다음 거래일에 무엇을 다시 볼지 정리하는 데 의미를 두었습니다.

혹시 손실이 잦다면 혼자 감으로 거래하기보다, ${UPSIGNAL_LINK}에서 진입가·목표가·손절선과 매매 타점을 먼저 확인해 보시는 것도 좋겠습니다. 신호를 그대로 따라가라는 뜻이 아니라, 들어갈 자리와 멈출 자리를 미리 정해보자는 의미입니다.

이 글은 시스템 신호와 공개 자료를 정리한 개인 기록입니다. 실제 매매 판단은 가격, 거래량, 공시와 각자의 손실 기준을 함께 확인한 뒤 결정해야 합니다.
`;
}

function renderEtfOnlyPost(input: Parameters<typeof renderProject300InvestmentPost>[0]) {
  const temporal = input.evidencePack.temporalContext;
  const marketDateLabel = temporal.dataDate.replaceAll("-", ".");
  const picks = input.etfs.slice(0, 5);
  const lead = picks[0];
  const categories = Array.from(new Set(picks.map((item) => item.category).filter((item): item is string => Boolean(item))));
  const links = buildProject300CategoryLinks();

  return `# ${input.title}

${input.heroMedia}

## 오늘 ETF 순위에서 먼저 눈에 들어온 흐름

이 글은 ${marketDateLabel} ${UPSIGNAL_LINK} ETF 보드에 표시된 상품을 기준으로 작성했습니다. 개별 종목만 보고 있으면 놓치기 쉬운 시장의 큰 방향을 ETF 순위에서 한 번 더 살펴보겠습니다.${temporal.isWeekend ? ` ${temporal.dataWeekday}에 지난 거래일 순위를 다시 확인한 기록입니다.` : ""}

오늘 상위권에는 ${joinNames(picks.map((item) => item.name))}이 올라왔습니다. 카테고리로 나눠보면 ${joinNames(categories)} 흐름이 눈에 띕니다. 한 상품의 점수만 보기보다 비슷한 성격의 ETF가 함께 올라왔는지부터 보면 시장이 어디를 편하게 보고 있는지 조금 더 잘 보입니다.

## ${marketDateLabel} ETF 상위 5개 요약

| 순위 | ETF | 카테고리 | 현재가 | 목표여력 | 최근매수 | 현재수익률 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${picks.map((pick) => `| ${pick.rank} | ${pick.name} | ${pick.category ?? "-"} | ${pick.currentPrice ?? "-"} | ${pick.targetPotential ?? "-"} | ${pick.recentBuyDate ?? "-"} | ${pick.currentReturn ?? "-"} | ${pick.totalScore ?? "-"} |`).join("\n")}

${input.etfMedia ?? ""}

표를 보면 ${lead?.name ?? "상위 ETF"}이 가장 먼저 보입니다. 다만 ETF는 이름이 비슷해도 추종 지수, 환헤지 여부, 배당 방식에 따라 실제 움직임이 달라집니다. 그래서 순위 다음에는 상품명 안에 어떤 시장과 전략이 들어 있는지를 확인하는 편이 좋습니다.

## 상위권이 말해주는 시장 분위기

ETF 순위는 개별 종목 추천 목록과 조금 다르게 봐야 합니다. 미국 대표지수 상품이 여러 개 함께 올라오면 특정 기업 하나의 재료보다 해외 대형주 전반의 흐름이 강하다는 뜻에 가깝습니다. 배당이나 인컴 상품이 많다면 빠른 시세 차익보다 현금흐름을 선호하는 수요가 늘었는지도 생각해 볼 수 있습니다.

오늘처럼 ${categories[0] ?? "비슷한 성격"} 상품이 겹쳐 보이는 날에는 서로 다른 상품을 여러 개 사는 것이 실제 분산인지도 확인해야 합니다. 이름은 달라도 같은 지수를 따라가거나 상위 편입 종목이 겹치면, 계좌에서는 사실상 같은 방향에 투자하는 셈이 될 수 있기 때문입니다.

## 최근매수 날짜와 현재 위치를 같이 봅니다

최근매수 날짜는 시스템에서 조건이 포착된 시점입니다. 날짜가 가깝다고 무조건 좋은 것은 아니지만, 신호 이후 가격이 얼마나 움직였는지 확인하는 출발점으로는 쓸 만합니다. 이미 짧은 기간에 많이 오른 상품이라면 다음 눌림을 기다리는 편이 나을 수 있고, 신호 가격 부근에서 버티고 있다면 추세가 이어지는지 다시 볼 이유가 생깁니다.

현재수익률이 표시된 상품은 신호 이후 흐름을 읽는 참고값으로 보겠습니다. 수익률 숫자 하나만 보고 따라가기보다 거래량이 함께 늘었는지, 추종 시장의 현물과 선물 방향이 같은지, 환율이 수익률에 어떤 영향을 주는지도 같이 봐야 합니다.

## 미국 ETF는 지수와 환율을 따로 확인합니다

미국 지수 ETF는 미국장 종가만 보면 끝나는 상품이 아닙니다. 국내 거래시간에는 나스닥과 S&P500 선물, 원·달러 환율, 전날 미국 기술주 흐름이 가격에 함께 반영됩니다. 특히 같은 지수를 추종하더라도 환헤지형과 환노출형은 원화 움직임에 따라 체감 수익률이 달라질 수 있습니다.

그래서 미국 대표지수 상품이 상위권에 여러 개 올라온 날에는 “미국장이 좋았다”에서 멈추지 않고, 국내 개장 전에 선물이 그 흐름을 이어가는지 한 번 더 확인하겠습니다. 전날 강세가 이미 국내 ETF 가격에 충분히 반영됐다면 장 초반 추격은 부담이 될 수도 있습니다.

## 배당·인컴 ETF는 분배금만 보면 아쉽습니다

배당과 인컴 상품은 분배율이 눈에 잘 띄지만, 기초자산 가격이 약하면 분배금을 받아도 전체 수익률은 기대에 못 미칠 수 있습니다. 최근매수 신호가 나온 배당 ETF라면 편입 업종의 실적과 금리 방향, 분배 정책이 함께 유지되는지 확인하겠습니다.

커버드콜 상품이라면 상승장에서 수익 상단이 제한될 수 있다는 점도 빼놓기 어렵습니다. 시장이 빠르게 오르는 구간과 횡보하는 구간에서 상품의 장단점이 달라지므로, 단순히 목표여력 숫자만 비교하기보다 지금 장세와 전략이 맞는지를 먼저 보는 편이 낫습니다.

## 다음 거래일에는 이것부터 보겠습니다

- 상위 ETF와 같은 지수를 추종하는 상품이 순위에 반복해서 나타나는지 확인합니다.
- 최근매수 날짜 이후 가격과 거래량이 함께 유지되는지 살펴봅니다.
- 미국 지수 상품은 선물 방향과 원·달러 환율을 같이 확인합니다.
- 배당·인컴 상품은 분배율뿐 아니라 기초자산 가격과 총수익률을 비교합니다.
- 편입 종목이 크게 겹치는 ETF를 여러 개 보유하고 있지는 않은지 점검합니다.

## ETF를 볼 때 자주 묻는 질문

### 점수가 가장 높은 ETF를 바로 고르면 될까요?

점수는 여러 상품을 빠르게 비교하는 출발점입니다. 실제 선택 전에는 최근매수 이후 가격이 얼마나 움직였는지, 추종 지수와 편입 종목이 무엇인지까지 확인하는 편이 좋습니다. 같은 점수라도 이미 크게 오른 상품과 신호 가격 부근에 남아 있는 상품의 부담은 다릅니다.

### 이름이 다른 ETF를 여러 개 사면 분산이 되나요?

반드시 그렇지는 않습니다. 미국 대표지수 ETF처럼 상품명은 달라도 상위 편입 종목이 크게 겹칠 수 있습니다. 운용사와 상품명이 아니라 실제 추종 지수와 편입 비중을 비교해야 계좌 안의 중복 노출을 알 수 있습니다.

### 미국 ETF는 국내장 시작 전에 무엇을 확인해야 할까요?

전날 미국 현물시장 흐름과 함께 나스닥·S&P500 선물, 원·달러 환율을 보겠습니다. 국내 거래가격에는 밤사이 움직임이 먼저 반영될 수 있으므로, 장 초반 가격이 전날 종가에서 얼마나 벌어졌는지도 같이 확인하는 편이 좋습니다.

## 이어서 볼 기록

- [${links.dailyStockReview.label}](${links.dailyStockReview.url})에서 오늘 국내주식 관심종목 흐름을 확인합니다.
- [${links.focusedSignalReview.label}](${links.focusedSignalReview.url})에서 최근 매매 신호가 나온 종목을 더 깊게 봅니다.
- [${links.futuresOptionsSignalRecord.label}](${links.futuresOptionsSignalRecord.url})에서 국내외 선물 흐름과 매매 신호를 이어서 기록합니다.

## 마무리

ETF는 여러 종목을 한 번에 담을 수 있어 편하지만, 그만큼 안쪽 구성을 모르고 사기 쉽습니다. 오늘 순위는 어떤 시장과 섹터를 더 살펴볼지 정하는 출발점으로 사용하고, 실제 선택 전에는 추종 지수와 편입 종목, 환헤지 여부, 비용을 다시 확인하겠습니다.

혹시 손실이 잦다면 혼자 감으로 거래하기보다, ${UPSIGNAL_LINK}에서 최근 매매 타점과 시장별 신호를 먼저 확인해 보시는 것도 좋겠습니다. 신호를 그대로 따라가라는 뜻이 아니라, 들어갈 자리와 멈출 자리를 미리 정해보자는 의미입니다.

이 글은 시스템 신호와 공개 자료를 정리한 개인 기록입니다. 실제 매매 판단은 가격, 거래량, 상품 구조와 각자의 손실 기준을 함께 확인한 뒤 결정해야 합니다.
`;
}

function renderCompactReviewBridge(stocks: DailyBriefStockPick[]) {
  if (stocks.length > 3) return "";
  const lead = stocks[0]?.name ?? "첫 번째 종목";
  return `표만 보면 점수와 목표가가 가장 높은 종목부터 눈이 가기 쉽습니다. 그런데 실제로 차트를 열어보면 신호가 나온 위치와 현재 가격의 거리가 종목마다 꽤 다릅니다. 그래서 순위는 출발점으로만 보고, 지금 가격이 신호 구간을 지키고 있는지를 먼저 확인하겠습니다.

차트에서는 최근 신호가 한 번으로 끝났는지, 비슷한 가격대에서 여러 번 나타났는지 살펴보겠습니다. ${lead}처럼 신호일이 가까운 종목은 다음 거래일에도 거래량이 이어지는지가 중요하고, 이미 가격이 많이 움직였다면 좋은 재료가 있어도 진입 시점은 다시 생각해 볼 필요가 있습니다.

마지막으로 기사와 공시는 차트의 움직임을 설명하는 재료로 연결하겠습니다. 제목만 보고 호재나 악재로 단정하지 않고, 발표 시점 이후 가격이 실제로 반응했는지까지 확인하면 같은 뉴스도 조금 다르게 보일 수 있습니다.`;
}

function renderPracticalFaq(stocks: DailyBriefStockPick[]) {
  const lead = stocks[0];
  const comparison = stocks[1];
  return `## 자주 묻는 질문

### 신호가 나온 종목은 바로 들어가도 될까요?

바로 결론을 내리기보다 신호 가격과 현재가의 간격부터 확인하는 편이 좋습니다. 예를 들어 ${lead?.name ?? "상위 종목"}처럼 현재가가 시스템 진입 기준 위에 있다면, 다음 거래일에도 그 가격대를 지키는지와 거래량이 함께 붙는지를 먼저 살펴봅니다.

### 같은 업종 종목이 여러 개 보이면 무엇을 비교해야 할까요?

점수만 높은 종목 하나를 고르기보다 신호 날짜, 가격 위치, 거래대금을 나란히 놓고 봅니다. ${lead?.name ?? "첫 번째 후보"}와 ${comparison?.name ?? "두 번째 후보"}처럼 같은 흐름으로 묶인 경우에는 실제 확인 과정에서 어느 종목에 수급이 더 오래 남는지가 차이를 만들 수 있습니다.

### 목표가보다 손절 기준을 먼저 봐야 하나요?

목표가는 기대 구간이고 손절선은 판단이 틀렸을 때 멈출 기준입니다. 상황을 가정해 진입 전에 감당 가능한 손실 범위를 먼저 정해두면, 장중 가격이 흔들릴 때 계획을 갑자기 바꾸는 일을 줄일 수 있습니다.`;
}

function renderStockAssignment(
  input: Parameters<typeof renderProject300InvestmentPost>[0],
  assignment: InvestmentStockNarrativeAssignment
) {
  const stocks = assignment.subjectCodes.map((code) => input.stocks.find((stock) => stock.code === code)).filter((stock): stock is DailyBriefStockPick => Boolean(stock));
  if (!stocks.length) return "";
  if (assignment.role === "comparison" && stocks.length >= 2) return renderComparison(input, stocks, assignment);
  return renderSingleStock(input, stocks[0], assignment);
}

function renderComparison(
  input: Parameters<typeof renderProject300InvestmentPost>[0],
  stocks: DailyBriefStockPick[],
  assignment: InvestmentStockNarrativeAssignment
) {
  const [first, second] = stocks;
  const media = stocks.map((stock) => input.stockMediaByCode.get(stock.code)).filter(Boolean).join("\n\n");
  const actualJudgment = findLedgerText(input.judgmentLedger, stocks.map((stock) => stock.code));
  const research = renderVerifiedSources(input, stocks.map((stock) => stock.code));
  const comparisonNarrative = selectComparisonNarrative(first.rank);
  return `## ${assignment.theme} 신호가 함께 잡혔습니다: ${first.name}과 ${second.name}

${media}

${withTopicParticle(joinNames([first.name, second.name]))} 같은 ${assignment.theme} 그룹에서 함께 올라왔습니다. ${withTopicParticle(first.name)} ${signalSentence(first)}, ${withTopicParticle(second.name)} ${signalSentence(second)}로 표시됩니다. ${comparisonNarrative.groupReading}

${comparisonNarrative.nextCheck}${actualJudgment ? ` ${actualJudgment}` : ""}

${research}`.trim();
}

function selectComparisonNarrative(rank: number) {
  const narratives = [
    {
      groupReading: "비슷한 시기에 같은 업종이 나란히 올라왔다는 점부터 눈에 들어옵니다.",
      nextCheck: "이럴 때는 숫자를 다시 늘어놓기보다 장중 거래가 어느 종목에 더 붙는지 비교해 보는 편이 낫습니다."
    },
    {
      groupReading: "개별 재료만 보기 전에 업종 전체로 돈이 들어오는 장면인지 확인해 볼 만합니다.",
      nextCheck: "최근 신호 날짜와 거래대금을 나란히 놓으면 둘 중 어느 쪽 흐름이 더 단단한지 판단하기가 조금 쉬워집니다."
    },
    {
      groupReading: "둘이 함께 보인 만큼 한 종목의 뉴스만으로 움직임을 설명하기는 어렵겠습니다.",
      nextCheck: "다음 거래일에는 진입 기준을 지키는지, 같은 업종의 강세가 이어지는지를 먼저 볼 생각입니다."
    },
    {
      groupReading: "같은 테마 안에서도 점수와 가격 위치는 다르니 순위만 보고 하나를 고르기는 이릅니다.",
      nextCheck: "차이는 결국 신호 이후의 탄력과 거래량에서 드러납니다. 두 차트를 번갈아 보는 이유가 여기에 있습니다."
    },
    {
      groupReading: "시장 수급이 이 그룹을 같이 끌어올린 것인지 살펴볼 수 있는 조합입니다.",
      nextCheck: "먼저 움직인 종목을 뒤늦게 따라가기보다 아직 기준 가격 근처에 남은 쪽을 차분히 확인하는 편이 낫겠습니다."
    },
    {
      groupReading: "한쪽만 튀었다기보다 업종 안에서 신호가 퍼지는 모습에 가깝습니다.",
      nextCheck: "둘의 목표가보다 먼저 볼 것은 신호 가격대 유지 여부입니다. 그다음 뉴스와 실제 수급을 연결해 보겠습니다."
    }
  ] as const;
  return narratives[Math.abs(rank) % narratives.length];
}

function renderSingleStock(
  input: Parameters<typeof renderProject300InvestmentPost>[0],
  stock: DailyBriefStockPick,
  assignment: InvestmentStockNarrativeAssignment
) {
  const media = input.stockMediaByCode.get(stock.code) ?? "";
  const research = renderVerifiedSources(input, [stock.code]);
  const actualJudgment = findLedgerText(input.judgmentLedger, [stock.code]);
  const signalDate = stock.recentSignalDate ?? "신호일 미확인";
  const heading = `${stock.name}: ${signalDate} 신호와 ${assignment.theme} 재료`;
  const narrative = selectSingleStockNarrative(stock.rank);
  return `## ${heading}

${media}

${withTopicParticle(stock.name)} 앞에서 살펴본 종목과 성격이 다릅니다. 최근 신호일은 ${signalDate}, 현재가는 ${stock.currentPrice ?? "미확인"}, 시스템 진입가는 ${stock.entryPrice ?? "미확인"}로 표시됩니다. ${narrative}

점수는 ${stock.totalScore ?? "미확인"}, 상태는 ${stock.statusLabel ?? "미확인"}입니다. 이 값은 급등포착의 시스템 평가이며, 실제 실적이나 공시 내용을 대신하지 않습니다.${actualJudgment ? ` ${actualJudgment}` : ""}

${research}`.trim();
}

function selectSingleStockNarrative(rank: number) {
  const narratives = [
    "목표가 숫자보다 먼저 볼 것은 신호가 나온 가격대를 다음 거래일에도 지키는지입니다.",
    "이 종목은 같은 업종 후보가 함께 움직이는지까지 연결해서 봐야 흐름을 오해하지 않습니다.",
    "차트가 먼저 움직인 뒤 최근 기사와 공시가 실제 거래로 이어지는지가 이번 확인 포인트입니다.",
    "현재 위치에서는 상승 여력 계산보다 거래량이 줄지 않고 이어지는지를 살펴보는 편이 낫습니다.",
    "최근 신호가 한 번으로 끝난 것인지 비슷한 가격대에서 다시 나타나는지를 차트에서 확인해 볼 만합니다.",
    "진입 기준과 현재가의 거리가 더 벌어지지 않는지부터 보고, 그다음 개별 재료를 연결해 보겠습니다.",
    "업종 전체가 쉬어갈 때도 이 종목만 가격을 지키는지가 상대적인 강도를 보여줄 수 있습니다.",
    "뉴스 제목만 좋은 날보다 가격과 거래가 함께 반응하는 날에 신호의 의미가 더 분명해집니다."
  ] as const;
  return narratives[Math.abs(rank) % narratives.length];
}

function renderVerifiedSources(input: Parameters<typeof renderProject300InvestmentPost>[0], codes: string[]) {
  const news = input.researchItems.filter((item) => codes.includes(item.symbolCode) && item.url && item.title && item.sourceName).slice(0, 4);
  const disclosures = input.disclosureItems.filter((item) => codes.includes(item.symbolCode) && item.url && item.title).slice(0, 3);
  if (!news.length && !disclosures.length) return "";
  const lines = [
    ...news.map((item) => `- [${escapeLinkText(item.title)}](${item.url}) (${item.sourceName}${item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""})`),
    ...disclosures.map((item) => `- [${escapeLinkText(item.title)}](${item.url}) (${item.sourceName}${item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""})`)
  ];
  return `### 최근 기사와 공시에서 확인된 내용\n\n${lines.join("\n")}`;
}

function renderEtfSection(input: Parameters<typeof renderProject300InvestmentPost>[0]) {
  if (!input.etfs.length) return "";
  const picks = input.etfs.slice(0, 5);
  return `## 종목 신호와 같이 본 ETF 흐름

${input.etfMedia ?? ""}

${input.outline.etfInclusionReason ?? "종목 신호가 시장의 큰 방향과 맞는지 ETF 보드도 함께 확인했습니다."}

| ETF | 카테고리 | 현재가 | 최근매수 | 점수 |
| --- | --- | --- | --- | --- |
${picks.map((pick) => `| ${pick.name} | ${pick.category ?? "-"} | ${pick.currentPrice ?? "-"} | ${pick.recentBuyDate ?? "-"} | ${pick.totalScore ?? "-"} |`).join("\n")}

ETF는 개별 종목의 결론을 대신하지 않습니다. 다만 같은 섹터나 해외 지수 상품이 상위권에 함께 보이면, 종목 신호가 혼자 나온 것인지 시장 흐름과 연결된 것인지 구분하는 데 도움이 됩니다.`;
}

function renderJudgmentOpening(ledger: InvestmentJudgmentLedger, centerJudgment: string) {
  if (!ledger.userInputPresent) return "";
  return [ledger.firstImpression, ledger.mostInterestingSubject, ledger.mainConcern]
    .filter((item): item is string => Boolean(item) && normalizeSentence(item ?? "") !== normalizeSentence(centerJudgment))
    .join(" ");
}

function findLedgerText(ledger: InvestmentJudgmentLedger, codes: string[]) {
  return [
    ...ledger.judgments.filter((item) => !item.subjectCode || codes.includes(item.subjectCode)).map((item) => item.text),
    ...ledger.actions.filter((item) => !item.subjectCode || codes.includes(item.subjectCode)).map((item) => item.text)
  ].join(" ");
}

function renderNextConditions(ledger: InvestmentJudgmentLedger, outline: InvestmentWritingOutline) {
  const userConditions = [...ledger.revisitConditions, ...ledger.exclusionConditions];
  if (userConditions.length) return userConditions.map((item) => `- ${item}`).join("\n");
  const comparison = outline.stockAssignments.find((item) => item.role === "comparison");
  return [
    comparison ? `- ${comparison.subjectNames.join("과 ")} 중 거래가 더 붙고 시스템 기준 가격을 유지하는 종목이 있는지 확인합니다.` : null,
    "- 최근 신호 이후 거래량과 가격이 함께 유지되는지 확인합니다.",
    "- 기사나 공시가 실제 가격 반응으로 이어지는지 확인합니다.",
    "- 시스템 기준 가격이 깨지면 기존 해석을 다시 검토합니다."
  ].filter(Boolean).join("\n");
}

function renderCrossLinks(links: ReturnType<typeof buildProject300CategoryLinks>) {
  return `## 이어서 볼 기록

- [${links.focusedSignalReview.label}](${links.focusedSignalReview.url})에서 최근 신호 종목을 더 깊게 봅니다.
- [${links.etfSectorReview.label}](${links.etfSectorReview.url})에서 ETF와 섹터 흐름을 이어서 확인합니다.
- [${links.futuresOptionsSignalRecord.label}](${links.futuresOptionsSignalRecord.url})에서 국내외 선물 흐름과 매매 신호를 기록합니다.`;
}

function buildOpeningHeading(outline: InvestmentWritingOutline) {
  const comparison = outline.stockAssignments.find((item) => item.role === "comparison");
  return comparison ? `오늘은 ${comparison.theme} 흐름이 유독 눈에 들어옵니다` : "오늘 눈에 들어온 종목부터 볼까요?";
}

function buildNaturalOpening(outline: InvestmentWritingOutline, stocks: DailyBriefStockPick[]) {
  const comparison = outline.stockAssignments.find((item) => item.role === "comparison");
  if (comparison) {
    return `오늘은 ${comparison.theme} 종목이 여러 개 잡혔습니다. 같은 업종 종목이 함께 올라온 걸 보니 최근 흐름이 제법 강한가 봅니다. 한 종목만 따로 보기보다 차트를 나란히 놓고 비교해 보겠습니다.`;
  }
  const lead = stocks[0]?.name ?? "상위 종목";
  return `오늘 신호에서는 ${lead}이 먼저 눈에 들어왔습니다. 최근 가격 흐름과 매매 신호가 어디에서 나왔는지부터 확인해 보겠습니다.`;
}

function renderStockRow(stock: DailyBriefStockPick) {
  return `| ${stock.name} | ${stock.recentSignalDate ?? "-"} | ${stock.currentPrice ?? "-"} | ${stock.entryPrice ?? "-"} | ${stock.targetPrice ?? "-"} | ${stock.stopLoss ?? "-"} | ${stock.totalScore ?? "-"} |`;
}

function signalSentence(stock: DailyBriefStockPick) {
  return `${stock.recentSignalDate ?? "최근"} 신호, 점수 ${stock.totalScore ?? "미확인"}, 상태 ${stock.statusLabel ?? "미확인"}`;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "없습니다";
  const beforeLast = names[names.length - 2];
  const particle = hasFinalConsonant(beforeLast) ? "과" : "와";
  return `${names.slice(0, -1).join(", ")}${particle} ${names[names.length - 1]}`;
}

function hasFinalConsonant(value: string) {
  const code = value.trim().charCodeAt(value.trim().length - 1);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
}

function withTopicParticle(value: string) {
  return `${value}${hasFinalConsonant(value) ? "은" : "는"}`;
}

function escapeLinkText(value: string) {
  return value.replace(/[\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function normalizeSentence(value: string) {
  return value.replace(/[.!?]+$/g, "").replace(/\s+/g, " ").trim();
}
