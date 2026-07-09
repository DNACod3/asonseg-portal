import { describe, it, expect } from 'vitest';
import { renderReferralNotificationEmail } from '../templates/referral-notification';

// FACTS (USP-037 / AC-037-5) — template de aviso de encaminhamento
// institucional, enfileirado no Outbox na mesma transação de createReferral.
describe('renderReferralNotificationEmail', () => {
  it('@ac-037-5 assunto não-vazio e nome da Pessoa/vaga/empresa presentes no corpo', () => {
    const email = renderReferralNotificationEmail({
      pessoaNome: 'João Pessoa',
      vagaTitulo: 'Auxiliar Administrativo',
      empresaNome: 'Empresa XPTO',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('João Pessoa');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Empresa XPTO');
    expect(email.text).toContain('João Pessoa');
    expect(email.text).toContain('Auxiliar Administrativo');
    expect(email.text).toContain('Empresa XPTO');
  });

  it('escapa HTML malicioso no corpo HTML, mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderReferralNotificationEmail({
      pessoaNome: '<b>João</b>',
      vagaTitulo: 'Vaga & Cia',
      empresaNome: '<i>Empresa</i>',
    });

    expect(email.html).not.toContain('<b>João</b>');
    expect(email.html).toContain('&lt;b&gt;João&lt;/b&gt;');
    expect(email.html).not.toContain('<i>Empresa</i>');
    expect(email.html).toContain('&lt;i&gt;Empresa&lt;/i&gt;');
    expect(email.text).toContain('<b>João</b>');
    expect(email.text).toContain('<i>Empresa</i>');
  });
});
