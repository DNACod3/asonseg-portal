import type { ServiceInterestNotificationEmailData, RenderedEmail } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de notificação de manifestação de interesse (USP-033 — AC-033-1).
 * Enfileirado na mesma transação da criação do `ServiceInterest` (`Outbox`, AD-007);
 * o envio real é assíncrono (dispatcher = USP-044). Só o prestador recebe e-mail —
 * o contato do cliente é revelado ao cliente diretamente na tela (design §D5).
 */
export function renderServiceInterestNotificationEmail({
  prestadorNome,
  servicoTitulo,
  clienteNome,
}: ServiceInterestNotificationEmailData): RenderedEmail {
  const subject = `Novo interesse no seu serviço: ${servicoTitulo} — Portal ASONSEG`;
  const prestadorSeguro = escapeHtml(prestadorNome);
  const servicoSeguro = escapeHtml(servicoTitulo);
  const clienteSeguro = escapeHtml(clienteNome);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${prestadorSeguro}!</p>
     <p style="margin:0 0 16px;"><strong>${clienteSeguro}</strong> manifestou interesse no seu serviço <strong>${servicoSeguro}</strong> e já pode ver seu contato.</p>
     <p style="margin:0;">Fique atento e entre em contato assim que possível.</p>`,
  );

  const text = [
    `Olá, ${prestadorNome}!`,
    '',
    `${clienteNome} manifestou interesse no seu serviço ${servicoTitulo} e já pode ver seu contato.`,
    '',
    'Fique atento e entre em contato assim que possível.',
  ].join('\n');

  return { subject, html, text };
}
