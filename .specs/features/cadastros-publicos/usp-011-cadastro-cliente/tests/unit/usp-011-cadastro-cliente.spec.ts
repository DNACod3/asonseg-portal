// .specs/features/cadastros-publicos/usp-011-cadastro-cliente/tests/unit/usp-011-cadastro-cliente.spec.ts
// FACTS (red) — fonte da verdade da USP-011 (Cadastro de cliente de serviço — papel, #118).
// Na fase Execute, mover/conectar para:
//   - domain puro → src/modules/persons/domain/client.ts                       (#120)
//   - helper tx   → src/modules/persons/__tests__/ensure-client-role.int.test.ts (#120)
//                   padrão de referência: identity/actions/activate-additional-role.ts (corpo da tx)
//   - schema      → prisma/schema.prisma model ClientProfile (#119) — validado por migration + typecheck
//
// Casos obrigatórios de fluxo sensível (project-guideline §12), recortados ao helper:
//   happy path (ativação) · atomicidade/consent (P-001) · idempotência (E-002) · auditoria condicional.
//   permissão (P-003) e termo/UI (P-002) → USP-033 (fora desta US).
//
// Diferença vs. USP-009/010: NÃO há Server Action standalone — `ensureClientRole` recebe `tx` (ADR-0020).
// Sem moderação / sem publicationStatus (perfil leve, ADR-0008/0011).
//
// REGRA red: falha por falta de implementação, nunca por import quebrado.

import { describe, it, expect } from 'vitest';

// Stubs temporários — substituir pelos imports reais na fase Execute.
// import { decideClientActivation } from '@/modules/persons';        // domain puro (#120)
// import { ensureClientRole } from '@/modules/persons';              // helper tx (#120)
type Role =
  | 'CANDIDATE' | 'PROVIDER' | 'CLIENT' | 'COMPANY_RESPONSIBLE'
  | 'VOLUNTEER' | 'COORDINATOR' | 'SOCIAL_ASSISTANT' | 'BOARD';

function decideClientActivation(_currentRoles: Role[]): { needsActivation: boolean } {
  throw new Error('not implemented — fact red da USP-011 (#120)');
}
function ensureClientRole(_tx: unknown, _args: unknown): never {
  throw new Error('not implemented — fact red da USP-011 (#120)');
}

describe('USP-011 — Cadastro de cliente de serviço (papel)', () => {
  // ───────────── E-002 / domínio — regra pura de idempotência ─────────────
  describe('decideClientActivation — regra pura (E-002 / AC #118-3)', () => {
    it('indica needsActivation=true quando o papel CLIENT está ausente', () => {
      expect(decideClientActivation(['CANDIDATE'])).toEqual({ needsActivation: true });
    });

    it('indica needsActivation=false quando o papel CLIENT já está presente', () => {
      expect(decideClientActivation(['CLIENT'])).toEqual({ needsActivation: false });
    });

    it('é idempotente: não há ativação quando CLIENT coexiste com outros papéis', () => {
      expect(decideClientActivation(['CANDIDATE', 'CLIENT'])).toEqual({ needsActivation: false });
    });
  });

  // ───────────── E-001 (parte server) — 1ª ativação atômica ─────────────
  describe('ensureClientRole — primeira ativação (E-001 / AC #118-1, #118-2)', () => {
    it('ativa o papel CLIENT, cria ClientProfile e persiste consents SERVICE_HIRING + PORTAL_ACCESS na mesma tx', async () => {
      const res = await ensureClientRole(/* tx */ {}, {
        personId: '00000000-0000-0000-0000-000000000001',
        term: { version: 'service-hiring@v1.0', hash: 'sha256-stub' },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      });
      expect(res).toMatchObject({ activated: true });
      // E: grant CLIENT em status 'ACTIVE'
      // E: Consent SERVICE_HIRING (versão+data+IP) gravado na MESMA tx (P-001)
      // E: Consent PORTAL_ACCESS ativo garantido
      // E: ClientProfile upsert por personId
      // E: auditoria 'CLIENT_ROLE_ACTIVATED' + 'CONSENT_GRANTED'
    });

    it('promove o grant a ACTIVE somente após o consent persistido (P-001 — ordem)', async () => {
      // Invariante de ordem: nenhum grant ACTIVE observável antes do Consent SERVICE_HIRING.
      const res = await ensureClientRole({}, {
        personId: '00000000-0000-0000-0000-000000000001',
        term: { version: 'service-hiring@v1.0', hash: 'sha256-stub' },
        ip: null,
        userAgent: null,
      });
      expect(res).toMatchObject({ activated: true });
    });
  });

  // ───────────── P-001 — atomicidade: falha de consent reverte tudo ─────────────
  describe('ensureClientRole — atomicidade (P-001)', () => {
    it('reverte a transação se a persistência do consentimento falhar; nenhum grant ACTIVE permanece', async () => {
      // contexto: tx que rejeita ao criar o Consent SERVICE_HIRING
      await expect(
        ensureClientRole(/* tx que falha no consent */ {}, {
          personId: '00000000-0000-0000-0000-000000000001',
          term: { version: 'service-hiring@v1.0', hash: 'sha256-stub' },
          ip: null,
          userAgent: null,
        }),
      ).rejects.toBeTruthy();
      // E: rollback — sem grant CLIENT ACTIVE, sem ClientProfile
    });
  });

  // ───────────── E-002 — idempotência do helper (no-op quando já ativo) ─────────────
  describe('ensureClientRole — idempotência (E-002 / AC #118-3)', () => {
    it('é no-op quando o papel CLIENT já está ativo: não duplica grant, consent nem ClientProfile', async () => {
      // contexto: Person já com grant CLIENT ACTIVE
      const res = await ensureClientRole(/* tx */ {}, {
        personId: '00000000-0000-0000-0000-000000000001',
        term: { version: 'service-hiring@v1.0', hash: 'sha256-stub' },
        ip: null,
        userAgent: null,
      });
      expect(res).toMatchObject({ activated: false });
    });

    it('emite CLIENT_ROLE_ACTIVATED apenas na ativação real (uma vez em duas execuções)', async () => {
      // 1ª execução ativa (emite evento); 2ª é no-op (não emite). Total = 1 evento.
      // Asserção concreta na fase Execute (contagem de auditLog por action).
      expect.hasAssertions();
      await ensureClientRole({}, {
        personId: '00000000-0000-0000-0000-000000000001',
        term: { version: 'service-hiring@v1.0', hash: 'sha256-stub' },
        ip: null,
        userAgent: null,
      });
    });
  });

  // ───────────── P-003 / E-001-UI / P-002 / L-001 — fora desta US (USP-033) ─────────────
  describe('Cobertos fora desta US (USP-033 — services.manifestarInteresse)', () => {
    it.todo('P-003 — manifestação sem sessão é recusada com UNAUTHENTICATED antes de ativar o papel');
    it.todo('E-001-UI / P-002 — termo da finalidade 4 exibido + aceite explícito (scroll-to-accept) antes da ativação');
    it.todo('L-001 — ativação automática + manifestação ≤ 2s p95');
  });
});
