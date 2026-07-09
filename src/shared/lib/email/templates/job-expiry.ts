import type { JobExpiryEmailData, RenderedEmail } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de aviso de expiração próxima de vaga (D-3, USP-024 / USP-044).
 * Hidratado por `resolveJobExpiryEmail` a partir do payload leve `{kind:'JOB_EXPIRY_D3'}`
 * enfileirado no Outbox; enviado ao responsável ATIVO da Empresa (nunca ao candidato).
 * Sem PII de terceiro no corpo (E-003/P-002) — só título da vaga, nome da Empresa e
 * a contagem de dias.
 */
export function renderJobExpiryEmail({
  empresaNome,
  vagaTitulo,
  diasRestantes,
}: JobExpiryEmailData): RenderedEmail {
  const subject = `Sua vaga "${vagaTitulo}" expira em ${diasRestantes} dia(s) — Portal ASONSEG`;
  const empresaSegura = escapeHtml(empresaNome);
  const vagaSegura = escapeHtml(vagaTitulo);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${empresaSegura}!</p>
     <p style="margin:0 0 16px;">Sua vaga <strong>${vagaSegura}</strong> expira em <strong>${diasRestantes} dia(s)</strong>.</p>
     <p style="margin:0;">Acesse o painel da Empresa no Portal ASONSEG para renovar a validade, se desejar continuar recebendo candidaturas.</p>`,
  );

  const text = [
    `Olá, ${empresaNome}!`,
    '',
    `Sua vaga ${vagaTitulo} expira em ${diasRestantes} dia(s).`,
    '',
    'Acesse o painel da Empresa no Portal ASONSEG para renovar a validade, se desejar continuar recebendo candidaturas.',
  ].join('\n');

  return { subject, html, text };
}
