import type { ResponsibleRemovedEmailData, RenderedEmail } from '../email-sender.port';
import { escapeHtml, wrapHtml } from './layout';

/**
 * Template PT-BR de notificação de remoção de vínculo de responsável (USP-014 — AC-014-1).
 * Informa à Pessoa que seu vínculo de responsável com a Empresa foi encerrado;
 * a partir de agora ela não opera mais vagas e serviços em nome dela. Sem CTA —
 * é apenas um aviso (a remoção já está persistida).
 */
export function renderResponsibleRemovedEmail({
  empresaNome,
}: ResponsibleRemovedEmailData): RenderedEmail {
  const subject = 'Seu vínculo de responsável foi encerrado — Portal ASONSEG';
  const empresaSegura = escapeHtml(empresaNome);

  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Olá!</p>
     <p style="margin:0 0 16px;">Seu vínculo de responsável pela empresa <strong>${empresaSegura}</strong> no Portal ASONSEG foi <strong>encerrado</strong>. A partir de agora você não opera mais vagas e serviços em nome dela.</p>
     <p style="margin:0;">Se você acredita que isso foi um engano, entre em contato com outro responsável da empresa para ser adicionado(a) novamente.</p>`,
  );

  const text = [
    'Olá!',
    '',
    `Seu vínculo de responsável pela empresa ${empresaNome} no Portal ASONSEG foi encerrado.`,
    'A partir de agora você não opera mais vagas e serviços em nome dela.',
    '',
    'Se você acredita que isso foi um engano, entre em contato com outro responsável da empresa para ser adicionado(a) novamente.',
  ].join('\n');

  return { subject, html, text };
}
