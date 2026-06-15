import type { ResponsibleLinkPendingEmailData, RenderedEmail } from '../email-sender.port';
import { ctaButton, escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR do convite para aceitar um vínculo de responsável (USP-013 — E-003).
 * Uma Pessoa-responsável de uma Empresa adicionou esta Pessoa como responsável
 * adicional; o vínculo nasce PENDING e só vira ACTIVE após o aceite explícito (P-002).
 * O link leva à rota autenticada de aceite — o link não autentica por si só; a
 * identidade vem da sessão.
 */
export function renderResponsibleLinkPendingEmail({
  empresaNome,
  acceptUrl,
}: ResponsibleLinkPendingEmailData): RenderedEmail {
  const subject = 'Convite para representar uma empresa — Portal ASONSEG';
  const empresaSegura = escapeHtml(empresaNome);
  const urlSeguro = escapeHtml(acceptUrl);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá!</p>
     <p style="margin:0 0 16px;">Você foi adicionado(a) como responsável da empresa <strong>${empresaSegura}</strong> no Portal ASONSEG. Para passar a operar vagas e serviços em nome dela, você precisa <strong>aceitar</strong> este vínculo:</p>
     <p style="margin:0 0 16px;">${ctaButton(urlSeguro, 'Revisar e aceitar vínculo')}</p>
     <p style="margin:0 0 12px;">Se o botão não funcionar, copie e cole este endereço no navegador:<br />
       <a href="${urlSeguro}" style="color:#2563eb;word-break:break-all;">${urlSeguro}</a>
     </p>
     <p style="margin:0;">Enquanto você não aceitar, o vínculo permanece pendente e você não representa a empresa. Se não reconhece este convite, ignore este e-mail.</p>`,
  );

  const text = [
    'Olá!',
    '',
    `Você foi adicionado(a) como responsável da empresa ${empresaNome} no Portal ASONSEG.`,
    'Para passar a operar vagas e serviços em nome dela, você precisa aceitar este vínculo no link abaixo:',
    '',
    acceptUrl,
    '',
    'Enquanto você não aceitar, o vínculo permanece pendente e você não representa a empresa.',
    'Se não reconhece este convite, ignore este e-mail.',
  ].join('\n');

  return { subject, html, text };
}
