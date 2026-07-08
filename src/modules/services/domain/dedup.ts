/**
 * O erro é a violação do índice parcial de dedup `service_dedup_alive`
 * (USP-029, espelha `isJobDedupViolation`/ADR-0021)? Prisma 5.x sinaliza
 * unicidade via `code === 'P2002'`. O índice é a única constraint UNIQUE sobre
 * `services`, então o código estruturado basta. Pura — só inspeciona o formato
 * do erro; compartilhada por createServiceDraft/submitServiceForModeration.
 */
export function isServiceDedupViolation(err: unknown): boolean {
  return err instanceof Error && (err as { code?: unknown }).code === 'P2002';
}
