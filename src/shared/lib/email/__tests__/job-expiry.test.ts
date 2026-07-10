import { describe, it, expect } from 'vitest';
import { renderJobExpiryEmail } from '../templates/job-expiry';

// FACTS (USP-044 / AC-044-D3) — template de aviso de expiração próxima de vaga
// (D-3), hidratado pelo dispatcher assíncrono do Outbox a partir do payload leve
// {kind:'JOB_EXPIRY_D3'}. E-003/P-002: sem PII de terceiro no corpo.
describe('renderJobExpiryEmail', () => {
  it('@ac-044-d3 assunto e corpo PT-BR contêm título da vaga e dias restantes', () => {
    const email = renderJobExpiryEmail({
      empresaNome: 'ACME Ltda',
      vagaTitulo: 'Auxiliar Administrativo',
      diasRestantes: 3,
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.subject).toContain('3 dia(s)');
    expect(email.html).toContain('ACME Ltda');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('3 dia(s)');
    expect(email.text).toContain('ACME Ltda');
    expect(email.text).toContain('Auxiliar Administrativo');
    expect(email.text).toContain('3 dia(s)');
  });

  it('não contém e-mail nem telefone de terceiros no corpo (minimização — E-003/P-002)', () => {
    const email = renderJobExpiryEmail({
      empresaNome: 'ACME Ltda',
      vagaTitulo: 'Auxiliar Administrativo',
      diasRestantes: 3,
    });

    expect(email.html).not.toMatch(/@/);
    expect(email.text).not.toMatch(/@/);
  });

  it('escapa HTML malicioso no corpo HTML, mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderJobExpiryEmail({
      empresaNome: '<b>ACME</b>',
      vagaTitulo: 'Vaga & Cia',
      diasRestantes: 1,
    });

    expect(email.html).not.toContain('<b>ACME</b>');
    expect(email.html).toContain('&lt;b&gt;ACME&lt;/b&gt;');
    expect(email.text).toContain('<b>ACME</b>');
  });
});
