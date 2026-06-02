import { describe, it, expect } from 'vitest';
import { buildOwnConsentsView } from '../views/own-consents.view';
import type { OwnConsentRow } from '../queries/list-own-consents';

function row(over: Partial<OwnConsentRow>): OwnConsentRow {
  return {
    id: 'c1',
    purpose: 'JOB_APPLICATION',
    termVersion: 'v1.0',
    acceptedAt: new Date('2026-05-01T12:00:00Z'),
    revokedAt: null,
    ...over,
  };
}

describe('consents/buildOwnConsentsView', () => {
  it('mapeia finalidade vigente com nome humano, descrição e base legal (P-005)', () => {
    const [view] = buildOwnConsentsView([row({})]);
    expect(view).toMatchObject({
      consentId: 'c1',
      purpose: 'JOB_APPLICATION',
      humanName: 'Candidatura a vagas',
      status: 'vigente',
      termVersion: 'v1.0',
    });
    expect(view?.humanName).not.toMatch(/JOB_APPLICATION/); // nunca o código (P-005)
    expect(view?.legalBasis).toMatch(/LGPD/);
  });

  it('marca como revogado quando há revokedAt', () => {
    const [view] = buildOwnConsentsView([row({ revokedAt: new Date('2026-05-10T12:00:00Z') })]);
    expect(view?.status).toBe('revogado');
    expect(view?.revokedAt).toBeInstanceOf(Date);
  });

  it('marca como desatualizado quando o aceite é de versão antiga (E-005)', () => {
    const [view] = buildOwnConsentsView([row({ termVersion: 'v0.9' })]);
    expect(view?.status).toBe('desatualizado');
  });

  it('normaliza o formato legado slug@vN.M', () => {
    const [view] = buildOwnConsentsView([row({ termVersion: 'job-application@v1.0' })]);
    expect(view?.termVersion).toBe('v1.0');
    expect(view?.status).toBe('vigente');
  });

  it('preserva a ordem recebida e mapeia todas as linhas', () => {
    const views = buildOwnConsentsView([
      row({ id: 'a', purpose: 'JOB_APPLICATION' }),
      row({ id: 'b', purpose: 'CV_AI_EXTRACTION' }),
    ]);
    expect(views.map((v) => v.consentId)).toEqual(['a', 'b']);
    expect(views[1]?.humanName).toBe('Extração de currículo por IA');
  });
});
