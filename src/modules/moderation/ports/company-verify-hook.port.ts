import type { AuditTx } from '@/modules/audit';
import { createToken } from '@/shared/container';
import type { ContentKind, ContentStatus } from '../domain/content-status';

/** Conteúdo recém-ativado, candidato a disparar a verificação de Empresa. */
export interface ContentActivation {
  contentKind: ContentKind;
  contentId: string;
  from: ContentStatus;
  actorPersonId: string;
}

/**
 * Hook disparado quando um conteúdo entra em `ACTIVE` — quando a **primeira vaga**
 * de uma Empresa é aprovada, marca `companies.is_verified = true` (ADR-0011).
 *
 * Nesta US o adapter é um **stub no-op** (GAP-4): a flag `isVerified` e o painel
 * de verificação são da USP-017. Roda **dentro da transação** (`tx`) porque a
 * marcação real é um write transacional acoplado à ativação.
 */
export interface CompanyVerifyHookPort {
  onContentActivated(tx: AuditTx, activation: ContentActivation): Promise<void>;
}

export const COMPANY_VERIFY_HOOK_TOKEN =
  createToken<CompanyVerifyHookPort>('CompanyVerifyHookPort');
