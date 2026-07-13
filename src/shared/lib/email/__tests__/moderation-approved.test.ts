import { describe, it, expect } from 'vitest';
import { renderModerationApprovedEmail } from '../templates/moderation-approved';

// FACTS (USP-057 / USP057-01 → NOT-03 / E-002) — template de aprovação de
// conteúdo: publicação confirmada, SEM motivo, com link para a área do autor.
describe('renderModerationApprovedEmail', () => {
  it('@usp057-01 assunto e corpo PT-BR contêm nome do autor, tipo, título e CTA — sem motivo', () => {
    const email = renderModerationApprovedEmail({
      autorNome: 'Maria Candidata',
      tipoConteudo: 'vaga',
      tituloConteudo: 'Auxiliar Administrativo',
      areaUrl: 'https://portal.test/empresa',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Maria Candidata');
    expect(email.html).toContain('vaga');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('publicado(a)');
    expect(email.html).toContain('https://portal.test/empresa');
    expect(email.text).toContain('Maria Candidata');
    expect(email.text).toContain('Auxiliar Administrativo');
    expect(email.text).toContain('https://portal.test/empresa');
  });

  it('@usp057-mn-04 não contém CPF, e-mail ou referência ao moderador no corpo (minimização PII)', () => {
    const email = renderModerationApprovedEmail({
      autorNome: 'João Prestador',
      tipoConteudo: 'serviço',
      tituloConteudo: 'Aulas de Reforço',
      areaUrl: 'https://portal.test/prestador',
    });

    expect(email.html).not.toMatch(/@/);
    expect(email.text).not.toMatch(/@/);
    expect(email.html.toLowerCase()).not.toContain('moderador');
    expect(email.text.toLowerCase()).not.toContain('moderador');
    expect(email.html).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it('escapa HTML malicioso no corpo HTML, mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderModerationApprovedEmail({
      autorNome: '<b>Maria</b>',
      tipoConteudo: 'perfil de candidato',
      tituloConteudo: 'Vaga & Cia',
      areaUrl: 'https://portal.test/candidato?x=1&y=2',
    });

    expect(email.html).not.toContain('<b>Maria</b>');
    expect(email.html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
    expect(email.html).toContain('Vaga &amp; Cia');
    expect(email.text).toContain('<b>Maria</b>');
    expect(email.text).toContain('https://portal.test/candidato?x=1&y=2');
  });
});
