/**
 * Helpers de renderização dos templates de e-mail (PT-BR). Mantém o envelope
 * HTML consistente entre os templates e centraliza a fuga de HTML — os dados
 * interpolados (nome, URL) vêm de entrada do usuário/credencial e precisam ser
 * escapados para não permitir injeção no corpo do e-mail.
 */

/** Escapa texto para interpolação segura em HTML (atributos e conteúdo). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Envelope HTML comum dos e-mails transacionais da ASONSEG: cabeçalho com o
 * nome do portal e rodapé padrão. `innerHtml` já deve vir com os dados escapados.
 */
export function wrapHtml(titulo: string, innerHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(titulo)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#2563eb;padding:20px 24px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">Portal ASONSEG</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:14px;line-height:1.6;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                Ação Social Nossa Senhora de Guadalupe — Portal de Empregabilidade e Serviços.<br />
                Esta é uma mensagem automática, não responda a este e-mail.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Botão de ação reutilizável (CTA). `href` deve vir já escapado. */
export function ctaButton(hrefEscapado: string, rotulo: string): string {
  return `<a href="${hrefEscapado}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;">${escapeHtml(
    rotulo,
  )}</a>`;
}
