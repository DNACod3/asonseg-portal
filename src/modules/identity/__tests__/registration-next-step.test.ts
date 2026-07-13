import { describe, it, expect } from 'vitest';
import {
  REGISTRATION_NEXT_STEP,
  registrationNextStep,
  POST_AUTH_FALLBACK,
} from '../domain/role-activation';
import { PUBLIC_ROLES } from '../schemas/registerPerson';
import { ALL_ROLE_LABELS } from '../domain/roles';

/**
 * USP-049 — REDIR-01, REDIR-MN-01, PERFIL-01 (rótulos).
 *
 * Corrige o destino pós-cadastro (AUTH-1): nenhum valor aponta a um path com
 * prefixo `/app/` (route group, não vira URL) nem a uma rota inexistente.
 */
describe('registrationNextStep — REDIR-01', () => {
  it('CANDIDATE → /candidato', () => {
    expect(registrationNextStep('CANDIDATE')).toBe('/candidato');
  });

  it('PROVIDER → /prestador', () => {
    expect(registrationNextStep('PROVIDER')).toBe('/prestador');
  });

  it('CLIENT → /inicio', () => {
    expect(registrationNextStep('CLIENT')).toBe('/inicio');
  });

  it('papel desconhecido → /inicio (fallback)', () => {
    expect(registrationNextStep('NAO_EXISTE')).toBe('/inicio');
  });
});

describe('POST_AUTH_FALLBACK', () => {
  it('é /inicio', () => {
    expect(POST_AUTH_FALLBACK).toBe('/inicio');
  });
});

describe('REDIR-MN-01 — nenhum destino de cadastro aponta a /app/ ou rota fora da allowlist', () => {
  const ALLOWLIST = ['/candidato', '/prestador', '/inicio'];

  it('nenhum valor de REGISTRATION_NEXT_STEP casa /^\\/app\\//', () => {
    for (const role of PUBLIC_ROLES) {
      expect(/^\/app\//.test(REGISTRATION_NEXT_STEP[role])).toBe(false);
    }
  });

  it('todo valor de REGISTRATION_NEXT_STEP ∈ allowlist de rotas reais', () => {
    for (const role of PUBLIC_ROLES) {
      expect(ALLOWLIST).toContain(REGISTRATION_NEXT_STEP[role]);
    }
  });

  it('POST_AUTH_FALLBACK não casa /^\\/app\\// e está na allowlist', () => {
    expect(/^\/app\//.test(POST_AUTH_FALLBACK)).toBe(false);
    expect(ALLOWLIST).toContain(POST_AUTH_FALLBACK);
  });
});

describe('ALL_ROLE_LABELS — PERFIL-01 (rótulos PT-BR de todos os papéis)', () => {
  const ALL_ROLES = [
    'CANDIDATE',
    'PROVIDER',
    'CLIENT',
    'COMPANY_RESPONSIBLE',
    'VOLUNTEER',
    'COORDINATOR',
    'SOCIAL_ASSISTANT',
    'BOARD',
  ];

  it('cobre os 8 papéis do MVP com rótulo PT-BR não-vazio', () => {
    for (const role of ALL_ROLES) {
      expect(ALL_ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it('rótulos exatos (mirror de pessoas/[id]/page.tsx)', () => {
    expect(ALL_ROLE_LABELS.CANDIDATE).toBe('Candidato(a)');
    expect(ALL_ROLE_LABELS.PROVIDER).toBe('Prestador(a)');
    expect(ALL_ROLE_LABELS.CLIENT).toBe('Cliente');
    expect(ALL_ROLE_LABELS.COMPANY_RESPONSIBLE).toBe('Responsável de Empresa');
    expect(ALL_ROLE_LABELS.VOLUNTEER).toBe('Voluntário(a)');
    expect(ALL_ROLE_LABELS.COORDINATOR).toBe('Coordenador(a)');
    expect(ALL_ROLE_LABELS.SOCIAL_ASSISTANT).toBe('Assistente social');
    expect(ALL_ROLE_LABELS.BOARD).toBe('Diretoria');
  });
});
