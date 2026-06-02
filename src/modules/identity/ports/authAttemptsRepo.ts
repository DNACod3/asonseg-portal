import { createToken } from '@/shared/container';
import type { AuditTx } from '@/modules/audit';
import type { LockoutAttempt } from '../domain/lockout';

/** Chave de identificação de uma sequência de tentativas: e-mail + IP. */
export interface AttemptKey {
  /** E-mail já normalizado (lowercase + trim). */
  email: string;
  ip: string;
}

/**
 * Porta de persistência de tentativas de login (USP-004 — T-04).
 *
 * Isola a tabela técnica `auth_attempts` (ADR-0029) por trás de uma interface,
 * permitindo mockar nos testes unitários da `loginAction` e injetar o cliente
 * transacional (`tx`) nas escritas para manter a atomicidade com o `audit_log`
 * (design.md §7 — "incremento auth_attempts + audit_log no mesmo $tx").
 */
export interface AuthAttemptsRepo {
  /** Registra uma tentativa. Recebe `tx` opcional para gravar dentro da
   *  transação do `withAudit`; sem ele, usa o singleton Prisma. */
  record(input: AttemptKey & { outcome: 'SUCCESS' | 'FAILURE' }, tx?: AuditTx): Promise<void>;

  /** Tentativas da chave `(email, ip)` dentro da janela `windowMs` (leitura). */
  recent(input: AttemptKey & { windowMs: number }): Promise<LockoutAttempt[]>;

  /** Apaga as tentativas da chave `(email, ip)` — usado no reset após sucesso. */
  reset(input: AttemptKey, tx?: AuditTx): Promise<void>;
}

export const AUTH_ATTEMPTS_REPO_TOKEN = createToken<AuthAttemptsRepo>('AuthAttemptsRepo');
