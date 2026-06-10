// Unit do HMAC de aceite de consentimento (TX2 do auto-cadastro). Cobre os ramos
// de verificação: token ausente, tamanho inválido, assinatura divergente,
// não-hex (catch do timingSafeEqual) e o caminho feliz.

import { describe, it, expect } from 'vitest';
import { signConsentToken, verifyConsentToken } from '@/shared/lib/consentToken';

describe('consentToken', () => {
  it('aceita o token assinado para o mesmo personId + role', () => {
    const token = signConsentToken('p1', 'CANDIDATE');
    expect(token).toHaveLength(64);
    expect(verifyConsentToken('p1', 'CANDIDATE', token)).toBe(true);
  });

  it('rejeita token de outro personId ou outro role (assinatura divergente)', () => {
    const token = signConsentToken('p1', 'CANDIDATE');
    expect(verifyConsentToken('p2', 'CANDIDATE', token)).toBe(false);
    expect(verifyConsentToken('p1', 'VOLUNTEER', token)).toBe(false);
  });

  it('rejeita token ausente ou com tamanho diferente de 64', () => {
    expect(verifyConsentToken('p1', 'CANDIDATE', undefined)).toBe(false);
    expect(verifyConsentToken('p1', 'CANDIDATE', 'curto')).toBe(false);
  });

  it('rejeita token de 64 caracteres não-hex sem lançar (catch do timingSafeEqual)', () => {
    expect(verifyConsentToken('p1', 'CANDIDATE', 'z'.repeat(64))).toBe(false);
  });
});
