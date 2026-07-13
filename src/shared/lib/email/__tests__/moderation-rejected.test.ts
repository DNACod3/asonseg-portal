import { describe, it, expect } from 'vitest';
import { renderModerationRejectedEmail } from '../templates/moderation-rejected';

// FACTS (USP-057 / USP057-03 → NOT-05 / E-004 / NOT-13) — template de rejeição:
// o MOTIVO é obrigatório e deve aparecer no corpo.
describe('renderModerationRejectedEmail', () => {
  it('@usp057-03 assunto e corpo PT-BR contêm nome do autor, tipo, título, o MOTIVO e o CTA', () => {
    const email = renderModerationRejectedEmail({
      autorNome: 'Maria Candidata',
      tipoConteudo: 'vaga',
      tituloConteudo: 'Auxiliar Administrativo',
      motivo: 'Vaga não compatível com as diretrizes do portal',
      areaUrl: 'https://portal.test/empresa',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Maria Candidata');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('não foi aprovado(a)');
    expect(email.html).toContain('Vaga não compatível com as diretrizes do portal');
    expect(email.html).toContain('https://portal.test/empresa');
    expect(email.text).toContain('Maria Candidata');
    expect(email.text).toContain('Vaga não compatível com as diretrizes do portal');
    expect(email.text).toContain('https://portal.test/empresa');
  });

  it('@usp057-mn-04 não contém CPF, e-mail ou referência ao moderador no corpo (minimização PII)', () => {
    const email = renderModerationRejectedEmail({
      autorNome: 'João Prestador',
      tipoConteudo: 'serviço',
      tituloConteudo: 'Aulas de Reforço',
      motivo: 'Serviço não permitido pelas diretrizes',
      areaUrl: 'https://portal.test/prestador',
    });

    expect(email.html).not.toMatch(/@/);
    expect(email.text).not.toMatch(/@/);
    expect(email.html.toLowerCase()).not.toContain('moderador');
    expect(email.text.toLowerCase()).not.toContain('moderador');
    expect(email.html).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it('escapa HTML malicioso no corpo HTML (nome/título/motivo), mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderModerationRejectedEmail({
      autorNome: '<b>Maria</b>',
      tipoConteudo: 'perfil de candidato',
      tituloConteudo: 'Vaga & Cia',
      motivo: '<script>alert(1)</script>',
      areaUrl: 'https://portal.test/candidato?x=1&y=2',
    });

    expect(email.html).not.toContain('<b>Maria</b>');
    expect(email.html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('<b>Maria</b>');
    expect(email.text).toContain('<script>alert(1)</script>');
  });
});
