import type { ModerationRejectedEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de rejeição de conteúdo (moderação — NOT-05 / E-004 / USP-057).
 * Enfileirado quando o conteúdo transiciona IN_MODERATION → REJECTED. Inclui
 * **o motivo** (`notice.justification`, sempre presente — obrigatório e validado
 * por `transitionContent`/P-003). Nenhum dado do moderador (USP057-MN-04).
 */
export function renderModerationRejectedEmail({
  autorNome,
  tipoConteudo,
  tituloConteudo,
  motivo,
  areaUrl,
}: ModerationRejectedEmailData): RenderedEmail {
  const subject = `Seu(sua) ${tipoConteudo} não foi aprovado(a): ${tituloConteudo}`;
  const nomeSeguro = escapeHtml(autorNome);
  const tipoSeguro = escapeHtml(tipoConteudo);
  const tituloSeguro = escapeHtml(tituloConteudo);
  const motivoSeguro = escapeHtml(motivo);
  const urlSegura = escapeHtml(areaUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Seu(sua) ${tipoSeguro} <strong>${tituloSeguro}</strong> foi analisado(a) pela moderação e <strong>não foi aprovado(a)</strong>.</p>
     <p style="margin:0 0 16px;">Motivo informado pela moderação: <strong>${motivoSeguro}</strong></p>
     <p style="margin:0;">${ctaButton(urlSegura, 'Acessar minha área')}</p>`,
  );

  const text = [
    `Olá, ${autorNome}!`,
    '',
    `Seu(sua) ${tipoConteudo} ${tituloConteudo} foi analisado(a) pela moderação e não foi aprovado(a).`,
    '',
    `Motivo informado pela moderação: ${motivo}`,
    '',
    `Acesse: ${areaUrl}`,
  ].join('\n');

  return { subject, html, text };
}
