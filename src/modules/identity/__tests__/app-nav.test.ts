import { describe, it, expect } from 'vitest';
import { pickActiveHref } from '../domain/app-nav';

/**
 * USP-062/063 — BNAV-03 / DNAV-03 (compartilhado).
 *
 * `pickActiveHref` é o helper puro de active-state por longest-match,
 * substituindo o prefixo simples do `isActive` do `PublicNav` para rotas
 * aninhadas do hub (`/perfil` vs `/perfil/papeis`).
 */
describe('pickActiveHref — longest-match (BNAV-03/DNAV-03)', () => {
  it('match exato: pathname === href', () => {
    expect(pickActiveHref(['/perfil', '/candidato'], '/perfil')).toBe('/perfil');
  });

  it('match descendente: pathname é filho de um href da lista', () => {
    expect(pickActiveHref(['/candidato'], '/candidato/x')).toBe('/candidato');
  });

  it('raiz sem falso-match: /perfil não casa /perfilagem (sem separador "/")', () => {
    expect(pickActiveHref(['/perfil'], '/perfilagem')).toBeNull();
  });

  it('aninhado — longest-match: /perfil/papeis vence sobre /perfil quando ambos casam', () => {
    const result = pickActiveHref(['/perfil', '/perfil/papeis'], '/perfil/papeis');
    expect(result).toBe('/perfil/papeis');
  });

  it('aninhado — pathname descendente de /perfil/papeis ainda escolhe o candidato mais longo', () => {
    const result = pickActiveHref(['/perfil', '/perfil/papeis'], '/perfil/papeis/x');
    expect(result).toBe('/perfil/papeis');
  });

  it('no-match: pathname não corresponde a nenhum href → null', () => {
    expect(pickActiveHref(['/perfil', '/candidato'], '/relatorios')).toBeNull();
  });

  it('múltiplos candidatos não-aninhados: o mais longo entre eles vence', () => {
    const result = pickActiveHref(['/prestador', '/prestador/servicos'], '/prestador/servicos/1');
    expect(result).toBe('/prestador/servicos');
  });

  it('lista vazia de hrefs → null', () => {
    expect(pickActiveHref([], '/inicio')).toBeNull();
  });
});
