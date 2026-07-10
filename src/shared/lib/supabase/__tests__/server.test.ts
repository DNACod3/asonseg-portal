import { describe, it, expect } from 'vitest';
import { secureCookieOptions } from '../server';

/**
 * Testes do piso de segurança do cookie de sessão (H5, Fase 6 — hardening,
 * must-not MN-H5). Função pura — sem `next/headers`, sem montar o client
 * Supabase — cobre a matriz ausente/seguro/inseguro.
 */

describe('shared/lib/supabase/server — secureCookieOptions (H5, MN-H5)', () => {
  it('AC-H5-1: opções ausentes → piso preenchido (httpOnly=true, secure=isProd, sameSite=lax)', () => {
    const dev = secureCookieOptions({}, { isProd: false });
    expect(dev.httpOnly).toBe(true);
    expect(dev.secure).toBe(false); // não força Secure fora de produção (não quebra dev local)
    expect(dev.sameSite).toBe('lax');

    const prod = secureCookieOptions({}, { isProd: true });
    expect(prod.httpOnly).toBe(true);
    expect(prod.secure).toBe(true);
    expect(prod.sameSite).toBe('lax');
  });

  it('undefined (sem objeto de options) → mesmo piso de {}', () => {
    const result = secureCookieOptions(undefined, { isProd: true });
    expect(result.httpOnly).toBe(true);
    expect(result.secure).toBe(true);
    expect(result.sameSite).toBe('lax');
  });

  it('valores seguros já presentes (vindos do @supabase/ssr) → preservados, não rebaixados', () => {
    const result = secureCookieOptions(
      { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 },
      { isProd: true },
    );
    expect(result).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  });

  it('secure explícito true em dev → preservado (não rebaixa um upstream mais restritivo)', () => {
    const result = secureCookieOptions({ secure: true }, { isProd: false });
    expect(result.secure).toBe(true);
  });

  it('MN-H5: sameSite "none" vindo de upstream é normalizado para "lax" — nunca emitido em claro', () => {
    // SPEC_DEVIATION (ver server.ts): 'none' é o valor MENOS seguro de
    // sameSite (cross-site) — normalizá-lo para 'lax' eleva o piso, não
    // "rebaixa" um valor seguro já definido. Sem essa normalização, MN-H5
    // ("cookie não pode ser emitido... com SameSite: 'none'") seria furável
    // por qualquer upstream que mandasse 'none' explicitamente.
    const result = secureCookieOptions({ sameSite: 'none' }, { isProd: true });
    expect(result.sameSite).not.toBe('none');
    expect(result.sameSite).toBe('lax');
  });

  it('mata a mutação de remover o piso: sem "??", ausência de secure em produção ficaria undefined (falsy)', () => {
    // Prova indireta: comparar contra uma implementação "sem piso" (spread puro).
    const withoutFloor = { ...({} as Record<string, unknown>) };
    expect(withoutFloor.secure).toBeUndefined();
    // Com o helper real, produção sempre resolve secure=true mesmo partindo de {}.
    expect(secureCookieOptions({}, { isProd: true }).secure).toBe(true);
  });
});
