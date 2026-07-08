import { describe, it, expect } from 'vitest';
import { renderApplicationConfirmationEmail } from '../templates/application-confirmation';

// FACTS (USP-025 / CAN-025-02) — template de confirmação de candidatura,
// enfileirado no Outbox na mesma transação de applyToJob.
describe('renderApplicationConfirmationEmail', () => {
  it('@ac-can-025-02 assunto não-vazio e nome/vaga/empresa presentes no corpo', () => {
    const email = renderApplicationConfirmationEmail({
      candidatoNome: 'Maria Silva',
      vagaTitulo: 'Auxiliar Administrativo',
      empresaNome: 'ACME Ltda',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Maria Silva');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('ACME Ltda');
    expect(email.text).toContain('Maria Silva');
    expect(email.text).toContain('Auxiliar Administrativo');
    expect(email.text).toContain('ACME Ltda');
  });

  it('escapa HTML malicioso no corpo HTML, mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderApplicationConfirmationEmail({
      candidatoNome: '<b>Maria</b>',
      vagaTitulo: 'Vaga & Cia',
      empresaNome: '<i>ACME</i>',
    });

    expect(email.html).not.toContain('<b>Maria</b>');
    expect(email.html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
    expect(email.html).not.toContain('<i>ACME</i>');
    expect(email.html).toContain('&lt;i&gt;ACME&lt;/i&gt;');
    expect(email.text).toContain('<b>Maria</b>');
    expect(email.text).toContain('<i>ACME</i>');
  });
});
