export function parseRankingFromText(rankingText: string): string[] {
  const text = String(rankingText ?? "");
  const marker = "FINAL RANKING:";
  const haystack = text.includes(marker) ? text.split(marker).slice(1).join(marker) : text;

  const numbered = [...haystack.matchAll(/\d+\.\s*(Response [A-Z])/g)].map((m) => m[1]);
  if (numbered.length > 0) return numbered;

  const any = [...haystack.matchAll(/Response [A-Z]/g)].map((m) => m[0]);
  return any;
}

export function calculateAggregateRankings(
  stage2: Array<{ parsedRanking: string[] }>,
  labelToModel: Record<string, string>,
): Array<{ model: string; averageRank: number; rankingsCount: number }> {
  const modelPositions = new Map<string, number[]>();

  for (const r of stage2) {
    const parsed = Array.isArray(r.parsedRanking) ? r.parsedRanking : [];
    parsed.forEach((label, idx) => {
      const model = labelToModel[label];
      if (!model) return;
      const list = modelPositions.get(model) ?? [];
      list.push(idx + 1);
      modelPositions.set(model, list);
    });
  }

  const aggregate: Array<{ model: string; averageRank: number; rankingsCount: number }> = [];
  for (const [model, positions] of modelPositions.entries()) {
    if (!positions.length) continue;
    const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
    aggregate.push({ model, averageRank: Math.round(avg * 100) / 100, rankingsCount: positions.length });
  }

  aggregate.sort((a, b) => a.averageRank - b.averageRank);
  return aggregate;
}

