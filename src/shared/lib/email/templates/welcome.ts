import type { RenderedEmail, WelcomeEmailData } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de boas-vindas (USP-001 / USP-003). Mensagem simples de
 * confirmação de cadastro; não carrega link sensível.
 */
export function renderWelcomeEmail({ nome }: WelcomeEmailData): RenderedEmail {
  const subject = 'Bem-vindo(a) ao Portal ASONSEG';
  const nomeSeguro = escapeHtml(nome);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 12px;">Sua conta no Portal ASONSEG foi criada com sucesso. A partir de agora você pode acessar vagas, serviços e os demais recursos da plataforma.</p>
     <p style="margin:0;">Bons acessos!</p>`,
  );

  const text = [
    `Olá, ${nome}!`,
    '',
    'Sua conta no Portal ASONSEG foi criada com sucesso. A partir de agora você pode acessar vagas, serviços e os demais recursos da plataforma.',
    '',
    'Bons acessos!',
  ].join('\n');

  return { subject, html, text };
}
