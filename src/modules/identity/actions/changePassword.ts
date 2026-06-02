'use server';

import { headers } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import {
  changePasswordFirstAccessSchema,
  type ChangePasswordFirstAccessInput,
} from '../schemas/changePassword';

/**
 * Troca de senha forçada no 1º acesso (USP-004 — T-09, AC-004-5).
 *
 * Pré-condição: a Pessoa está autenticada (sessão criada no login) e a sua
 * credencial está com `primeiroAcesso=true`. Atualiza a senha no Supabase Auth,
 * baixa a flag na mesma transação do `audit_log` e libera a navegação (o
 * middleware confina rotas `(app)/*` enquanto a flag estiver ligada — T-08).
 */
export async function changePasswordFirstAccess(
  rawInput: ChangePasswordFirstAccessInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  // 1. Validação (senha nova + confirmação + força mínima).
  const parsed = changePasswordFirstAccessSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { senhaNova } = parsed.data;

  // 2. Autenticação: precisa de sessão válida.
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const person = await prisma.person.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true, status: true, credential: { select: { id: true, primeiroAcesso: true } } },
  });
  if (!person || person.status !== 'ATIVO' || !person.credential) {
    return fail('FORBIDDEN', 'Operação não permitida.');
  }

  // 3. Atualiza a senha no provedor (bcrypt gerenciado pelo Supabase — P-003).
  const { error: updateError } = await supabase.auth.updateUser({ password: senhaNova });
  if (updateError) {
    return fail('INTERNAL', 'Não foi possível alterar a senha. Tente novamente.');
  }

  // 4. Baixa a flag de 1º acesso + audita na mesma transação.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  await withAudit(
    AuditEvent.AUTH_PASSWORD_CHANGED_FIRST_ACCESS,
    async (tx, audit) => {
      await tx.credential.update({
        where: { id: person.credential!.id },
        data: { primeiroAcesso: false },
      });
      audit.entityType = 'credential';
      audit.entityId = person.credential!.id;
      audit.after = { primeiroAcesso: false };
    },
    { actorUserId: user.id, actorPersonId: person.id, ip, userAgent, context: { route: '/trocar-senha' } },
  );

  return ok({ redirectTo: '/inicio' });
}
