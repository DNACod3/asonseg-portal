import { describe, it, expect } from 'vitest';
import {
  requestCredentialClaimSchema,
  verifyCredentialClaimSchema,
  CREDENTIAL_VERIFICATION_METHODS,
} from '../schemas/credential-claim.schema';
import {
  canApproveCredentialClaim,
  CREDENTIAL_CLAIM_APPROVER_ROLES,
} from '../domain/credential-claim';

const VALID_CPF = '529.982.247-25';
const VALID_UUID = '11111111-2222-3333-4444-555555555555';

describe('requestCredentialClaimSchema', () => {
  it('aceita CPF + e-mail + meio, normaliza CPF (sem máscara) e e-mail (lowercase)', () => {
    const result = requestCredentialClaimSchema.safeParse({
      cpf: VALID_CPF,
      requestedEmail: '  Maria@Example.COM ',
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cpf).toBe('52998224725');
      expect(result.data.requestedEmail).toBe('maria@example.com');
      expect(result.data.verificationMethod).toBe('AS_CONFIRMATION');
      expect(result.data.alternativeIdentifier).toBeUndefined();
    }
  });

  it('aceita identificador alternativo sem CPF (E-001)', () => {
    const result = requestCredentialClaimSchema.safeParse({
      alternativeIdentifier: 'Protocolo 2026-0042',
      requestedEmail: 'joao@example.com',
      verificationMethod: 'IN_PERSON',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cpf).toBeUndefined();
      expect(result.data.alternativeIdentifier).toBe('Protocolo 2026-0042');
    }
  });

  it('rejeita quando não há CPF nem identificador alternativo', () => {
    const result = requestCredentialClaimSchema.safeParse({
      requestedEmail: 'sem-id@example.com',
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cpf).toBeDefined();
    }
  });

  it('rejeita CPF inválido (dígito verificador)', () => {
    const result = requestCredentialClaimSchema.safeParse({
      cpf: '111.111.111-11',
      requestedEmail: 'x@example.com',
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const result = requestCredentialClaimSchema.safeParse({
      cpf: VALID_CPF,
      requestedEmail: 'nao-eh-email',
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita meio de verificação fora do enum', () => {
    const result = requestCredentialClaimSchema.safeParse({
      cpf: VALID_CPF,
      requestedEmail: 'x@example.com',
      verificationMethod: 'EMAIL_OTP',
    });
    expect(result.success).toBe(false);
  });
});

describe('verifyCredentialClaimSchema', () => {
  it('aceita claimId uuid + meio válido', () => {
    const result = verifyCredentialClaimSchema.safeParse({
      claimId: VALID_UUID,
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita claimId que não é uuid', () => {
    const result = verifyCredentialClaimSchema.safeParse({
      claimId: 'abc',
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.success).toBe(false);
  });

  it('cobre todos os meios declarados', () => {
    for (const method of CREDENTIAL_VERIFICATION_METHODS) {
      const result = verifyCredentialClaimSchema.safeParse({
        claimId: VALID_UUID,
        verificationMethod: method,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('canApproveCredentialClaim (autorização — P-005)', () => {
  it('autoriza AS, diretoria e coordenação', () => {
    expect(canApproveCredentialClaim(['SOCIAL_ASSISTANT'])).toBe(true);
    expect(canApproveCredentialClaim(['BOARD'])).toBe(true);
    expect(canApproveCredentialClaim(['COORDINATOR'])).toBe(true);
    expect(canApproveCredentialClaim(['CANDIDATE', 'COORDINATOR'])).toBe(true);
  });

  it('nega papéis comuns e Pessoa sem papéis (P-005)', () => {
    expect(canApproveCredentialClaim(['CANDIDATE'])).toBe(false);
    expect(canApproveCredentialClaim(['PROVIDER', 'CLIENT'])).toBe(false);
    expect(canApproveCredentialClaim(['VOLUNTEER'])).toBe(false);
    expect(canApproveCredentialClaim([])).toBe(false);
  });

  it('a lista de aprovadores não inclui papéis comuns/públicos', () => {
    const allowed: readonly string[] = CREDENTIAL_CLAIM_APPROVER_ROLES;
    expect(allowed).not.toContain('CANDIDATE');
    expect(allowed).not.toContain('PROVIDER');
    expect(allowed).not.toContain('CLIENT');
    expect(allowed).not.toContain('VOLUNTEER');
  });
});
