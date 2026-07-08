// .specs/features/vagas/usp-023-editar-vaga/tests/unit/usp-023-editar-vaga.spec.ts
// FACTS (red) — fonte da verdade da USP-023 (Editar vaga: pausar, arquivar, renovar).
// Regenerado em T0 (skill-tdad) a partir de spec.md/design.md vigentes — substitui os facts
// stale de uma geração anterior cujo design não tinha ainda editJob/pauseJob/unpauseJob/
// archiveJob/extendJobValidity/listCompanyJobs/getPausedJobNotice definidos.
//
// Na fase Execute, cada bloco abaixo é a base conceitual do teste REAL que a task escreve
// (derivado de spec.md, não deste stub) em:
//   - eventTypeFor kind-aware (T1) → src/modules/moderation/__tests__/*.spec.ts
//   - published_at no adapter (T1) → src/modules/jobs/__tests__/published-at.int.test.ts
//   - requireActiveResponsible (T2) → cobertura de preservação em submit-job-for-moderation
//   - pauseJob/unpauseJob (T3) → src/modules/jobs/__tests__/pause-job.int.test.ts
//   - archiveJob (T4) → src/modules/jobs/__tests__/archive-job.int.test.ts
//   - extendJobValidity (T5) → src/modules/jobs/__tests__/extend-job-validity.int.test.ts
//   - editJob (T6) → src/modules/jobs/__tests__/edit-job.int.test.ts
//   - guarda U23-MN-07 (T6) → src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts
//   - getPausedJobNotice (T7) → src/modules/jobs/__tests__/get-paused-job-notice.int.test.ts
//   - listCompanyJobs (T8) → src/modules/jobs/__tests__/list-company-jobs.int.test.ts
//
// Casos obrigatórios de Server Action (project-guideline §12): happy · validação Zod ·
// permissão (P-005/FORBIDDEN) · precondição/conflito de transição · concorrência.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituídos pelos imports reais na fase Execute.
function eventTypeFor(
  _contentKind: unknown,
  _from: unknown,
  _to: unknown,
  _trigger: unknown,
): never {
  throw new Error('not implemented — fact red da USP-023 (T1)');
}
function pauseJob(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-023 (T3)');
}
function unpauseJob(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-023 (T3)');
}
function archiveJob(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-023 (T4)');
}
function extendJobValidity(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-023 (T5)');
}
function editJob(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-023 (T6)');
}

describe('USP-023 — Editar vaga (pausar, arquivar, renovar)', () => {
  describe('T1 — eventTypeFor kind-aware (JOB)', () => {
    it('mapeia JOB PAUSED → JOB_PAUSED', () => {
      expect(() => eventTypeFor('JOB', 'ACTIVE', 'PAUSED', 'AUTHOR_ACTION')).toThrow();
    });
    it('mapeia JOB ARCHIVED → JOB_ARCHIVED', () => {
      expect(() => eventTypeFor('JOB', 'ACTIVE', 'ARCHIVED', 'AUTHOR_ACTION')).toThrow();
    });
    it('mapeia JOB (from=PAUSED) ACTIVE → JOB_UNPAUSED (distingue de aprovação)', () => {
      expect(() => eventTypeFor('JOB', 'PAUSED', 'ACTIVE', 'AUTHOR_ACTION')).toThrow();
    });
    it.todo('preserva o mapa compartilhado — CV/SERVICE/CANDIDATE_PROFICE sem regressão');
  });

  describe('AC-023-1 — editJob (happy path)', () => {
    it('vaga ACTIVE editada vira DRAFT, audita before/after e retorna { jobId, status: "DRAFT" }', () => {
      expect(() =>
        editJob({ jobId: 'job-1', title: 'Vaga Editada' }),
      ).toThrow();
    });
  });

  describe('AC-023-1 / P-005 — editJob nega não-responsável', () => {
    it('retorna FORBIDDEN sem qualquer escrita', () => {
      expect(() => editJob({ jobId: 'job-1', title: 'x' })).toThrow();
    });
  });

  describe('AC-023-1 — editJob recusa vaga não-ACTIVE', () => {
    it('vaga PAUSED/DRAFT/ARCHIVED → conflito/precondição, sem escrita parcial', () => {
      expect(() => editJob({ jobId: 'job-paused', title: 'x' })).toThrow();
    });
  });

  describe('U23-MN-07 — guarda estática (T6)', () => {
    it.todo(
      'nenhuma escrita de Job.status fora de PrismaJobStatusRepository/editJob; editJob só where status=ACTIVE',
    );
  });

  describe('AC-023-2 — pauseJob / unpauseJob (happy path)', () => {
    it('pausa ACTIVE→PAUSED e grava JOB_PAUSED', () => {
      expect(() => pauseJob({ jobId: 'job-1' })).toThrow();
    });
    it('despausa PAUSED→ACTIVE, grava JOB_UNPAUSED, sem re-moderação', () => {
      expect(() => unpauseJob({ jobId: 'job-1' })).toThrow();
    });
  });

  describe('AC-023-2 / P-005 — pauseJob/unpauseJob negam não-responsável', () => {
    it('pauseJob retorna FORBIDDEN', () => {
      expect(() => pauseJob({ jobId: 'job-1' })).toThrow();
    });
    it('unpauseJob retorna FORBIDDEN', () => {
      expect(() => unpauseJob({ jobId: 'job-1' })).toThrow();
    });
  });

  describe('AC-023-3 — archiveJob (happy path + terminalidade P-006)', () => {
    it('arquiva ACTIVE→ARCHIVED e grava JOB_ARCHIVED', () => {
      expect(() => archiveJob({ jobId: 'job-1' })).toThrow();
    });
    it.todo('transitionContent(ARCHIVED→ACTIVE) retorna INVALID_TRANSITION (P-006, negativo)');
  });

  describe('AC-023-3 / P-005 — archiveJob nega não-responsável', () => {
    it('retorna FORBIDDEN', () => {
      expect(() => archiveJob({ jobId: 'job-1' })).toThrow();
    });
  });

  describe('AC-023-4 — extendJobValidity (happy path + validação)', () => {
    it('prorroga ACTIVE com data futura ≤180d, mantém ACTIVE, grava JOB_VALIDITY_EXTENDED', () => {
      expect(() =>
        extendJobValidity({ jobId: 'job-1', validUntil: '2999-01-01' }),
      ).toThrow();
    });
    it.each([
      ['data no passado', '2000-01-01'],
      ['data acima de 180 dias', '2999-12-31'],
    ])('%s → VALIDATION', (_label, validUntil) => {
      expect(() => extendJobValidity({ jobId: 'job-1', validUntil })).toThrow();
    });
    it.todo('3 prorrogações seguidas são todas aceitas (sem teto de quantidade, P-002 N/A)');
  });

  describe('AC-023-4 / P-005 — extendJobValidity nega não-responsável', () => {
    it('retorna FORBIDDEN', () => {
      expect(() => extendJobValidity({ jobId: 'job-1', validUntil: '2999-01-01' })).toThrow();
    });
  });

  describe('Concorrência — updateMany where status=from, count===1', () => {
    it.todo('duas transições/edições concorrentes sobre a mesma vaga: só uma casa');
  });
});
