/**
 * O erro é a violação do índice parcial de dedup `job_dedup_alive`
 * (P-003 / ADR-0021)? Prisma 5.x sinaliza unicidade via `code === 'P2002'`. O índice
 * é a única constraint UNIQUE sobre `jobs`, então o código estruturado basta (a
 * mensagem não carrega o nome do índice parcial criado por SQL bruto). Pura — só
 * inspeciona o formato do erro; compartilhada por createJobDraft/submitJobForModeration.
 */
export function isJobDedupViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: unknown }).code === 'P2002';
}
