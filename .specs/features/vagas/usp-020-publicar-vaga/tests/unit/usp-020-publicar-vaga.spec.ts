// .specs/features/vagas/usp-020-publicar-vaga/tests/unit/usp-020-publicar-vaga.spec.ts
// FACTS (red) — fonte da verdade da USP-020 (Publicar vaga, #161).
// Na fase Execute, mover/conectar para:
//   - domain puro (validade)        → src/modules/jobs/domain/validade.ts                         (#163)
//                                      unit → src/modules/jobs/__tests__/validade.spec.ts
//   - Zod schema                    → src/modules/jobs/schemas/publish-job.schema.ts             (#163)
//   - actions (rascunho/submit)     → src/modules/jobs/actions/{create-job-draft,submit-job-for-moderation}.ts (#164)
//                                      integração → src/modules/jobs/__tests__/*.int.test.ts
//                                      padrões de referência: companies/actions/edit-company.ts (gate responsável ativo + withAudit),
//                                      moderation/transitionContent (DRAFT→IN_MODERATION, AUTHOR_ACTION)
//   - schema Job                    → prisma/schema.prisma model Job (#162) — validado por migration + typecheck
//
// Casos obrigatórios de fluxo sensível (project-guideline §12):
//   happy path · falha de validação Zod (E-004/E-005/L-003) · permissão recusada (P-006) · concorrência/dedup (P-003) · auditoria (L-004).
//   Consentimento: N/A nesta US (publicar vaga não é operação ligada a finalidade LGPD de Pessoa).
//
// REGRA red: falha por falta de implementação, nunca por import quebrado.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { MAX_VALIDADE_DIAS, validadeStatus } from '@/modules/jobs';      // domain (#163)
// import { publishJobSchema } from '@/modules/jobs';                       // schema (#163)
// import { createJobDraft, submitJobForModeration } from '@/modules/jobs'; // actions (#164)

const MAX_VALIDADE_DIAS = 180;

