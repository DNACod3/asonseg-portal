import { describe, it, expect } from 'vitest';
import { orderActiveRolePanels } from '../domain/dashboard-panels';

/**
 * Unit test de `orderActiveRolePanels` (USP-067 — T9 / PNL-00, A-14/A-17).
 * Import direto do arquivo (não do barrel `@/modules/identity`) — lição
 * MEMORY `coverage-gate-branch-loading-drop`.
 */
describe('orderActiveRolePanels (T9)', () => {
  it('papel composto: retorna os blocos na ordem CANDIDATE > PROVIDER > CLIENT > COMPANY_RESPONSIBLE > INSTITUTIONAL', () => {
    const result = orderActiveRolePanels(['COMPANY_RESPONSIBLE', 'CANDIDATE', 'CLIENT', 'PROVIDER'], {
      institutional: true,
    });
    expect(result).toEqual(['CANDIDATE', 'PROVIDER', 'CLIENT', 'COMPANY_RESPONSIBLE', 'INSTITUTIONAL']);
  });

  it('papel único CANDIDATE: só o bloco CANDIDATE', () => {
    const result = orderActiveRolePanels(['CANDIDATE'], { institutional: false });
    expect(result).toEqual(['CANDIDATE']);
  });

  it('papel-zero (sem papel público/institucional): []', () => {
    const result = orderActiveRolePanels([], { institutional: false });
    expect(result).toEqual([]);
  });

  it('VOLUNTEER sem delegação: nenhum bloco (não tem bloco próprio, e institutional=false)', () => {
    const result = orderActiveRolePanels(['VOLUNTEER'], { institutional: false });
    expect(result).toEqual([]);
  });

  it('VOLUNTEER COM delegação de moderação: só o bloco INSTITUTIONAL (A-17)', () => {
    const result = orderActiveRolePanels(['VOLUNTEER'], { institutional: true });
    expect(result).toEqual(['INSTITUTIONAL']);
  });

  it('COORDINATOR: bloco INSTITUTIONAL (colapsa COORDINATOR/SOCIAL_ASSISTANT/BOARD)', () => {
    const result = orderActiveRolePanels(['COORDINATOR'], { institutional: true });
    expect(result).toEqual(['INSTITUTIONAL']);
  });

  it('todos os papéis simultâneos: ordem completa e determinística', () => {
    const result = orderActiveRolePanels(
      ['BOARD', 'SOCIAL_ASSISTANT', 'COORDINATOR', 'VOLUNTEER', 'COMPANY_RESPONSIBLE', 'CLIENT', 'PROVIDER', 'CANDIDATE'],
      { institutional: true },
    );
    expect(result).toEqual(['CANDIDATE', 'PROVIDER', 'CLIENT', 'COMPANY_RESPONSIBLE', 'INSTITUTIONAL']);
  });
});
