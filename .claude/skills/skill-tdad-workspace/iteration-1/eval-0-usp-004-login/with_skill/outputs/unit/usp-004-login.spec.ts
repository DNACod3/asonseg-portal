// unit/usp-004-login.spec.ts
// FACTS (red) — fonte da verdade da USP-004 (Autenticar no portal com e-mail e senha).
// Mover para modules/identity/__tests__/ na fase Execute, conectando à Server Action real
// (autenticarComSenha) e ao wrapper de rate-limit sobre auth_attempts.
//
// Cobertura dos casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão · consentimento · concorrência.
//   - requirePermission NÃO se aplica: login é ação PÚBLICA pré-autenticação (justificado, ADR-T-0003).
//   - requireActiveConsent NÃO se aplica: login não está vinculado a finalidade LGPD.
//   - concorrência SE aplica: contador de tentativas (AC-004-3) não pode ser driblado por corrida.
//
// Fonte: PRD USP-004 · ADR-T-0003 (Supabase Auth, bloqueio 5/15min, sessão @supabase/ssr HttpOnly)
//        ADR-T-0004 (auth_attempts: email, ip, success, failureCode) · project-guideline §4, §12

import { describe, it, expect } from 'vitest'

// Stub temporário: substituir pelos imports reais na fase Execute.
// import { autenticarComSenha } from '@/modules/identity'
function autenticarComSenha(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-004')
}

describe('USP-004 — Autenticar no portal com e-mail e senha', () => {
  describe('AC-004-1 — happy path: credenciais válidas autenticam e redirecionam', () => {
    it('autentica Pessoa ativa, estabelece sessão e retorna sucesso com destino inicial', async () => {
      const input = { email: 'joao@exemplo.com', senha: 'SenhaForte!123' }
      const res = await autenticarComSenha(input)
      expect(res).toMatchObject({ ok: true, data: { redirectTo: expect.any(String) } })
      // E: sessão server-side em cookie HttpOnly; auth_attempts registra { success: true }.
    })

    it.todo('registra a tentativa bem-sucedida em auth_attempts com success=true')
    it.todo('estabelece a sessão server-side em cookie HttpOnly (@supabase/ssr)')
  })

  describe('AC-004-2 — validação Zod de entrada (fronteira)', () => {
    it.each([
      ['email-invalido', { email: 'nao-eh-email', senha: 'SenhaForte!123' }],
      ['email-vazio', { email: '', senha: 'SenhaForte!123' }],
      ['senha-vazia', { email: 'joao@exemplo.com', senha: '' }],
    ])('rejeita input malformado (%s) com erro de validação', async (_label, input) => {
      const res = await autenticarComSenha(input)
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
    })
  })

  describe('AC-004-2 — credenciais inválidas: mensagem genérica, sem enumeração', () => {
    it('senha incorreta retorna mensagem genérica "credenciais inválidas"', async () => {
      const res = await autenticarComSenha({ email: 'joao@exemplo.com', senha: 'SenhaErrada' })
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
      expect((res as any).error.message).toMatch(/credenciais inválidas/i)
    })

    it('e-mail inexistente retorna a MESMA mensagem genérica (não revela existência)', async () => {
      const res = await autenticarComSenha({ email: 'ninguem@exemplo.com', senha: 'QualquerSenha1' })
      expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
      // Mesma mensagem do caso de senha incorreta — não diferenciar é o contrato anti-enumeração.
    })

    it.todo('registra a tentativa falha em auth_attempts com success=false e failureCode')
  })

  describe('AC-004-3 — bloqueio após 5 tentativas em 15 minutos', () => {
    it('a 5ª falha em 15 min ativa o bloqueio para o e-mail', async () => {
      // Pré-condição: 4 falhas recentes já em auth_attempts para o e-mail.
      const res = await autenticarComSenha({ email: 'joao@exemplo.com', senha: 'SenhaErrada' })
      expect(res).toMatchObject({ ok: false, error: { code: 'ACCOUNT_TEMPORARILY_LOCKED' } })
    })

    it('6ª tentativa é bloqueada mesmo com senha CORRETA enquanto o bloqueio vigora', async () => {
      // Pré-condição: e-mail já bloqueado.
      const res = await autenticarComSenha({ email: 'joao@exemplo.com', senha: 'SenhaForte!123' })
      expect(res).toMatchObject({ ok: false, error: { code: 'ACCOUNT_TEMPORARILY_LOCKED' } })
    })

    it.todo('mantém o bloqueio por 15 minutos a partir da tentativa que o disparou')
    it.todo('libera novas tentativas após expirar a janela de 15 minutos (senha correta autentica)')

    // Concorrência (project-guideline §12): a contagem da janela deve ser consistente sob corrida.
    it.todo('duas submissões simultâneas não driblam o limite de 5 em 15 min (contagem atômica)')
  })

  describe('AC-004-4 — sessão encerra após 12h de inatividade (invariante)', () => {
    it.todo('sessão sem atividade por 12h é encerrada; requisição seguinte é tratada como anônima')
    it.todo('atividade dentro da janela de 12h mantém a sessão ativa')
  })
})