function validadeStatus(_validUntil: Date, _hojeSP: Date): 'ok' | 'passado' | 'excede_teto' {
  throw new Error('not implemented — fact red da USP-020 (#163)');
}
function submitJobForModeration(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-020 (#164)');
}
function createJobDraft(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-020 (#164)');
}

const HOJE_SP = new Date('2026-06-16T12:00:00-03:00');

describe('USP-020 — Publicar vaga', () => {
  // ───────────── E-004 / E-005 — regra pura de validade (timezone SP, teto 180d) ─────────────
  describe('validadeStatus — regra pura (E-004 / E-005 / P-005)', () => {
    it('retorna "ok" para data futura dentro do teto (E-001)', () => {
      expect(validadeStatus(new Date('2026-09-01'), HOJE_SP)).toBe('ok');
    });

    it('retorna "passado" quando a validade é anterior a hoje em America/Sao_Paulo (E-004)', () => {
      expect(validadeStatus(new Date('2026-06-10'), HOJE_SP)).toBe('passado');
    });

    it('retorna "passado" quando a validade é igual a hoje no fuso America/Sao_Paulo (E-004 — borda)', () => {
      expect(validadeStatus(new Date('2026-06-16'), HOJE_SP)).toBe('passado');
    });

    it('retorna "excede_teto" quando a validade ultrapassa 180 dias (E-005 / P-005)', () => {
      expect(validadeStatus(new Date('2027-06-16'), HOJE_SP)).toBe('excede_teto');
    });

    it('aceita exatamente o teto de 180 dias como "ok" (E-005 — borda)', () => {
      const teto = new Date(HOJE_SP);
      teto.setDate(teto.getDate() + MAX_VALIDADE_DIAS);
      expect(validadeStatus(teto, HOJE_SP)).toBe('ok');
    });
  });

  // ───────────── E-001 — submissão válida → IN_MODERATION (integração) ─────────────
  describe('submitJobForModeration — submissão válida (E-001 / AC-020-1)', () => {
    it('persiste a vaga em IN_MODERATION vinculada à Empresa e ao autor, com auditoria CONTENT_SUBMITTED_TO_MODERATION', async () => {
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente de balcão',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'Atendimento ao cliente no balcão.',
        requirements: 'Ensino médio completo.',
        workRegime: 'CLT',
        location: 'São Paulo - SP',
        validUntil: '2026-09-01',
      });
      expect(res).toMatchObject({ ok: true, data: { status: 'IN_MODERATION' } });
      // E: job.companyId === companyId; job.authorPersonId === pessoa da sessão
      // E: audit_log contém CONTENT_SUBMITTED_TO_MODERATION (via transitionContent)
    });
  });

  // ───────────── E-003 — rascunho (integração) ─────────────
  describe('createJobDraft — rascunho (E-003 / AC-020-4)', () => {
    it('persiste a vaga em DRAFT sem enviar à moderação (auditoria JOB_DRAFT_SAVED)', async () => {
      const res = await createJobDraft({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Rascunho de vaga',
      });
      expect(res).toMatchObject({ ok: true, data: { status: 'DRAFT' } });
      // E: NÃO há transição para IN_MODERATION; audit_log contém JOB_DRAFT_SAVED
    });
  });

  // ───────────── E-004 / E-005 / L-003 — falha de validação Zod (integração) ─────────────
  describe('submitJobForModeration — validação de fronteira (E-004 / E-005 / L-003)', () => {
    it('bloqueia com VALIDATION quando a validade é passada (E-004)', async () => {
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2026-06-10',
      });
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    });

    it('bloqueia com VALIDATION quando a validade excede 180 dias (E-005 / P-005)', async () => {
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2027-06-16',
      });
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    });

    it.each(['title', 'areaId', 'description', 'requirements', 'workRegime', 'location', 'validUntil'])(
      'bloqueia com VALIDATION quando falta o campo obrigatório "%s" (L-003)',
      async (_campo) => {
        // contexto: payload completo menos o campo `_campo`
        const res = await submitJobForModeration({ companyId: '00000000-0000-0000-0000-0000000000c0' });
        expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
      },
    );
  });

  // ───────────── P-006 — gate de responsável ativo (anti-bypass) ─────────────
  describe('submitJobForModeration — permissão (P-006 / D-005)', () => {
    it('nega com FORBIDDEN quando a Pessoa não é responsável ATIVO da Empresa, sem persistir', async () => {
      // contexto: sessão de Pessoa sem PersonCompanyGrant ACTIVE da companyId
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2026-09-01',
      });
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    });

    it('nega com FORBIDDEN quando o vínculo de responsável está apenas PENDING', async () => {
      // contexto: PersonCompanyGrant status PENDING (não conta como autorização)
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2026-09-01',
      });
      expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    });
  });

  // ───────────── P-003 — dedup EXATA via UNIQUE → CONFLICT (ADR-0021) ─────────────
  describe('submitJobForModeration / createJobDraft — dedup exata (P-003 / ADR-0021)', () => {
    it('rejeita com CONFLICT a segunda vaga viva idêntica (título+Empresa+área)', async () => {
      // contexto: já existe vaga viva (DRAFT/IN_MODERATION/ACTIVE) com mesmo companyId+areaId+title
      const res = await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente de balcão',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2026-09-01',
      });
      expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    });

    it('resolve submissão concorrente do mesmo rascunho em uma única transição (a 2ª recebe INVALID_TRANSITION)', async () => {
      // contexto: dois submits paralelos do mesmo jobId em DRAFT — concorrência otimista (ADR-0011 R3)
      expect.hasAssertions();
      await submitJobForModeration({ jobId: '00000000-0000-0000-0000-0000000000d1' });
    });
  });

  // ───────────── L-004 — auditoria imutável da submissão ─────────────
  describe('submitJobForModeration — auditoria (L-004 / ADR-0023)', () => {
    it('grava CONTENT_SUBMITTED_TO_MODERATION com ator e entidade da vaga (append-only)', async () => {
      expect.hasAssertions();
      await submitJobForModeration({
        companyId: '00000000-0000-0000-0000-0000000000c0',
        title: 'Atendente de balcão',
        areaId: '00000000-0000-0000-0000-0000000000a1',
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: '2026-09-01',
      });
      // E: registro append-only (REVOKE UPDATE/DELETE garantido a nível de DB — ADR-0023)
    });
  });

  // ───────────── Fora desta US (downstream) ─────────────
  describe('Cobertos fora desta US', () => {
    it.todo('E-002 / P-001 — 1ª vaga de Empresa não verificada arrasta verificação na aprovação (USP-016/017)');
    it.todo('P-002 / P-007 — vaga só visível na busca pública se ACTIVE + validade futura + Empresa verificada (USP-021/024)');
    it.todo('P-004 — checklist de conformidade legal mínima na moderação (USP-016 + gate Fase 0)');
  });
});
