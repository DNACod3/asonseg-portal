import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CurrentPerson } from '../server/session';
import type { ActionResult } from '@/shared/errors';

/**
 * Testes unitários de early-exit para grant/revoke de permissões (USP-008).
 * Cobrem validação Zod e os ramos de sessão/autorização que retornam antes de
 * tocar o banco — os ramos DB (happy path, NOT_FOUND, CONFLICT, append-only)
 * são cobertos em `delegated-permissions.int.test.ts`.
 */

// Mock de requireCoordinator (passo 2 canônico de ambas as actions).
// vi.hoisted é elevado antes de qualquer declaração — o valor inicial usa
// uma constante inline para evitar referência antecipada.
const authzState = vi.hoisted(() => ({
  result: {
    ok: true as const,
    data: {
      person: {
        id: 'coord-1',
        supabaseUserId: 'supa-1',
        fullName: 'Coordenador',
        status: 'ATIVO' as const,
        primeiroAcesso: false,
        roles: ['COORDINATOR'],
        phone: null,
        fullAddress: null,
      },
    },
  } as ActionResult<{ person: CurrentPerson }>,
}));

const coordinator: CurrentPerson = {
  id: 'coord-1',
  supabaseUserId: 'supa-1',
  fullName: 'Coordenador',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['COORDINATOR'],
  phone: null,
  fullAddress: null,
};

vi.mock('../server/require-permission', () => ({
  requireCoordinator: () => Promise.resolve(authzState.result),
}));

// withAudit nunca deve ser chamado nos ramos de early exit; mock para confirmar
vi.mock('@/modules/audit', () => ({
  AuditEvent: { DELEGATED_PERMISSION_GRANTED: 'DELEGATED_PERMISSION_GRANTED', DELEGATED_PERMISSION_REVOKED: 'DELEGATED_PERMISSION_REVOKED' },
  withAudit: vi.fn().mockRejectedValue(new Error('withAudit não deve ser chamado nos early-exits')),
}));

const { grantDelegatedPermission } = await import('../actions/grant-delegated-permission');
const { revokeDelegatedPermission } = await import('../actions/revoke-delegated-permission');

beforeEach(() => {
  authzState.result = { ok: true, data: { person: coordinator } };
});

// ────────────────────────────────────────────────
// grantDelegatedPermission — early exits
// ────────────────────────────────────────────────
describe('grantDelegatedPermission — early exits', () => {
  it('retorna VALIDATION para targetPersonId inválido (não-UUID)', async () => {
    const r = await grantDelegatedPermission({
      targetPersonId: 'nao-e-uuid',
      permission: 'MODERATE_JOB',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION');
  });

  it('retorna VALIDATION para permission fora do catálogo', async () => {
    const r = await grantDelegatedPermission({
      targetPersonId: '00000000-0000-4000-8000-000000000001',
      permission: 'PERMISSAO_INEXISTENTE' as 'MODERATE_JOB',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION');
  });

  it('retorna VALIDATION para scopeArea vazio (string vazia após trim)', async () => {
    const r = await grantDelegatedPermission({
      targetPersonId: '00000000-0000-4000-8000-000000000001',
      permission: 'MODERATE_JOB',
      scopeArea: '',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION');
  });

  it('propaga UNAUTHENTICATED de requireCoordinator', async () => {
    authzState.result = { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sessão expirada.' } };
    const r = await grantDelegatedPermission({
      targetPersonId: '00000000-0000-4000-8000-000000000001',
      permission: 'MODERATE_JOB',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('propaga FORBIDDEN de requireCoordinator', async () => {
    authzState.result = { ok: false, error: { code: 'FORBIDDEN', message: 'Apenas coordenadores.' } };
    const r = await grantDelegatedPermission({
      targetPersonId: '00000000-0000-4000-8000-000000000001',
      permission: 'MODERATE_JOB',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });
});

// ────────────────────────────────────────────────
// revokeDelegatedPermission — early exits
// ────────────────────────────────────────────────
describe('revokeDelegatedPermission — early exits', () => {
  it('retorna VALIDATION para permissionGrantId inválido (não-UUID)', async () => {
    const r = await revokeDelegatedPermission({
      permissionGrantId: 'nao-e-uuid',
      justification: 'Justificativa longa o suficiente',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION');
  });

  it('retorna VALIDATION para justificativa curta (< 10 chars)', async () => {
    const r = await revokeDelegatedPermission({
      permissionGrantId: '00000000-0000-4000-8000-000000000001',
      justification: 'curta',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('VALIDATION');
  });

  it('propaga UNAUTHENTICATED de requireCoordinator', async () => {
    authzState.result = { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sessão expirada.' } };
    const r = await revokeDelegatedPermission({
      permissionGrantId: '00000000-0000-4000-8000-000000000001',
      justification: 'Justificativa longa o suficiente',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('propaga FORBIDDEN de requireCoordinator', async () => {
    authzState.result = { ok: false, error: { code: 'FORBIDDEN', message: 'Apenas coordenadores.' } };
    const r = await revokeDelegatedPermission({
      permissionGrantId: '00000000-0000-4000-8000-000000000001',
      justification: 'Justificativa longa o suficiente',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });
});
