import type { CredentialClaimWelcomeEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de boas-vindas após a verificação de uma reivindicação de
 * credencial (USP-003 — E-002). A credencial já foi ativada pela AS/diretoria;
 * a própria Pessoa define sua senha pelo link (uso único, válido por
 * `expiraEmHoras` — reuso da infraestrutura de redefinição da USP-005).
 */
export function renderCredentialClaimWelcomeEmail({
  nome,
  setPasswordUrl,
  expiraEmHoras,
}: CredentialClaimWelcomeEmailData): RenderedEmail {
  const subject = 'Sua credencial foi ativada — Portal ASONSEG';
  const nomeSeguro = escapeHtml(nome);
  const urlSeguro = escapeHtml(setPasswordUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá, ${nomeSeguro}!</p>
     <p style="margin:0 0 16px;">Sua identidade foi verificada e a sua credencial de acesso ao Portal ASONSEG foi ativada. Para concluir, defina a sua senha clicando no botão abaixo:</p>
     <p style="margin:0 0 16px;">${ctaButton(urlSeguro, 'Definir senha')}</p>
     <p style="margin:0 0 12px;">Se o botão não funcionar, copie e cole este endereço no navegador:<br />
       <a href="${urlSeguro}" style="color:#2563eb;word-break:break-all;">${urlSeguro}</a>
     </p>
     <p style="margin:0;">Este link é válido por ${expiraEmHoras} horas e só pode ser usado uma vez. Depois de definir a senha, você poderá entrar normalmente com o seu e-mail.</p>`,
  );

  const text = [
    `Olá, ${nome}!`,
    '',
    'Sua identidade foi verificada e a sua credencial de acesso ao Portal ASONSEG foi ativada.',
    'Para concluir, defina a sua senha acessando o link abaixo:',
    '',
    setPasswordUrl,
    '',
    `Este link é válido por ${expiraEmHoras} horas e só pode ser usado uma vez.`,
    'Depois de definir a senha, você poderá entrar normalmente com o seu e-mail.',
  ].join('\n');

  return { subject, html, text };
}
