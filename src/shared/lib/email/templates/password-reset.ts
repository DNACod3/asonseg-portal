import type { PasswordResetEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de redefinição de senha (USP-005). Carrega o link de
 * redefinição (válido por `expiraEmHoras`, uso único) e reforça que, se o
 * usuário não solicitou, basta ignorar — a senha permanece a mesma.
 */
export function renderPasswordResetEmail({
  nome,
  resetUrl,
  expiraEmHoras,
}: PasswordResetEmailData): RenderedEmail {
  const subject = 'Redefinição de senha — Portal ASONSEG';
  const nomeSeguro = escapeHtml(nome);
  const urlSeguro = escapeHtml(resetUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Recebemos um pedido para redefinir a senha da sua conta no Portal ASONSEG. Clique no botão abaixo para escolher uma nova senha:</p>
     <p style="margin:0 0 16px;">${ctaButton(urlSeguro, 'Redefinir senha')}</p>
     <p style="margin:0 0 12px;">Se o botão não funcionar, copie e cole este endereço no navegador:<br />
       <a href="${urlSeguro}" style="color:#2563eb;word-break:break-all;">${urlSeguro}</a>
     </p>
     <p style="margin:0;">Este link é válido por ${expiraEmHoras} horas e só pode ser usado uma vez. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.</p>`,
  );

  const text = [
    `Olá, ${nome}!`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no Portal ASONSEG.',
    'Acesse o link abaixo para escolher uma nova senha:',
    '',
    resetUrl,
    '',
    `Este link é válido por ${expiraEmHoras} horas e só pode ser usado uma vez.`,
    'Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.',
  ].join('\n');

  return { subject, html, text };
}
