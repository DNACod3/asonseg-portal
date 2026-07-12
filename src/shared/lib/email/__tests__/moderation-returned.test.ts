import { describe, it, expect } from 'vitest';
import { renderModerationReturnedEmail } from '../templates/moderation-returned';

// FACTS (USP-057 / USP057-02 → NOT-04 / E-003 / NOT-13) — template de devolução
// para ajustes: o MOTIVO é obrigatório e deve aparecer no corpo.
describe('renderModerationReturnedEmail', () => {
  it('@usp057-02 assunto e corpo PT-BR contêm nome do autor, tipo, título, o MOTIVO e o CTA', () => {
    const email = renderModerationReturnedEmail({
      autorNome: 'Maria Candidata',
      tipoConteudo: 'vaga',
      tituloConteudo: 'Auxiliar Administrativo',
      motivo: 'Faltou descrever as atividades exercidas no cargo anterior',
      areaUrl: 'https://portal.test/empresa',
    });

    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.subject).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Maria Candidata');
    expect(email.html).toContain('Auxiliar Administrativo');
    expect(email.html).toContain('Faltou descrever as atividades exercidas no cargo anterior');
    expect(email.html).toContain('https://portal.test/empresa');
    expect(email.text).toContain('Maria Candidata');
    expect(email.text).toContain('Faltou descrever as atividades exercidas no cargo anterior');
    expect(email.text).toContain('https://portal.test/empresa');
  });

  it('@usp057-mn-04 não contém CPF, e-mail ou referência ao moderador no corpo (minimização PII)', () => {
    const email = renderModerationReturnedEmail({
      autorNome: 'João Prestador',
      tipoConteudo: 'serviço',
      tituloConteudo: 'Aulas de Reforço',
      motivo: 'Descrição incompleta do serviço oferecido',
      areaUrl: 'https://portal.test/prestador',
    });

    expect(email.html).not.toMatch(/@/);
    expect(email.text).not.toMatch(/@/);
    expect(email.html.toLowerCase()).not.toContain('moderador');
    expect(email.text.toLowerCase()).not.toContain('moderador');
    expect(email.html).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it('escapa HTML malicioso no corpo HTML (nome/título/motivo), mas preserva cru no texto plano (anti-injeção)', () => {
    const email = renderModerationReturnedEmail({
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
