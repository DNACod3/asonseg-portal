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
import { CAPTCHA_VERIFIER_TOKEN } from '../ports/captchaVerifier';
import {
  requestPasswordResetSchema,
  GENERIC_RESET_REQUEST_MESSAGE,
  RESET_LINK_EXPIRY_HOURS,
  type RequestPasswordResetInput,
} from '../schemas/password-reset.schema';

/**
 * Solicitação de redefinição de senha (USP-005 — IDN-13).
 *
 * **Anti-abuso (ADR-0014):** endpoint público — exige CAPTCHA (fail-closed) antes
 * de qualquer efeito, para conter mail-bombing e enumeração por volume. O
 * middleware ainda aplica um teto por IP (categoria `passwordReset`).
 *
 * **Anti-enumeração (AC):** devolve sempre a MESMA mensagem genérica, exista ou
 * não a conta. Só quando há Pessoa ATIVA com credencial é que geramos o link de
 * recuperação (válido 24h — `otp_expiry` do GoTrue) via Supabase Admin e o
 * enviamos pela porta `EmailSender`. Falhas de provedor (gerar link / enviar
 * e-mail) são logadas, mas nunca alteram a resposta ao usuário. (A recusa de
 * CAPTCHA é independente do e-mail, então não vaza existência de conta.)
 *
 * **Exceção à sequência canônica:** o solicitante não está autenticado, então
 * não há `requirePermission`/`requireActiveConsent`. A auditoria
 * (`AUTH_PASSWORD_RESET_REQUESTED`) só é gravada quando o e-mail corresponde a
 * uma Pessoa (evita poluir o log e enumerar via auditoria — espelha o login).
 *
 * **Link único por usuário (P-001):** o GoTrue mantém um único `recovery_token`
 * por usuário; cada `generateLink({ type: 'recovery' })` substitui o anterior, de
 * modo que uma nova solicitação invalida links pendentes (não coexistem dois
 * links válidos). O uso único é garantido pelo `verifyOtp` no `resetPassword`.
 *
 * **Timing (P-002):** o caminho "conta existe" faz I/O extra (gerar link + enviar
 * e-mail) e responde mais devagar que o caminho no-op — uma diferença de timing
 * teoricamente observável apesar da mensagem idêntica. Risco residual aceito: o
 * CAPTCHA fail-closed e o teto de 5/15min por IP (categoria `passwordReset`)
 * tornam a amostragem estatística necessária para um ataque de timing inviável.
 * Normalização constante (padding de I/O de rede) fica como hardening futuro.
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
  const { email, captchaToken } = parsed.data;

  // 2. Contexto da request (IP, user-agent) para CAPTCHA e auditoria.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // 3. CAPTCHA (fail-closed — ADR-0014 / P-005). Recusa é independente do e-mail.
  const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
  const captchaResult = await captcha.verify(captchaToken, ip ?? undefined);
  if (!captchaResult.ok) {
    return fail('PRECONDITION_FAILED', 'CAPTCHA inválido ou expirado. Tente novamente.');
  }

  // Resposta genérica única — retornada em TODOS os caminhos de sucesso/no-op.
  const generic = ok({ message: GENERIC_RESET_REQUEST_MESSAGE });

  // 4. Pré-condição: existe Pessoa ATIVA com credencial para este e-mail?
  const person = await prisma.person.findUnique({
    where: { emailLogin: email },
    select: { id: true, status: true, fullName: true, supabaseUserId: true },
  });
  if (!person || person.status !== 'ATIVO' || !person.supabaseUserId) {
    log.info({}, 'reset:request_noop'); // e-mail desconhecido/inativo — sem efeito.
    return generic;
  }

  // 5. Gera o link de recuperação (uso único, expira em 24h) via Supabase Admin.
  // Substitui o recovery_token anterior do usuário — links pendentes deixam de
  // valer (P-001: não coexistem dois links válidos).
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    log.error({ err: error?.message ?? 'sem token' }, 'reset:generate_link_failed');
    return generic; // não revela falha de infraestrutura.
  }

  // 6. Monta o link para a NOSSA página (não o link hospedado do Supabase) e envia.
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

  // 7. Audita a solicitação (houve pedido válido, mesmo se o e-mail falhou).
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
