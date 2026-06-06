# Templates dos 4 artefatos

Todos os exemplos abaixo derivam da **USP-001 — Auto-cadastro de Pessoa (público)** do PRD, que
exercita todos os padrões EARS. Use-os como molde, não como conteúdo fixo — o conteúdo sai sempre
dos ACs reais da US em questão.

ACs de origem (verbatim do PRD):
- AC-001-1: WHEN o visitante submete o auto-cadastro com nome, CPF válido, e-mail e senha, the system SHALL persistir a Pessoa, criar a credencial e ativar o(s) papel(éis) público(s).
- AC-001-2: IF o e-mail já está em uso, THEN bloquear e informar o conflito.
- AC-001-3: IF o CPF já está em uso, THEN bloquear.
- AC-001-4: IF o CPF tem formato/dígito verificador inválido, THEN bloquear.
- AC-001-5: The system SHALL exigir validação CAPTCHA.
- AC-001-6: WHEN o cadastro conclui, the system SHALL enviar e-mail de boas-vindas e registrar log de auditoria.
- AC-001-7: The system SHALL armazenar senhas com hash bcrypt.

---

## Gherkin PT-BR {#gherkin-ptbr}

Um arquivo `.feature` por US. Palavras-chave em português (suportadas pelo Gherkin:
`Funcionalidade`, `Contexto`, `Cenário`, `Esquema do Cenário`, `Exemplos`, `Dado`, `Quando`,
`Então`, `E`, `Mas`). Cada cenário leva a tag `@ac-NNN-N` que amarra ao AC — é o que torna a
matriz de rastreabilidade regenerável.

```gherkin
# .specs/features/auto-cadastro-pessoa/tests/bdd/usp-001-auto-cadastro.feature
# Fonte: PRD §5.2 USP-001 · ADR-0011 (pessoa unificada) · ADR-0003 (cadastro nominal LGPD)
#        ADR-T-0003 (Supabase Auth) · ADR-T-0014 (Turnstile) · project-guideline §4, §12

@usp-001 @modulo-identity
Funcionalidade: Auto-cadastro de Pessoa no portal (público)
  Como visitante anônimo
  Quero criar minha conta informando nome, CPF, e-mail e senha
  Para usar as funcionalidades autenticadas do portal

  Contexto:
    Dado que o desafio CAPTCHA (Turnstile) foi resolvido com sucesso

  @ac-001-1 @happy-path
  Cenário: Cadastro válido persiste Pessoa, credencial e papel
    Dado um visitante com nome "Maria Silva", CPF válido "390.533.447-05",
      e-mail "maria@exemplo.com" e senha forte
    E o papel público escolhido é "candidato"
    Quando ele submete o auto-cadastro
    Então o sistema persiste a Pessoa
    E cria a credencial de acesso
    E ativa o papel "candidato"
    E registra log de auditoria do evento de cadastro
    E a ação retorna sucesso

  @ac-001-2 @borda
  Cenário: E-mail já em uso bloqueia o cadastro
    Dado que já existe uma Pessoa com o e-mail "maria@exemplo.com"
    Quando um visitante tenta se cadastrar com o e-mail "maria@exemplo.com"
    Então o sistema bloqueia o cadastro
    E informa o conflito de e-mail
    E nenhuma Pessoa nova é persistida

  @ac-001-3 @ac-001-4 @borda
  Esquema do Cenário: Cadastro é bloqueado quando o CPF é inválido ou duplicado
    Quando um visitante tenta se cadastrar com o CPF "<cpf>"
    Então o sistema bloqueia o cadastro com o erro "<erro>"

    Exemplos:
      | cpf              | erro            |
      | 111.111.111-11   | CPF_INVALIDO    |
      | 390.533.447-00   | CPF_INVALIDO    |
      | <cpf já cadastrado> | CPF_DUPLICADO |

  @ac-001-5 @seguranca
  Cenário: CAPTCHA é obrigatório
    Dado um visitante que NÃO resolveu o desafio CAPTCHA
    Quando ele tenta submeter o auto-cadastro
    Então o sistema rejeita a submissão por falta de verificação CAPTCHA

  @ac-001-7 @seguranca
  Cenário: Senha é armazenada com hash, nunca em texto plano
    Quando uma Pessoa é cadastrada com a senha "SenhaForte!123"
    Então a senha persistida não é igual ao texto "SenhaForte!123"
    E o hash segue o padrão bcrypt (ou equivalente atual)
```

