import { describe, it, expect } from 'vitest';
import { registerPersonSchema } from '../schemas/registerPerson';

// Testes unitários dos fluxos cobertos pelo schema — a server action em si
// exige banco real (integration test). Os testes de integração ficam em
// registerPerson.int.test.ts.

describe('registerPersonSchema', () => {
  describe('happy path', () => {
    it('aceita input válido e normaliza email e CPF', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Maria Silva',
        cpf: '529.982.247-25',
        email: 'MARIA@EXAMPLE.COM',
        password: 'senha1234',
        role: 'CANDIDATE',
        captchaToken: 'token-valido',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('maria@example.com');
        expect(result.data.cpf).toBe('52998224725');
      }
    });
  });

  describe('validação de CPF', () => {
    it('rejeita CPF inválido', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Teste',
        cpf: '111.111.111-11',
        email: 'teste@x.com',
        password: 'senha1234',
        role: 'CANDIDATE',
        captchaToken: 'token',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validação de e-mail', () => {
    it('rejeita e-mail sem @', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Teste',
        cpf: '529.982.247-25',
        email: 'naoemail',
        password: 'senha1234',
        role: 'CANDIDATE',
        captchaToken: 'token',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validação de senha', () => {
    it('rejeita senha com menos de 8 caracteres', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Teste',
        cpf: '529.982.247-25',
        email: 'teste@x.com',
        password: '1234567',
        role: 'CANDIDATE',
        captchaToken: 'token',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validação de papel', () => {
    it('rejeita papel interno (COORDINATOR)', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Teste',
        cpf: '529.982.247-25',
        email: 'teste@x.com',
        password: 'senha1234',
        role: 'COORDINATOR',
        captchaToken: 'token',
      });
      expect(result.success).toBe(false);
    });

    it('aceita CANDIDATE, PROVIDER e CLIENT', () => {
      for (const role of ['CANDIDATE', 'PROVIDER', 'CLIENT'] as const) {
        const result = registerPersonSchema.safeParse({
          fullName: 'Teste',
          cpf: '529.982.247-25',
          email: 'teste@x.com',
          password: 'senha1234',
          role,
          captchaToken: 'token',
        });
        expect(result.success, `esperava sucesso para papel ${role}`).toBe(true);
      }
    });
  });

  describe('validação de CAPTCHA', () => {
    it('rejeita token vazio', () => {
      const result = registerPersonSchema.safeParse({
        fullName: 'Teste',
        cpf: '529.982.247-25',
        email: 'teste@x.com',
        password: 'senha1234',
        role: 'CANDIDATE',
        captchaToken: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('P-007 — marca de exceção', () => {
    it('não expõe campos de Pessoa sem documento no schema público', () => {
      const fields = Object.keys(registerPersonSchema.shape);
      expect(fields).not.toContain('cpfExceptionJustification');
      expect(fields).not.toContain('cpfException');
    });
  });
});
