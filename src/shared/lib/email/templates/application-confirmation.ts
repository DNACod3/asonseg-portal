import type { ApplicationConfirmationEmailData, RenderedEmail } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de confirmação de candidatura (USP-025 — CAN-025-02). Enfileirado
 * na mesma transação da criação da `Application` (`Outbox`, AD-007); o envio real é
 * assíncrono (dispatcher = USP-044). Sem link de ação — é só uma confirmação.
 */
export function renderApplicationConfirmationEmail({
  candidatoNome,
  vagaTitulo,
  empresaNome,
}: ApplicationConfirmationEmailData): RenderedEmail {
  const subject = `Candidatura recebida: ${vagaTitulo} — Portal ASONSEG`;
  const nomeSeguro = escapeHtml(candidatoNome);
  const vagaSegura = escapeHtml(vagaTitulo);
  const empresaSegura = escapeHtml(empresaNome);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Sua candidatura para a vaga <strong>${vagaSegura}</strong>, da empresa <strong>${empresaSegura}</strong>, foi recebida com sucesso.</p>
     <p style="margin:0;">A Empresa poderá visualizar seu interesse e considerar seu perfil. Boa sorte!</p>`,
  );

  const text = [
    `Olá, ${candidatoNome}!`,
    '',
    `Sua candidatura para a vaga ${vagaTitulo}, da empresa ${empresaNome}, foi recebida com sucesso.`,
    '',
    'A Empresa poderá visualizar seu interesse e considerar seu perfil. Boa sorte!',
  ].join('\n');

  return { subject, html, text };
}