Notas:
- `AC-001-6` (e-mail de boas-vindas + auditoria) foi dobrado dentro do happy path (`@ac-001-1`) e
  pode também ter cenário próprio se o envio de e-mail tiver caminhos de falha — decida pelo PRD.
- O CPF do exemplo precisa ser sintético/válido por dígito verificador; nunca use CPF real (LGPD).
- Tag de módulo (`@modulo-identity`) ajuda a rodar subconjuntos e a localizar o `modules/<m>/`.

---

## Vitest red {#vitest-red}

Um arquivo por US, espelhando os cenários. O objetivo é um arquivo que **roda e reporta red
limpo** — falha por falta de implementação, nunca por import quebrado. Use `it.todo` para casos
sem corpo e um stub que lança `not implemented` para casos com assertion definida.

```typescript
// .specs/features/auto-cadastro-pessoa/tests/unit/usp-001-auto-cadastro.spec.ts
// FACTS (red) — fonte da verdade da USP-001. Mover para
// modules/identity/__tests__/ na fase Execute, conectando à Server Action real.
//
// Cobertura dos casos obrigatórios de Server Action (project-guideline §12):
//   happy path · validação Zod · permissão · consentimento · concorrência.
// Aqui o auto-cadastro é ação PÚBLICA: requirePermission NÃO se aplica (justificado).
// Consentimento LGPD de cadastro é coletado no fluxo, não via requireActiveConsent.

import { describe, it, expect } from 'vitest'

// Stub temporário: substituir pelo import real da Server Action na fase Execute.
// import { autoCadastrarPessoa } from '@/modules/identity'
function autoCadastrarPessoa(_input: unknown): never {
  throw new Error('not implemented — fact red da USP-001')
}

describe('USP-001 — Auto-cadastro de Pessoa (público)', () => {
  describe('AC-001-1 — happy path', () => {
    it('persiste Pessoa, cria credencial, ativa papel e audita', async () => {
      const input = {
        nome: 'Maria Silva',
        cpf: '39053344705',
        email: 'maria@exemplo.com',
        senha: 'SenhaForte!123',
        papeis: ['CANDIDATO'],
        captchaToken: 'token-valido',
      }
      const res = await autoCadastrarPessoa(input)
      expect(res).toMatchObject({ ok: true })
      // E: credencial criada, papel CANDIDATO ativo, evento de auditoria PERSON_REGISTERED
    })
  })

  describe('AC-001-2 / AC-001-3 — duplicidade bloqueia (concorrência)', () => {
    it('bloqueia e-mail já em uso e retorna conflito', async () => {
      const res = await autoCadastrarPessoa({ /* e-mail existente */ })
      expect(res).toMatchObject({ ok: false, error: { code: 'EMAIL_DUPLICADO' } })
    })
    it('bloqueia CPF já em uso', async () => {
      const res = await autoCadastrarPessoa({ /* cpf existente */ })
      expect(res).toMatchObject({ ok: false, error: { code: 'CPF_DUPLICADO' } })
    })
    // Caso de concorrência: duas submissões simultâneas com o mesmo CPF/e-mail
    // não podem criar duas Pessoas (constraint única + transação).
    it.todo('rejeita corrida de duas submissões simultâneas com o mesmo CPF')
  })

  describe('AC-001-4 — validação Zod de CPF', () => {
    it.each([
      ['11111111111', 'CPF_INVALIDO'],
      ['39053344700', 'CPF_INVALIDO'],
    ])('rejeita CPF inválido %s', async (cpf, code) => {
      const res = await autoCadastrarPessoa({ cpf })
      expect(res).toMatchObject({ ok: false, error: { code } })
    })
  })

  describe('AC-001-5 — CAPTCHA obrigatório', () => {
    it('rejeita submissão sem token CAPTCHA válido', async () => {
      const res = await autoCadastrarPessoa({ captchaToken: undefined })
      expect(res).toMatchObject({ ok: false, error: { code: 'CAPTCHA_REQUIRED' } })
    })
  })

  describe('AC-001-7 — senha com hash', () => {
    it.todo('persiste a senha como hash bcrypt, nunca em texto plano')
  })
})
```

Regras:
- Casos com assertion clara → `it(...)` chamando o stub (falha com `not implemented` = red).
- Casos cujo formato ainda depende de decisão → `it.todo(...)` (aparece como pendente, não como falha de erro).
- Nome do `describe`/`it` cita o AC — é o `::nome-do-teste` que vai na matriz e no bloco `## Facts` do issue.

