import type { AuditTx } from '@/modules/audit';
import { createToken } from '@/shared/container';
import type { ContentKind, ContentStatus } from '../domain/content-status';

/** Conteúdo que mudou de status, candidato a disparar efeito na Empresa. */
export interface ContentActivation {
  contentKind: ContentKind;
  contentId: string;
  from: ContentStatus;
  actorPersonId: string;
}

/**
 * Hook disparado por `transitionContent` **dentro da transação** (`tx`) — a
 * verificação de Empresa é um write transacional acoplado à decisão de moderação
 * (ADR-0024 / USP-017):
 *
 *  - `onContentActivated` (→ ACTIVE): se for a **1ª vaga** de uma Empresa não
 *    verificada (`isVerified=false`, AD-2), marca `is_verified=true` + snapshot +
 *    `COMPANY_VERIFIED` (E-002). Empresa já verificada → no-op (E-004).
 *  - `onContentRejected` (→ REJECTED): se a vaga é de uma Empresa **não
 *    verificada**, incrementa `rejection_count` (E-003 / AD-5), mantém não verificada.
 *
 * Marcação de `is_verified` ocorre **somente** por aqui (P-005 / AD-3) — nenhum
 * action de `companies` expõe esse set.
 */
export interface CompanyVerifyHookPort {
  onContentActivated(tx: AuditTx, activation: ContentActivation): Promise<void>;
  onContentRejected(tx: AuditTx, activation: ContentActivation): Promise<void>;
}

export const COMPANY_VERIFY_HOOK_TOKEN =
  createToken<CompanyVerifyHookPort>('CompanyVerifyHookPort');
