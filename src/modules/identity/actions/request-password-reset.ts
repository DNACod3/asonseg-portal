'use server';

import { headers } from 'next/headers';
import { env } from '@/shared/env';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/server';
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';
import {
  requestPasswordResetSchema,
  GENERIC_RESET_REQUEST_MESSAGE,
  RESET_LINK_EXPIRY_HOURS,
  type RequestPasswordResetInput,
} from '../schemas/password-reset.schema';

/**
 * Solicitação de redefinição de senha (USP-005 — IDN-13).
 *
 * **Anti-enumeração (AC):** devolve sempre a MESMA mensagem genérica, exista ou
 * não a conta. Só quando há Pessoa ATIVA com credencial é que geramos o link de
 * recuperação (válido 24h — `otp_expiry` do GoTrue) via Supabase Admin e o
 * enviamos pela porta `EmailSender`. Falhas de provedor (gerar link / enviar
 * e-mail) são logadas, mas nunca alteram a resposta ao usuário.
 *
 * **Exceção à sequência canônica:** o solicitante não está autenticado, então
 * não há `requirePermission`/`requireActiveConsent`. A auditoria
 * (`AUTH_PASSWORD_RESET_REQUESTED`) só é gravada quando o e-mail corresponde a
 * uma Pessoa (evita poluir o log e enumerar via auditoria — espelha o login).
 */
export async function requestPasswordReset(
  rawInput: RequestPasswordResetInput,
): Promise<ActionResult<{ message: string }>> {
  const log = childLogger({ module: 'identity', action: 'requestPasswordReset' });

  // 1. Validação de formato (Zod) — normaliza o e-mail.
  const parsed = requestPasswordResetSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { email } = parsed.data;

  // Resposta genérica única — retornada em TODOS os caminhos de sucesso/no-op.
  const generic = ok({ message: GENERIC_RESET_REQUEST_MESSAGE });

  // 2. Pré-condição: existe Pessoa ATIVA com credencial para este e-mail?
  const person = await prisma.person.findUnique({
    where: { emailLogin: email },
    select: { id: true, status: true, fullName: true, supabaseUserId: true },
  });
  if (!person || person.status !== 'ATIVO' || !person.supabaseUserId) {
    log.info({}, 'reset:request_noop'); // e-mail desconhecido/inativo — sem efeito.
    return generic;
  }

  // 3. Contexto da request (IP, user-agent) para auditoria.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // 4. Gera o link de recuperação (uso único, expira em 24h) via Supabase Admin.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    log.error({ err: error?.message ?? 'sem token' }, 'reset:generate_link_failed');
    return generic; // não revela falha de infraestrutura.
  }

  // 5. Monta o link para a NOSSA página (não o link hospedado do Supabase) e envia.
  const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const resetUrl = `${baseUrl}/redefinir-senha?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;

  const emailSender = container.resolve(EMAIL_SENDER_TOKEN);
  const sent = await emailSender.send({
    to: email,
    template: 'password-reset',
    data: { nome: person.fullName, resetUrl, expiraEmHoras: RESET_LINK_EXPIRY_HOURS },
  });
  if (!sent.ok) {
    log.error({ actorPersonId: person.id }, 'reset:email_send_failed');
  }

  // 6. Audita a solicitação (houve pedido válido, mesmo se o e-mail falhou).
  await withAudit(
    AuditEvent.AUTH_PASSWORD_RESET_REQUESTED,
    async (_tx, audit) => {
      audit.entityType = 'person';
      audit.entityId = person.id;
      audit.after = { channel: 'email', emailSent: sent.ok };
    },
    {
      actorPersonId: person.id,
      actorUserId: person.supabaseUserId,
      ip,
      userAgent,
      context: { route: '/recuperar-senha' },
    },
  );

  log.info({ actorPersonId: person.id }, 'reset:request_sent');
  return generic;
}
