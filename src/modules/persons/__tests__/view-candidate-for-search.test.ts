import { describe, it, expect } from 'vitest';
import {
  viewCandidateForSearch,
  QUALIFICATIONS_SUMMARY_MAX,
  type SearchCandidateRow,
} from '../views/view-candidate-for-search';

/**
 * View Model do candidato para a busca ativa (USP-028). Garantia central de
 * privacidade (USP028-MN-01/MN-02/MN-05): o `Row` NUNCA carrega
 * `cpf`/`emailLogin`/`phone`/`fullAddress`/`cvStoragePath`, e `fullName` é
 * reduzido ao primeiro nome — o sobrenome nunca aparece no output.
 */

const SOBRENOME_SENSOR = 'SobrenomeDistintivoBuscaInt';

function row(overrides: Partial<SearchCandidateRow> = {}): SearchCandidateRow {
  return {
    personId: 'candidate-1',
    fullName: `Maria ${SOBRENOME_SENSOR}`,
    headline: 'Auxiliar administrativo com 3 anos de experiência',
    skillsText: 'Excel, Atendimento ao público',
    educationLevel: 'ENSINO_MEDIO',
    availability: 'Período integral',
    primaryAreaOfInterest: { name: 'Administração' },
    region: { name: 'Ingleses', cityName: 'Florianópolis' },
    ...overrides,
  };
}

describe('viewCandidateForSearch', () => {
  it('USP028-03: projeta primeiro nome, área, escolaridade, localização e resumo', () => {
    const view = viewCandidateForSearch(row());
    expect(Object.keys(view).sort()).toEqual(
      [
        'availability',
        'candidatePersonId',
        'educationLevel',
        'educationLevelLabel',
        'firstName',
        'location',
        'primaryArea',
        'qualificationsSummary',
      ].sort(),
    );
    expect(view).toEqual({
      candidatePersonId: 'candidate-1',
      firstName: 'Maria',
      primaryArea: 'Administração',
      educationLevel: 'ENSINO_MEDIO',
      educationLevelLabel: 'Ensino Médio',
      location: 'Florianópolis — Ingleses',
      availability: 'Período integral',
      qualificationsSummary: 'Auxiliar administrativo com 3 anos de experiência',
    });
  });

  it('USP028-MN-01/MN-05: nenhum campo proibido está presente no objeto nem no payload serializado', () => {
    const view = viewCandidateForSearch(row());
    for (const key of ['cpf', 'email', 'emailLogin', 'phone', 'fullAddress', 'fullName', 'cv', 'cvStoragePath']) {
      expect(view).not.toHaveProperty(key);
    }
  });

  it('USP028-MN-02: sobrenome semeado NUNCA aparece no payload serializado (só o primeiro nome)', () => {
    const view = viewCandidateForSearch(row());
    expect(view.firstName).toBe('Maria');
    expect(JSON.stringify(view)).not.toContain(SOBRENOME_SENSOR);
  });

  it('branch: região null vira location=null ("Região não informada" na UI)', () => {
    const view = viewCandidateForSearch(row({ region: null }));
    expect(view.location).toBeNull();
  });

  it('branch: escolaridade sem rótulo conhecido vira educationLevelLabel=null', () => {
    const view = viewCandidateForSearch(row({ educationLevel: 'NIVEL_DESCONHECIDO' }));
    expect(view.educationLevelLabel).toBeNull();
    expect(view.educationLevel).toBe('NIVEL_DESCONHECIDO');
  });

  it('branch: escolaridade null vira educationLevel e educationLevelLabel null', () => {
    const view = viewCandidateForSearch(row({ educationLevel: null }));
    expect(view.educationLevel).toBeNull();
    expect(view.educationLevelLabel).toBeNull();
  });

  it('branch: resumo cai para skillsText truncado quando headline ausente', () => {
    const longSkills = 'x'.repeat(QUALIFICATIONS_SUMMARY_MAX + 50);
    const view = viewCandidateForSearch(row({ headline: null, skillsText: longSkills }));
    expect(view.qualificationsSummary).toBe(`${'x'.repeat(QUALIFICATIONS_SUMMARY_MAX)}…`);
  });

  it('branch: resumo é null quando headline e skillsText estão ausentes', () => {
    const view = viewCandidateForSearch(row({ headline: null, skillsText: null }));
    expect(view.qualificationsSummary).toBeNull();
  });

  it('branch: área de interesse null vira primaryArea=null', () => {
    const view = viewCandidateForSearch(row({ primaryAreaOfInterest: null }));
    expect(view.primaryArea).toBeNull();
  });
});
