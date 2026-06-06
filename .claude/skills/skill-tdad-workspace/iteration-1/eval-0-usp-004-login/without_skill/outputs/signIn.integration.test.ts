/**
 * Facts RED (P1) — USP-004 Autenticar no portal com e-mail e senha.
 * Destino real: src/modules/identity/__tests__/signIn.integration.test.ts
 *
 * Estes testes FALHAM até a Server Action `signIn` e o wrapper de rate-limit existirem.
 * São a fonte da verdade dos critérios EARS — código é regenerável, fact é mantido à mão (P5).
 *
 * Cobertura exigida para Server Action (project-guideline §Testing):
 * happy path, validação Zod, credenciais inválidas, concorrência/rate-limit.
 * (permissão/consentimento NÃO se aplicam: login é ação pública pré-autenticação.)
 *
 * Convenções:
 * - Retorno padronizado ActionResult: { ok: true, data } | { ok: false, error }
 * - Nunca throw na Action (project-guideline §Server Action canônica)
 * - Auditoria via withAudit + catálogo de eventos (@/modules/audit/events)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// NOTE: imports via barrel (@/modules/identity) — ainda não implementados (esperado: RED).
// import { signIn } from '@/modules/identity'
import { signInInputSchema } from '../schemas/signInInput'

// Helpers de teste a serem providos pela infra de testes do módulo identity.
declare function seedActiveCredential(email: string, password: string): Promise<void>
declare function seedFailedAttempts(email: string, count: number, withinMinutesAgo: number): Promise<void>
declare function getAuthAttempts(email: string): Promise<Array<{ success: boolean; failureCode: string | null }>>
declare function getAuditEvents(): Promise<Array<{ type: string }>>
declare function signIn(input: unknown): Promise<
  | { ok: true; data: { redirectTo: string } }
  | { ok: false; error: { code: string; message?: string } }
>

const VALID_EMAIL = 'ana@exemplo.org'
const VALID_PASSWORD = 'Senha#Forte1'

beforeEach(async () => {
  vi.useRealTimers()
  await seedActiveCredential(VALID_EMAIL, VALID_PASSWORD)
})

describe('signIn — schema de input (Zod, fact de fronteira)', () => {
  it('rejeita e-mail malformado', () => {
    const r = signInInputSchema.safeParse({ email: 'nao-email', password: 'x' })
    expect(r.success).toBe(false)
  })

  it('normaliza e-mail (trim + lowercase)', () => {
    const r = signInInputSchema.parse({ email: '  ANA@Exemplo.org ', password: 'x' })
    expect(r.email).toBe('ana@exemplo.org')
  })

  it('rejeita senha vazia', () => {
    const r = signInInputSchema.safeParse({ email: VALID_EMAIL, password: '' })
    expect(r.success).toBe(false)
  })
})

describe('AC-004-1 — credenciais válidas autenticam e redirecionam', () => {
  it('happy-path-redirects-home', async () => {
    const r = await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.redirectTo).toBe('/')
  })

  it('happy-path-registra-tentativa-de-sucesso', async () => {
    await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    const attempts = await getAuthAttempts(VALID_EMAIL)
    expect(attempts.at(-1)?.success).toBe(true)
  })

  it('happy-path-audita-LOGIN_SUCCEEDED', async () => {
    await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    const events = await getAuditEvents()
    expect(events.map((e) => e.type)).toContain('LOGIN_SUCCEEDED')
  })
})

describe('AC-004-2 — credenciais inválidas: mensagem genérica', () => {
  it('senha-incorreta-retorna-INVALID_CREDENTIALS', async () => {
    const r = await signIn({ email: VALID_EMAIL, password: 'errada' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('INVALID_CREDENTIALS')
      expect(r.error.message).toBe('Credenciais inválidas')
    }
  })

  it('email-inexistente-retorna-mesma-mensagem-que-senha-incorreta', async () => {
    const r = await signIn({ email: 'naoexiste@exemplo.org', password: 'qualquer' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('INVALID_CREDENTIALS')
      expect(r.error.message).toBe('Credenciais inválidas')
    }
  })

  it('falha-registra-tentativa-e-audita-LOGIN_FAILED', async () => {
    await signIn({ email: VALID_EMAIL, password: 'errada' })
    const attempts = await getAuthAttempts(VALID_EMAIL)
    expect(attempts.at(-1)?.success).toBe(false)
    const events = await getAuditEvents()
    expect(events.map((e) => e.type)).toContain('LOGIN_FAILED')
  })
})

describe('AC-004-3 — bloqueio após 5 falhas em 15 minutos', () => {
  it('bloqueia-na-6a-tentativa-com-TOO_MANY_ATTEMPTS', async () => {
    await seedFailedAttempts(VALID_EMAIL, 5, /* há */ 2 /* min */)
    const r = await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('TOO_MANY_ATTEMPTS')
  })

  it('boundary-5a-falha-ainda-processa-6a-bloqueia', async () => {
    await seedFailedAttempts(VALID_EMAIL, 4, 2)
    const fifth = await signIn({ email: VALID_EMAIL, password: 'errada' })
    expect(fifth.ok).toBe(false)
    if (!fifth.ok) expect(fifth.error.code).toBe('INVALID_CREDENTIALS')

    const sixth = await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    expect(sixth.ok).toBe(false)
    if (!sixth.ok) expect(sixth.error.code).toBe('TOO_MANY_ATTEMPTS')
  })

  it('recovery-falhas-fora-da-janela-de-15min-nao-bloqueiam', async () => {
    await seedFailedAttempts(VALID_EMAIL, 5, /* há */ 16 /* min — fora da janela */)
    const r = await signIn({ email: VALID_EMAIL, password: VALID_PASSWORD })
    expect(r.ok).toBe(true)
  })
})

/**
 * AC-004-4 — expiração de sessão por 12h de inatividade.
 * O encerramento ocorre na borda de leitura da sessão (getCurrentUser / middleware),
 * não na Action de login. Fact unitário do helper; o fluxo ponta-a-ponta vive no E2E.
 */
describe('AC-004-4 — sessão expira após 12h de inatividade', () => {
  // import { isSessionExpired } from '@/modules/identity'
  declare function isSessionExpired(lastActivityAt: Date, now: Date): boolean

  it('expira-em-12h-1min', () => {
    const last = new Date('2026-05-26T08:00:00Z')
    const now = new Date('2026-05-26T20:01:00Z') // +12h01
    expect(isSessionExpired(last, now)).toBe(true)
  })

  it('boundary-valida-em-11h59min', () => {
    const last = new Date('2026-05-26T08:00:00Z')
    const now = new Date('2026-05-26T19:59:00Z') // +11h59
    expect(isSessionExpired(last, now)).toBe(false)
  })
})
