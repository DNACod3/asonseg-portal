/**
 * Regras puras (sem IO) do agregado `ServiceInterest` (USP-033 — AD-020).
 * Espelham `jobs/domain/application-rules.ts`, adaptadas à semântica de
 * Serviço (sem `validUntil`/Empresa verificada — ver `getActiveServiceDetail`).
 */

/** Shape mínimo de um serviço necessário para decidir se aceita manifestação. */
export interface ServiceInterestServiceInput {
  status: string;
  authorInactivatedAt: Date | null;
}

/**
 * WHEN o serviço está `ACTIVE` e o prestador (autor) está ativo THEN elegível a
 * receber manifestação de interesse (SVC033-MN-05). Mesma semântica on-read de
 * `getActiveServiceDetail` (`status='ACTIVE' AND author.inactivatedAt IS NULL`).
 */
export function isServiceOpenForInterest(service: ServiceInterestServiceInput): boolean {
  return service.status === 'ACTIVE' && service.authorInactivatedAt == null;
}
