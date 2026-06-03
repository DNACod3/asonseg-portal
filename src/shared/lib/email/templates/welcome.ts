import type { RenderedEmail, WelcomeEmailData } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de boas-vindas (USP-001 / USP-003). Mensagem simples de
 * confirmação de cadastro; não carrega link sensível. Quando o cadastro tem um
 * papel público (`papel`), reforça o próximo passo (aceite da finalidade — E-002).
 */
export function renderWelcomeEmail({ nome, papel }: WelcomeEmailData): RenderedEmail {
  const subject = 'Bem-vindo(a) ao Portal ASONSEG';
  const nomeSeguro = escapeHtml(nome);

  // Corpo varia conforme haja (ou não) um papel escolhido no cadastro.
  const corpoHtml = papel
    ? `<p style="margin:0 0 12px;">Seu cadastro como <strong>${escapeHtml(papel)}</strong> foi realizado com sucesso.</p>
     <p style="margin:0;">O próximo passo é aceitar os termos do seu papel para ativar o acesso completo.</p>`
    : `<p style="margin:0 0 12px;">Sua conta no Portal ASONSEG foi criada com sucesso. A partir de agora você pode acessar vagas, serviços e os demais recursos da plataforma.</p>
     <p style="margin:0;">Bons acessos!</p>`;

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     ${corpoHtml}`,
  );

  const corpoText = papel
    ? [
        `Seu cadastro como ${papel} foi realizado com sucesso.`,
        'O próximo passo é aceitar os termos do seu papel para ativar o acesso completo.',
      ]
    : [
        'Sua conta no Portal ASONSEG foi criada com sucesso. A partir de agora você pode acessar vagas, serviços e os demais recursos da plataforma.',
        'Bons acessos!',
      ];

  const text = [`Olá, ${nome}!`, '', ...corpoText].join('\n');

  return { subject, html, text };
}
