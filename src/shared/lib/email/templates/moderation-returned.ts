import type { ModerationReturnedEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de devolução para ajustes (moderação — NOT-04 / E-003 / USP-057).
 * Enfileirado quando o conteúdo transiciona IN_MODERATION → AWAITING_ADJUSTMENTS.
 * Inclui **o motivo** (`notice.justification`, sempre presente — obrigatório e
 * validado por `transitionContent`/P-003) e a orientação de ajustar e reenviar.
 * Nenhum dado do moderador (USP057-MN-04).
 */
export function renderModerationReturnedEmail({
  autorNome,
  tipoConteudo,
  tituloConteudo,
  motivo,
  areaUrl,
}: ModerationReturnedEmailData): RenderedEmail {
  const subject = `Seu(sua) ${tipoConteudo} precisa de ajustes: ${tituloConteudo}`;
  const nomeSeguro = escapeHtml(autorNome);
  const tipoSeguro = escapeHtml(tipoConteudo);
  const tituloSeguro = escapeHtml(tituloConteudo);
  const motivoSeguro = escapeHtml(motivo);
  const urlSegura = escapeHtml(areaUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Seu(sua) ${tipoSeguro} <strong>${tituloSeguro}</strong> foi devolvido(a) pela moderação e precisa de ajustes antes de ser publicado(a).</p>
     <p style="margin:0 0 16px;">Motivo informado pela moderação: <strong>${motivoSeguro}</strong></p>
     <p style="margin:0 0 16px;">Ajuste as informações e reenvie para uma nova análise.</p>
     <p style="margin:0;">${ctaButton(urlSegura, 'Acessar minha área')}</p>`,
  );

  const text = [
    `Olá, ${autorNome}!`,
    '',
    `Seu(sua) ${tipoConteudo} ${tituloConteudo} foi devolvido(a) pela moderação e precisa de ajustes antes de ser publicado(a).`,
    '',
    `Motivo informado pela moderação: ${motivo}`,
    '',
    'Ajuste as informações e reenvie para uma nova análise.',
    '',
    `Acesse: ${areaUrl}`,
  ].join('\n');

  return { subject, html, text };
}
