import { requireActiveConsent } from '@/modules/consents';
import { fail, ok, type ActionResult } from '@/shared/errors';
import { requireActiveResponsible } from './require-active-responsible';

/**
 * Gate de autorização para publicar/submeter um serviço (USP-029 / AC-029-1).
 * Checado **antes** de qualquer escrita (anti-bypass, SVC029-MN-02/03):
 *
 *  1. Papel `PROVIDER` ativo (SVC029-MN-02) — `roles` vem de `getCurrentPerson()`,
 *     que já filtra grants `ACTIVE` (session.ts).
 *  2. Quando `companyId` setado: responsável **ativo** da Empresa (SVC029-MN-03).
 *  3. Consentimento `SERVICE_OFFERING` ativo (defesa em profundidade — o papel
 *     PROVIDER ativo já implica o consentimento; revogá-lo derruba o papel, ADR-0008).
 *
 * Retorna `ok(true)` se autorizado, ou o `ActionResult` de falha pronto para a
 * action propagar diretamente. Nunca lança.
 */
export async function requireServiceAuthorization(
  personId: string,
  roles: readonly string[],
  companyId: string | null | undefined,
): Promise<ActionResult<true>> {
  if (!roles.includes('PROVIDER')) {
    return fail('FORBIDDEN', 'Você precisa ativar o papel de prestador para publicar um serviço.');
  }

  if (companyId != null) {
    if (!(await requireActiveResponsible(personId, companyId))) {
      return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
    }
  }

  const consent = await requireActiveConsent(personId, 'SERVICE_OFFERING');
  if (!consent.active) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar o termo de oferta de serviços para continuar.',
    );
  }

  return ok(true);
}
