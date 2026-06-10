// .specs/features/cadastros-publicos/usp-010-cadastro-prestador/tests/unit/usp-010-cadastro-prestador.spec.ts
// FACTS (red) — fonte da verdade da USP-010 (Cadastro de prestador de serviço PF, #110).
// Na fase Execute, mover/conectar para:
//   - schema Zod  → src/modules/persons/schemas/provider.ts          (#114)
//   - domain puro → src/modules/persons/domain/provider.ts           (#114)
//   - actions     → src/modules/persons/__tests__/*.int.test.ts      (#114) — padrão activate-candidate-role.int.test.ts
//   - componente  → src/modules/persons/components/__tests__/provider-form.test.tsx (#116)
//
// Casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão recusada · consentimento ausente · concorrência/idempotência.
//
// Diferença vs. USP-009: papel PROVIDER ativo IMEDIATAMENTE, SEM moderação (ADR-0015) —
// não há submitForModeration / transitionContent nesta US.
//
// REGRA red: falha por falta de implementação, nunca por import quebrado.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { activateProviderRole } from '@/modules/persons';
// import { providerProfileSchema, normalizeCnpj, isValidCnpj } from '@/modules/persons';
function activateProviderRole(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-010 (#114)');
}

const VALID_INPUT = {
  headline: 'Eletricista predial',
  description: 'Instalações e manutenção elétrica residencial.',
  regionId: '00000000-0000-0000-0000-000000000001',
};

describe('USP-010 — Cadastro de prestador de serviço', () => {
  // ───────────── E-001 — ativar papel imediatamente, em transação única ─────────────
  describe('E-001 — ativação do papel (happy path)', () => {
    it('ativa o papel PROVIDER imediatamente e cria ProviderProfile em DRAFT, com auditoria', async () => {
      const res = await activateProviderRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: ProviderProfile.publicationStatus === 'DRAFT'
      // E: papel PROVIDER ativo para a Person (sem moderação — ADR-0015)
      // E: eventos 'ROLE_GRANT_ACTIVATED' + 'CONSENT_GRANTED' + 'PROVIDER_ROLE_ACTIVATED' auditados
    });

    it('persiste o consentimento SERVICE_OFFERING na mesma transação da ativação (P-003)', async () => {
      const res = await activateProviderRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: consent SERVICE_OFFERING (versão+data+IP) gravado atomicamente com o grant ACTIVE
    });
  });

  describe('E-001 — permissão / autenticação', () => {
    it('recusa requisitante não autenticado com UNAUTHENTICATED', async () => {
      // contexto: sem sessão (mock getCurrentPerson → null)
      const res = await activateProviderRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    });
  });

  describe('E-001 / EDGE — idempotência (concorrência)', () => {
    it('reativar não duplica papel, perfil nem consentimento e retorna sucesso', async () => {
      await activateProviderRole(VALID_INPUT);
      const res = await activateProviderRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: true });
      // E: existe exatamente 1 ProviderProfile e 1 consent SERVICE_OFFERING ativo para a Person
    });
    it.todo('rejeita corrida de duas ativações simultâneas sem criar dois perfis');
  });

  // ───────────── P-003 — consentimento na mesma transação ─────────────
  describe('P-003 — consentimento por finalidade (SERVICE_OFFERING)', () => {
    it('bloqueia com CONSENT_REQUIRED quando falta consentimento de SERVICE_OFFERING', async () => {
      // contexto: consentimento SERVICE_OFFERING ausente/revogado
      const res = await activateProviderRole(VALID_INPUT);
      expect(res).toMatchObject({ ok: false, error: { code: 'CONSENT_REQUIRED' } });
      // E: nenhum ProviderProfile criado, papel não ativado
    });
    it.todo('falha ao gravar consentimento faz rollback completo da ativação do papel (atomicidade)');
  });

  // ───────────── E-002 — CNPJ MEI redireciona ao fluxo USP-012 (ADR-0031) ─────────────
  // REVISÃO 2026-06-10: P-001/P-002 REVOGADOS. CNPJ MEI vive em `companies` (via USP-012).
  // A USP-010 não coleta CNPJ; o ProviderProfile não tem campo de CNPJ.
  describe('E-002 — MEI fora da USP-010 (redirect p/ USP-012)', () => {
    it('activateProviderRole ignora/rejeita qualquer CNPJ no input — perfil não persiste CNPJ', async () => {
      const res = await activateProviderRole({ ...VALID_INPUT, cnpjMei: '12345678000195' } as unknown);
      expect(res).toMatchObject({ ok: true });
      // E: ProviderProfile criado SEM nenhum campo de CNPJ (schema não conhece cnpjMei)
    });
    it.todo('a tela do prestador oferece CTA de MEI que navega ao fluxo USP-012 (componente)');
  });

  // ───────────── E-003 — próximo passo ─────────────
  describe('E-003 — redirecionamento ao próximo passo', () => {
    it.todo('após ativar, expõe CTA "publicar primeiro serviço" (USP-029) ou painel do prestador');
  });
});

// Facts de domínio/schema puros (#114) — independem de IO, ficam green cedo.
describe('USP-010 — schema/domain (sem CNPJ — ADR-0031)', () => {
  // import { providerProfileSchema } from '@/modules/persons';
  it.todo('providerProfileSchema aceita perfil mínimo (todos os campos opcionais)');
  it.todo('providerProfileSchema NÃO conhece o campo cnpjMei (CNPJ vive em companies — ADR-0031)');
});

// Facts de UI (#116) — componente provider-form.
describe('USP-010 — formulário do prestador (P-004 / E-002 redirect / E-003)', () => {
  it.todo('exibe copy "agora você OFERECE serviços" distinguindo de contratar/cliente (P-004)');
  it.todo('bloqueia submit sem aceite de PORTAL_ACCESS + SERVICE_OFFERING');
  it.todo('NÃO possui campo de CNPJ; CTA "registrar meu MEI" navega ao fluxo USP-012 (E-002 / ADR-0031)');
  it.todo('placeholder de upload de foto está presente e desabilitado (diferido Fase 4)');
});
