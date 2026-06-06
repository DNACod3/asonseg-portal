# USP-004 — Matriz de rastreabilidade EARS → Fact

Para colar na seção `## Facts` do issue da USP-004 (project-guideline §23.1).
Princípio P1: todo critério em prosa tem fact máquina-verificável antes do Kickoff Gate.

Módulo alvo: `src/modules/identity`. Login é **ação pública** (pré-autenticação) — exceção
justificada à regra `requirePermission` do padrão canônico de Server Action.

## Critérios de Aceitação (EARS)

- **AC-004-1** — WHEN o usuário submete e-mail e senha válidos, the system SHALL autenticar e redirecionar à tela inicial.
- **AC-004-2** — IF as credenciais são inválidas, THEN the system SHALL exibir mensagem genérica "credenciais inválidas".
- **AC-004-3** — IF o usuário falhar 5 tentativas em 15 minutos, THEN the system SHALL bloquear novas tentativas por 15 minutos.
- **AC-004-4** — WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12 horas de inatividade.

## Facts

| AC | Tipo | Fact (path::nome) |
|---|---|---|
| (input) | Schema Zod | `modules/identity/schemas/signInInput.ts::signInInputSchema` |
| AC-004-1 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::happy-path-redirects-home` |
| AC-004-1 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::happy-path-registra-tentativa-de-sucesso` |
| AC-004-1 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::happy-path-audita-LOGIN_SUCCEEDED` |
| AC-004-1 | E2E (Playwright) | `e2e/login.spec.ts::AC-004-1: credenciais válidas autenticam e redirecionam à tela inicial` |
| AC-004-2 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::senha-incorreta-retorna-INVALID_CREDENTIALS` |
| AC-004-2 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::email-inexistente-retorna-mesma-mensagem-que-senha-incorreta` |
| AC-004-2 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::falha-registra-tentativa-e-audita-LOGIN_FAILED` |
| AC-004-2 | E2E (Playwright) | `e2e/login.spec.ts::AC-004-2: credenciais inválidas exibem mensagem genérica` |
| AC-004-3 | Integração (Vitest) | `modules/identity/__tests__/signIn.integration.test.ts::bloqueia-na-6a-tentativa-com-TOO_MANY_ATTEMPTS` |
| AC-004-3 | Integração (Vitest, boundary) | `modules/identity/__tests__/signIn.integration.test.ts::boundary-5a-falha-ainda-processa-6a-bloqueia` |
| AC-004-3 | Integração (Vitest, recovery) | `modules/identity/__tests__/signIn.integration.test.ts::recovery-falhas-fora-da-janela-de-15min-nao-bloqueiam` |
| AC-004-3 | E2E (Playwright) | `e2e/login.spec.ts::AC-004-3: 5 falhas em 15min bloqueiam novas tentativas por 15min` |
| AC-004-4 | Unit (Vitest, boundary) | `modules/identity/__tests__/signIn.integration.test.ts::expira-em-12h-1min` |
| AC-004-4 | Unit (Vitest, boundary) | `modules/identity/__tests__/signIn.integration.test.ts::boundary-valida-em-11h59min` |
| AC-004-4 | E2E (Playwright) | `e2e/login.spec.ts::AC-004-4: sessão encerra após 12h de inatividade` |

## Cobertura — checklist do Kickoff Gate

- [x] Todo AC tem ≥1 fact identificado por path/test name (P1)
- [x] Happy path (AC-004-1)
- [x] Falha de validação Zod (schema de input)
- [x] Caminho de erro / mensagem genérica (AC-004-2)
- [x] Concorrência / rate-limit, incl. boundary 5ª/6ª e recovery (AC-004-3)
- [x] Regra temporal de sessão com boundaries (AC-004-4)
- [n/a] Permissão negada — login é ação pública pré-autenticação
- [n/a] Consentimento ausente — não há finalidade LGPD vinculada ao login

## Dependências de infra a confirmar antes do dev

- Eventos `LOGIN_SUCCEEDED` e `LOGIN_FAILED` precisam ser adicionados ao catálogo
  `@/modules/audit/events.ts` (hoje não constam no technical-design). **Pendência para o gate.**
- Helpers de teste declarados em `signIn.integration.test.ts`
  (`seedActiveCredential`, `seedFailedAttempts`, `getAuthAttempts`, `getAuditEvents`)
  a serem providos pela infra de testes do módulo `identity`.
- Tabela `auth_attempts` já modelada no technical-design §2.1 (model `AuthAttempt`).
- CAPTCHA após 3 falhas/IP (ADR-0014): coberto pelo `captchaToken` opcional no schema +
  código `CAPTCHA_REQUIRED`; é defesa adicional, não AC formal da USP-004 — fora do escopo
  obrigatório do gate, mas previsto no contrato.

## Fontes da verdade consultadas

- PRD: `docs/prd/prd-asonseg-portal-mvp.md` (USP-004, linhas 272-283)
- ADR-0003: Supabase Auth + RBAC aplicacional; bloqueio 5/15min via wrapper sobre `auth_attempts`; sessão `@supabase/ssr` em cookie HttpOnly
- ADR-0014: CAPTCHA Turnstile no login apenas após 3 falhas/IP
- ADR-0015: sessão server-side, cookie HttpOnly, `maxAge` 12h
- technical-design.md §2.1: models `AuthAttempt`, `persons.email_login`; helpers `getCurrentUser`/`withAudit`
- project-guideline.md §20-23: princípios Fact-Driven, Kickoff Gate, EARS→Fact; §Server Action canônica
