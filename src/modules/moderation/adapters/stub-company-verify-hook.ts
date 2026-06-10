import type { AuditTx } from '@/modules/audit';
import { childLogger } from '@/shared/lib/logger';
import type {
  CompanyVerifyHookPort,
  ContentActivation,
} from '../ports/company-verify-hook.port';

/**
 * Adapter stub do {@link CompanyVerifyHookPort} (GAP-4 / USP-017).
 *
 * Não marca `companies.is_verified` — registra a intenção. A flag e o painel de
 * verificação de Empresa são da USP-017, que troca este binding no container.
 */
export class StubCompanyVerifyHook implements CompanyVerifyHookPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'company-verify-stub' });

  async onContentActivated(_tx: AuditTx, activation: ContentActivation): Promise<void> {
    this.log.info(
      { contentKind: activation.contentKind, contentId: activation.contentId },
      'moderation:company-verify-hook:stub (flag is_verified chega na USP-017)',
    );
  }
}
