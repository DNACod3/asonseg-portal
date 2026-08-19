const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Conta quantas linhas têm `interestedAt` dentro dos últimos `days` dias a
 * partir de `now` — usado pelo KPI "novos em 7 dias" do bloco PROVIDER do
 * painel `/inicio` (USP-067 — PNL-02 / A-15), a partir das linhas já
 * carregadas de `listProviderInterests` (sinal de página, não total
 * absoluto). Puro, sem IO. `days` default 7.
 */
export function countRecentWithin7Days(
  rows: readonly { interestedAt: Date }[],
  now: Date = new Date(),
  days = 7,
): number {
  const threshold = now.getTime() - days * DAY_MS;
  return rows.filter((row) => row.interestedAt.getTime() >= threshold).length;
}
