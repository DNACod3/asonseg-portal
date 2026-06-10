// .specs/features/cadastros-publicos/usp-009-cadastro-candidato/tests/unit/usp-009-cadastro-candidato.spec.ts
// FACTS (red) — fonte da verdade da USP-009 (Cadastro de candidato, #31).
// Na fase Execute, mover/conectar para:
//   - schema Zod  → src/modules/persons/schemas/candidate.ts        (#41)
//   - domain puro → src/modules/persons/domain/candidate.ts         (#41)
//   - actions     → src/modules/persons/__tests__/*.int.test.ts     (#44) — padrão create-company.int.test.ts
//
// Casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão recusada · consentimento ausente · concorrência/idempotência.
//
// REGRA red: falha por falta de implementação, nunca por import quebrado.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { activateCandidateRole, submitCandidateForModeration } from '@/modules/persons';
// import { candidateSchema, normalizePhone } from '@/modules/persons';
function activateCandidateRole(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-009 (#44)');
}
function submitCandidateForModeration(_personId: string): never {
  throw new Error('not implemented — fact red da USP-009 (#44)');
}

const VALID_INPUT = {
  educationLevel: 'ENSINO_MEDIO',
  primaryAreaOfInterestId: '00000000-0000-0000-0000-000000000001',
  phone: '(11) 98888-7777',
  headline: 'Auxiliar administrativo',
};

describe('USP-009 — Cadastro de candidato', () => {
  // ───────────── CAD-01 — ativar papel em DRAFT ─────────────
  describe('CAD-01 — ativação do papel (happy path)', () => {
    it('ativa o papel e cria CandidateProfile em DRAFT, com auditoria', async () => {
      const res = await activateCandidateRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: CandidateProfile.publicationStatus === 'DRAFT'
      // E: papel CANDIDATE ativo para a Person
      // E: evento de auditoria 'CANDIDATE_ROLE_ACTIVATED' registrado
    });
  });

  describe('CAD-01 / EDGE — validação Zod dos campos obrigatórios', () => {
    it.each([['educationLevel'], ['primaryAreaOfInterestId'], ['phone']])(
      'rejeita submissão sem %s com erro VALIDATION e fieldErrors PT-BR',
      async (campo) => {
        const input = { ...VALID_INPUT, [campo]: undefined };
        const res = await activateCandidateRole(input);
        expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
        // E: error.fieldErrors[campo] presente, mensagem em PT-BR
      },
    );
  });

  describe('CAD-01 — permissão / autenticação', () => {
    it('recusa requisitante não autenticado com UNAUTHENTICATED', async () => {
      // contexto: sem sessão (mock getCurrentPerson → null)
      const res = await activateCandidateRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    });
  });

  describe('CAD-01 / EDGE — idempotência (concorrência)', () => {
    it('reativar não duplica o CandidateProfile e retorna sucesso', async () => {
      await activateCandidateRole(VALID_INPUT);
      const res = await activateCandidateRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: existe exatamente 1 CandidateProfile para a Person
    });
    it.todo('rejeita corrida de duas submissões simultâneas sem criar dois perfis');
  });

  // ───────────── CAD-05 — consentimento LGPD ─────────────
  describe('CAD-05 — consentimento por finalidade', () => {
    it('exige consentimento ativo para PORTAL_ACCESS e JOB_APPLICATION', async () => {
      const res = await activateCandidateRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: requireActiveConsent chamado para 'PORTAL_ACCESS' e 'JOB_APPLICATION'
    });
    it('bloqueia com CONSENT_REQUIRED quando falta consentimento de JOB_APPLICATION', async () => {
      // contexto: consentimento JOB_APPLICATION ausente/revogado
      const res = await activateCandidateRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: false, error: { code: 'CONSENT_REQUIRED' } });
      // E: nenhum CandidateProfile criado
    });
    it.todo('registra CV_AI_EXTRACTION apenas quando há anexo de CV (CAD-02 parcial)');
  });

  // ───────────── CAD-03 — enviar para moderação (USP-016 mergeada ✅) ─────────────
  // transitionContent (@/modules/moderation) já existe e audita a transição internamente
  // (emite CONTENT_SUBMITTED_TO_MODERATION). A Action delega para ele com
  // contentKind: ContentKind.CANDIDATE_PROFILE, trigger: 'AUTHOR_ACTION'.
  describe('CAD-03 — enviar perfil para moderação', () => {
    it('transiciona DRAFT → IN_MODERATION via transitionContent (CANDIDATE_PROFILE / AUTHOR_ACTION)', async () => {
      // pré: CandidateProfile da Person em DRAFT
      const res = await submitCandidateForModeration('person-id');
      expect(res).toMatchObject({ ok: true, data: { to: 'IN_MODERATION' } });
      // E: auditoria CONTENT_SUBMITTED_TO_MODERATION registrada por transitionContent (mesma tx)
      // E: status nunca alterado por prisma.update direto
    });
    it('rejeita envio a partir de status inválido (INVALID_TRANSITION)', async () => {
      // pré: CandidateProfile já em IN_MODERATION
      const res = await submitCandidateForModeration('person-id');
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    });
    it.todo('adapter PrismaCandidateProfileStatusRepository: updateStatus respeita concorrência otimista (from)');
  });

  // ───────────── CAD-02 / CAD-04 — diferidos ─────────────
  describe('CAD-02 — anexo de CV + extração IA (diferido USP-040)', () => {
    it.todo('invoca extração por IA e pré-preenche campos ao anexar CV — especificado/testado na USP-040');
  });
  describe('CAD-04 — aprovação do coordenador (fora do escopo — USP-016)', () => {
    it.todo('ativa candidato visível na busca + e-mail ao aprovar — fluxo do coordenador (USP-016)');
  });
});

// Facts de domínio/schema puros (#41) — independem de IO, ficam green cedo.
describe('USP-009 — schema/domain (CAD-01 / EDGE)', () => {
  // import { candidateSchema, normalizePhone } from '@/modules/persons';
  it.todo('candidateSchema rejeita escolaridade/área/telefone ausentes com mensagens PT-BR');
  it.todo('candidateSchema aceita os campos opcionais (headline, experienceText, etc.)');
  it.todo('normalizePhone normaliza "(11) 98888-7777" para o formato canônico');
});
