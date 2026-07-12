import type { ModerationApprovedEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de aprovação de conteúdo (moderação — NOT-03 / E-002 / USP-057).
 * Enfileirado na mesma transação da decisão (`transitionContent`, Outbox AD-007)
 * quando o conteúdo transiciona IN_MODERATION → ACTIVE. Sem motivo (aprovação
 * não exige justificativa) — só a confirmação de publicação e o link para a
 * área do autor. Nenhum dado do moderador (USP057-MN-04).
 */
export function renderModerationApprovedEmail({
  autorNome,
  tipoConteudo,
  tituloConteudo,
  areaUrl,
}: ModerationApprovedEmailData): RenderedEmail {
  const subject = `Seu(sua) ${tipoConteudo} foi publicado(a): ${tituloConteudo}`;
  const nomeSeguro = escapeHtml(autorNome);
  const tipoSeguro = escapeHtml(tipoConteudo);
  const tituloSeguro = escapeHtml(tituloConteudo);
  const urlSegura = escapeHtml(areaUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Seu(sua) ${tipoSeguro} <strong>${tituloSeguro}</strong> foi analisado(a) pela moderação e está <strong>publicado(a)</strong> no Portal ASONSEG.</p>
     <p style="margin:0;">${ctaButton(urlSegura, 'Acessar minha área')}</p>`,
  );

  const text = [
    `Olá, ${autorNome}!`,
    '',
    `Seu(sua) ${tipoConteudo} ${tituloConteudo} foi analisado(a) pela moderação e está publicado(a) no Portal ASONSEG.`,
    '',
    `Acesse: ${areaUrl}`,
  ].join('\n');

  return { subject, html, text };
}
