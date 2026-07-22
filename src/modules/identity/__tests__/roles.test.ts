import { describe, it, expect } from 'vitest';
import { describeActiveRoles, ALL_ROLE_LABELS } from '../domain/roles';

/**
 * USP-061 — APP-SHELL-03, APP-SHELL-04.
 *
 * `describeActiveRoles` converte `CurrentPerson.roles` (string[]) no rótulo
 * PT-BR exibido no header persistente. Ordem determinística vem da ordem de
 * declaração de `ALL_ROLE_LABELS`, não da ordem de `roles`.
 */

describe('describeActiveRoles — APP-SHELL-03/04', () => {
  it('papel único: retorna o rótulo PT-BR daquele papel', () => {
    expect(describeActiveRoles(['CANDIDATE'])).toBe('Candidato(a)');
  });

  it('múltiplos papéis: junta os rótulos com " · ", na ordem de ALL_ROLE_LABELS (não na ordem de entrada)', () => {
    // Entrada fora de ordem (BOARD antes de CANDIDATE) — saída deve seguir a
    // ordem de declaração do mapa (CANDIDATE ... BOARD), não a ordem de roles.
    expect(describeActiveRoles(['BOARD', 'CANDIDATE'])).toBe('Candidato(a) · Diretoria');
  });

  it('APP-SHELL-04: roles vazio retorna string vazia (linha de papel omitida)', () => {
    expect(describeActiveRoles([])).toBe('');
  });

  it('papel desconhecido (fora de ALL_ROLE_LABELS) é ignorado — não quebra, não exibe string crua', () => {
    expect(describeActiveRoles(['UNKNOWN_ROLE'])).toBe('');
  });

  it('mistura de papel conhecido + desconhecido: rótulo só com o(s) papel(is) conhecido(s)', () => {
    expect(describeActiveRoles(['UNKNOWN_ROLE', 'PROVIDER'])).toBe('Prestador(a)');
  });

  it('ordem determinística é estável independentemente da ordem de entrada (input invertido produz mesma saída)', () => {
    const forward = describeActiveRoles(['CANDIDATE', 'PROVIDER', 'CLIENT']);
    const reversed = describeActiveRoles(['CLIENT', 'PROVIDER', 'CANDIDATE']);
    expect(forward).toBe(reversed);
    expect(forward).toBe(
      [ALL_ROLE_LABELS.CANDIDATE, ALL_ROLE_LABELS.PROVIDER, ALL_ROLE_LABELS.CLIENT].join(' · '),
    );
  });
});