---

## Playwright E2E {#playwright-e2e}

Só para US que é um dos **Top 8 fluxos críticos** (architecture-document §6). Auto-cadastro é um
deles. Esqueleto red, marcado `test.fixme` para não quebrar a suite de CI até a implementação.

```typescript
// .specs/features/auto-cadastro-pessoa/tests/e2e/usp-001-auto-cadastro.e2e.ts
// FACT E2E (red) — mover para e2e/ na fase Execute. Fluxo crítico Top 8.
import { test, expect } from '@playwright/test'

test.describe('USP-001 — Auto-cadastro (fluxo crítico)', () => {
  test.fixme('AC-001-1 — visitante completa cadastro e chega autenticado', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByLabel('Nome').fill('Maria Silva')
    await page.getByLabel('CPF').fill('390.533.447-05')
    await page.getByLabel('E-mail').fill('maria@exemplo.com')
    await page.getByLabel('Senha').fill('SenhaForte!123')
    await page.getByRole('checkbox', { name: /candidato/i }).check()
    // resolver CAPTCHA (stub/bypass de teste)
    await page.getByRole('button', { name: /criar conta/i }).click()
    await expect(page).toHaveURL(/\/(perfil|inicio)/)
  })

  test.fixme('AC-001-2 — e-mail duplicado exibe mensagem de conflito', async ({ page }) => {
    // ...
    await expect(page.getByText(/e-mail já está em uso/i)).toBeVisible()
  })
})
```

---

## Matriz de rastreabilidade {#matriz}

Arquivo `traceability.md`. Conecta **cada AC** a **um ou mais facts**, com path-alvo (onde o fact
viverá na fase Execute) e status. É a evidência verificável de cobertura para o Kickoff Gate.

```markdown
# Rastreabilidade EARS → Fact — USP-001 Auto-cadastro de Pessoa

Fonte: PRD §5.2 USP-001. Gerado por skill-tdad. Cobertura: 7/7 ACs com fact.

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| AC-001-1 | WHEN…SHALL | persistir Pessoa, criar credencial, ativar papel | integração | `@ac-001-1` | `modules/identity/__tests__/autoCadastro.integration.test.ts::happy-path` | Red |
| AC-001-2 | IF…THEN | e-mail em uso bloqueia | integração | `@ac-001-2` | `…autoCadastro.integration.test.ts::email-duplicado` | Red |
| AC-001-3 | IF…THEN | CPF em uso bloqueia | integração | `@ac-001-3` | `…::cpf-duplicado` | Red |
| AC-001-4 | IF…THEN | CPF inválido bloqueia | schema Zod + unit | `@ac-001-4` | `modules/identity/schemas/autoCadastroInput.ts` + `…::cpf-invalido` | Red |
| AC-001-5 | SHALL (ubíquo) | CAPTCHA obrigatório | integração | `@ac-001-5` | `…::captcha-required` | Red |
| AC-001-6 | WHEN…SHALL | e-mail boas-vindas + auditoria | integração | `@ac-001-1` (E) | `…::happy-path` (assert auditoria) | Red |
| AC-001-7 | SHALL (ubíquo) | senha com hash bcrypt | unit | `@ac-001-7` | `…::senha-hash` | Red |

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- AC-001-1 (happy path) → `modules/identity/__tests__/autoCadastro.integration.test.ts::happy-path`
- AC-001-2 → `…::email-duplicado`
- AC-001-3 → `…::cpf-duplicado`
- AC-001-4 (schema) → `modules/identity/schemas/autoCadastroInput.ts` (Zod)
- AC-001-4 (unit) → `…::cpf-invalido`
- AC-001-5 → `…::captcha-required`
- AC-001-6 → `…::happy-path` (assertion de auditoria + e-mail)
- AC-001-7 → `…::senha-hash`
- E2E (fluxo crítico) → `e2e/usp-001-auto-cadastro.e2e.ts`

## Lacunas / decisões pendentes

- (nenhuma) — ou liste ACs sem fact, regras não encontradas nos docs, perguntas em aberto.
  Qualquer item aqui é BLOQUEIO de Kickoff Gate (§22.2).
```

Status válidos: `Red` (gerado, falhando) → `Green` (implementado, passando) → `Verified`
(revisado). A skill-tdad entrega tudo em `Red`.
