import { describe, it, expect } from 'vitest';
import { registerByAssistantSchema } from '../schemas/register-by-assistant.schema';
import {
  canRegisterAssisted,
  CPF_EXCEPTION_MIN_JUSTIFICATION,
  ASSISTED_REGISTRATION_ROLES,
} from '../domain/assisted-registration';
import { registerPersonSchema } from '../schemas/registerPerson';

// CPF válido e fixo (passa no dígito verificador) reutilizado nos cenários.
const VALID_CPF = '529.982.247-25';
const VALID_JUSTIFICATION = 'Pessoa em situação de rua, sem qualquer documento de identificação.';

describe('registerByAssistantSchema', () => {
  describe('happy path', () => {
    it('aceita Pessoa com CPF e normaliza (remove máscara), exceção desmarcada por padrão', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Maria da Silva',
        cpf: VALID_CPF,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cpf).toBe('52998224725');
        expect(result.data.cpfException).toBe(false);
        expect(result.data.cpfExceptionJustification).toBeUndefined();
        expect(result.data.role).toBeUndefined();
      }
    });

    it('aceita Pessoa sem CPF quando a exceção é marcada com justificativa válida', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'João sem Documento',
        cpfException: true,
        cpfExceptionJustification: VALID_JUSTIFICATION,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cpf).toBeUndefined();
        expect(result.data.cpfException).toBe(true);
        expect(result.data.cpfExceptionJustification).toBe(VALID_JUSTIFICATION);
      }
    });

    it('aceita campos opcionais (telefone, endereço, nascimento, papel) e normaliza vazios', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Ana Optativa',
        cpf: VALID_CPF,
        phone: '   ',
        fullAddress: '',
        birthDate: '1980-03-15',
        role: 'CANDIDATE',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeUndefined();
        expect(result.data.fullAddress).toBeUndefined();
        expect(result.data.birthDate).toBe('1980-03-15');
        expect(result.data.role).toBe('CANDIDATE');
      }
    });
  });

  describe('nome obrigatório (E-001)', () => {
    it('rejeita nome com menos de 3 caracteres', () => {
      const result = registerByAssistantSchema.safeParse({ fullName: 'Jo', cpf: VALID_CPF });
      expect(result.success).toBe(false);
    });

    it('rejeita ausência de nome', () => {
      const result = registerByAssistantSchema.safeParse({ cpf: VALID_CPF });
      expect(result.success).toBe(false);
    });
  });

  describe('exceção de CPF (E-002 / F3 / P-003)', () => {
    it('rejeita exceção sem justificativa', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Sem Justificativa',
        cpfException: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.flatten().fieldErrors;
        expect(fields.cpfExceptionJustification).toBeDefined();
      }
    });

    it(`rejeita justificativa com menos de ${CPF_EXCEPTION_MIN_JUSTIFICATION} caracteres`, () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Justificativa Curta',
        cpfException: true,
        cpfExceptionJustification: 'x', // genérica/curta
      });
      expect(result.success).toBe(false);
    });

    it('rejeita justificativa só de espaços (trim antes de medir)', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Justificativa Branca',
        cpfException: true,
        cpfExceptionJustification: '                              ',
      });
      expect(result.success).toBe(false);
    });

    it('rejeita exceção marcada junto com CPF informado (contradição)', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Contraditória',
        cpf: VALID_CPF,
        cpfException: true,
        cpfExceptionJustification: VALID_JUSTIFICATION,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sem CPF e sem exceção (caminho proibido — F3)', () => {
    it('rejeita Pessoa sem CPF quando a exceção não foi marcada', () => {
      const result = registerByAssistantSchema.safeParse({ fullName: 'Sem Nada' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.cpf).toBeDefined();
      }
    });
  });

  describe('E-005 / P-001 — marca de exceção é exclusiva deste fluxo', () => {
    it('o schema público (USP-001) NÃO conhece a marca de exceção', () => {
      const publicFields = Object.keys(registerPersonSchema.shape);
      expect(publicFields).not.toContain('cpfException');
      expect(publicFields).not.toContain('cpfExceptionJustification');
    });

    it('este schema assistido reconhece e processa a marca de exceção', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Reconhece Exceção',
        cpfException: true,
        cpfExceptionJustification: VALID_JUSTIFICATION,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('data da assinatura do termo em papel (E-004)', () => {
    it('aceita data passada válida', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Com Data',
        cpf: VALID_CPF,
        signedOnPaperAt: '2026-05-30',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.signedOnPaperAt).toBe('2026-05-30');
    });

    it('aceita ausência (campo opcional) — a action assume a data do cadastro', () => {
      const result = registerByAssistantSchema.safeParse({ fullName: 'Sem Data', cpf: VALID_CPF });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.signedOnPaperAt).toBeUndefined();
    });

    it('rejeita data no futuro', () => {
      const result = registerByAssistantSchema.safeParse({
        fullName: 'Data Futura',
        cpf: VALID_CPF,
        signedOnPaperAt: '2999-01-01',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('canRegisterAssisted (autorização institucional — P-001/P-005)', () => {
  it('autoriza SOCIAL_ASSISTANT e BOARD', () => {
    expect(canRegisterAssisted(['SOCIAL_ASSISTANT'])).toBe(true);
    expect(canRegisterAssisted(['BOARD'])).toBe(true);
    expect(canRegisterAssisted(['CANDIDATE', 'BOARD'])).toBe(true);
  });

  it('nega papéis públicos e Pessoa sem papéis', () => {
    expect(canRegisterAssisted(['CANDIDATE'])).toBe(false);
    expect(canRegisterAssisted(['PROVIDER', 'CLIENT'])).toBe(false);
    expect(canRegisterAssisted([])).toBe(false);
  });

  it('a lista de papéis autorizados não inclui papéis públicos', () => {
    const allowed: readonly string[] = ASSISTED_REGISTRATION_ROLES;
    expect(allowed).not.toContain('CANDIDATE');
    expect(allowed).not.toContain('PROVIDER');
    expect(allowed).not.toContain('CLIENT');
  });
});
