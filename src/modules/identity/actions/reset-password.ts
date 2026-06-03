'use server';

import { headers } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/password-reset.schema';

/**
 * Redefinição de senha via link (USP-005 — IDN-13).
 *
 * Consome o token de recuperação com `verifyOtp` (uso único — o GoTrue invalida
 * o link após consumir e o rejeita se expirado >24h), atualiza a senha no
 * provedor e encerra a sessão de recuperação: o usuário entra de novo já com a
 * senha nova (não fazemos login automático a partir de um link de e-mail).
 *
 * **Exceção à sequência canônica:** a autorização vem da posse do token, não de
 * `requirePermission`. Conclusão auditada em `AUTH_PASSWORD_RESET_COMPLETED`.
 */
export async function resetPassword(
  rawInput: ResetPasswordInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  const log = childLogger({ module: 'identity', action: 'resetPassword' });

  // 1. Validação (token presente + senha forte + confirmação).
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { token, senhaNova } = parsed.data;

  const supabase = await createSupabaseServerClient();

  // 2. Consome o token (uso único). Link expirado/já usado/ inválido → recusa.
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  });
  if (verifyError || !verifyData.user) {
    log.warn({ err: verifyError?.message }, 'reset:token_invalid');
    return fail(
      'PRECONDITION_FAILED',
      'Link inválido ou expirado. Solicite uma nova redefinição de senha.',
    );
  }
  const userId = verifyData.user.id;

  // 3. Atualiza a senha no provedor (a sessão criada pelo verifyOtp autoriza).
  const { error: updateError } = await supabase.auth.updateUser({ password: senhaNova });
  if (updateError) {
    log.error({ err: updateError.message }, 'reset:update_failed');
    return fail('INTERNAL', 'Não foi possível redefinir a senha. Tente novamente.');
  }

  // 4. Localiza a Pessoa (para auditoria + baixar 1º acesso, se aplicável).
  const person = await prisma.person.findUnique({
    where: { supabaseUserId: userId },
    select: { id: true, credential: { select: { id: true, primeiroAcesso: true } } },
  });

  // 5. Audita a conclusão; se a credencial estava em 1º acesso, conclui também.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  await withAudit(
    AuditEvent.AUTH_PASSWORD_RESET_COMPLETED,
    async (tx, audit) => {
      if (person?.credential?.primeiroAcesso) {
        await tx.credential.update({
          where: { id: person.credential.id },
          data: { primeiroAcesso: false },
        });
      }
      audit.entityType = 'person';
      audit.entityId = person?.id ?? null;
      audit.after = { reason: 'password_reset' };
    },
    {
      actorUserId: userId,
      actorPersonId: person?.id ?? null,
      ip,
      userAgent,
      context: { route: '/redefinir-senha' },
    },
  );

  // 6. Encerra a sessão de recuperação — login explícito com a senha nova.
  await supabase.auth.signOut();

  log.info({ actorPersonId: person?.id ?? null }, 'reset:completed');
  return ok({ redirectTo: '/login?redefinida=1' });
}
