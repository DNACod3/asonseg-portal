import type { ReferralNotificationEmailData, RenderedEmail } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de aviso de encaminhamento institucional (USP-037 — AC-037-5).
 * Enfileirado na mesma transação da criação do `Referral` (`Outbox`, AD-007),
 * apenas quando a Pessoa tem `emailLogin` (EC-2); o envio real é assíncrono
 * (dispatcher = USP-044). Puramente informativo — sem link de ação (o
 * encaminhamento usa aceite tácito, não exige confirmação da Pessoa).
 */
export function renderReferralNotificationEmail({
  pessoaNome,
  vagaTitulo,
  empresaNome,
}: ReferralNotificationEmailData): RenderedEmail {
  const subject = `Você foi encaminhado(a) pela ASONSEG: ${vagaTitulo}`;
  const nomeSeguro = escapeHtml(pessoaNome);
  const vagaSegura = escapeHtml(vagaTitulo);
  const empresaSegura = escapeHtml(empresaNome);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">A ASONSEG encaminhou institucionalmente o seu perfil para a vaga <strong>${vagaSegura}</strong>, da empresa <strong>${empresaSegura}</strong>.</p>
     <p style="margin:0;">A Empresa poderá visualizar seu perfil com a indicação de encaminhamento pela ASONSEG.</p>`,
  );

  const text = [
    `Olá, ${pessoaNome}!`,
    '',
    `A ASONSEG encaminhou institucionalmente o seu perfil para a vaga ${vagaTitulo}, da empresa ${empresaNome}.`,
    '',
    'A Empresa poderá visualizar seu perfil com a indicação de encaminhamento pela ASONSEG.',
  ].join('\n');

  return { subject, html, text };
}
