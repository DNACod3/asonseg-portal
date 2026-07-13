import { describe, it, expect } from 'vitest';
import { FIXED_PASSWORD } from '../../../../prisma/seeds/bulk';
import { changePasswordFirstAccessSchema } from '../schemas/changePassword';
import { resetPasswordSchema } from '../schemas/password-reset.schema';

/**
 * Teste-guarda (HYG-13/HYG-MN-05): a senha fixa do seed de volume
 * (`prisma/seeds/bulk.ts`) precisa passar na política mais estrita do produto —
 * os mesmos schemas usados para trocar (1º acesso) e recuperar senha — para que
 * as ~112 contas de demo consigam trocar/recuperar a própria senha sem que o
 * formulário rejeite a senha semeada (achado AUTH-8: `12345678` só dígitos
 * falhava a regra "ao menos uma letra").
 */
describe('senha do seed vs. política de senha do produto', () => {
  it('FIXED_PASSWORD passa changePasswordFirstAccessSchema (1º acesso)', () => {
    const result = changePasswordFirstAccessSchema.safeParse({
      senhaNova: FIXED_PASSWORD,
      confirmar: FIXED_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it('FIXED_PASSWORD passa resetPasswordSchema (recuperação de senha)', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'token-de-teste',
      senhaNova: FIXED_PASSWORD,
      confirmar: FIXED_PASSWORD,
    });
    expect(result.success).toBe(true);
  });

  it('FIXED_PASSWORD não é mais o valor legado que violava a política (regressão AUTH-8)', () => {
    expect(FIXED_PASSWORD).not.toBe('12345678');
    expect(FIXED_PASSWORD).toMatch(/[A-Za-z]/);
    expect(FIXED_PASSWORD).toMatch(/[0-9]/);
  });
});
