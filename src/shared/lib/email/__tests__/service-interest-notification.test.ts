import { describe, it, expect } from 'vitest';
import { renderServiceInterestNotificationEmail } from '../templates/service-interest-notification';

// FACTS (USP-033 / AC-033-1) — template de notificação de manifestação de
// interesse, enfileirado no Outbox na mesma transação de manifestInterest.
describe('renderServiceInterestNotificationEmail', () => {
  it('@ac-033-1 assunto não-vazio e nome do prestador/serviço/cliente presentes no corpo', () => {
    const email = renderServiceInterestNotificationEmail({
      prestadorNome: 'João Prestador',
      servicoTitulo: 'Jardinagem Residencial',
      clienteNome: 'Maria Cliente',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Jardinagem Residencial');
    expect(email.html).toContain('João Prestador');
    expect(email.html).toContain('Jardinagem Residencial');
    expect(email.html).toContain('Maria Cliente');
    expect(email.text).toContain('João Prestador');
    expect(email.text).toContain('Jardinagem Residencial');
    expect(email.text).toContain('Maria Cliente');
  });

  it('escapa HTML malicioso no corpo HTML, mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderServiceInterestNotificationEmail({
      prestadorNome: '<b>João</b>',
      servicoTitulo: 'Serviço & Cia',
      clienteNome: '<i>Maria</i>',
    });

    expect(email.html).not.toContain('<b>João</b>');
    expect(email.html).toContain('&lt;b&gt;João&lt;/b&gt;');
    expect(email.html).not.toContain('<i>Maria</i>');
    expect(email.html).toContain('&lt;i&gt;Maria&lt;/i&gt;');
    expect(email.text).toContain('<b>João</b>');
    expect(email.text).toContain('<i>Maria</i>');
  });
});
