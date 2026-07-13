import { describe, it, expect } from 'vitest';
import { revocationCascadeFor } from '../domain/revocation-cascade';

/**
 * Contrato da matriz de cascata para `JOB_APPLICATION` (USP-053 / CAND-7 —
 * drift guard). Amarra a implementação dos participantes de tx (T1/T2) à
 * política **já declarada e aprovada** (DPO+jurídico, 2026-06-03) — se a
 * matriz mudar os efeitos declarados, este teste falha e sinaliza que a
 * implementação precisa ser revista. Os participantes não leem a matriz em
 * runtime (mantidos simples); este é o elo estático entre os dois.
 */
describe('revocationCascadeFor(JOB_APPLICATION) — contrato da política declarada', () => {
  it('declara ENCERRAR+MARCAR para candidaturas-ativas', () => {
    const rule = revocationCascadeFor('JOB_APPLICATION');
    const artefato = rule.artifactEffects.find((ae) => ae.artifact === 'candidaturas-ativas');
    expect(artefato).toBeDefined();
    expect(artefato?.effects).toEqual(['ENCERRAR', 'MARCAR']);
  });

  it('declara OCULTAR para perfil-candidato-visivel-empregadores', () => {
    const rule = revocationCascadeFor('JOB_APPLICATION');
    const artefato = rule.artifactEffects.find(
      (ae) => ae.artifact === 'perfil-candidato-visivel-empregadores',
    );
    expect(artefato).toBeDefined();
    expect(artefato?.effects).toEqual(['OCULTAR']);
  });

  it('declara MANTER para dados-ja-vistos-empregador (não-retroativo)', () => {
    const rule = revocationCascadeFor('JOB_APPLICATION');
    const artefato = rule.artifactEffects.find((ae) => ae.artifact === 'dados-ja-vistos-empregador');
    expect(artefato).toBeDefined();
    expect(artefato?.effects).toEqual(['MANTER']);
  });
});
