# Rastreabilidade EARS → Fact — USP-004 Autenticar no portal com e-mail e senha

Fonte: PRD §Épico 1 USP-004. Gerado por skill-tdad. Cobertura: 4/4 ACs com fact.
Documentos-fonte: ADR-T-0003 (Supabase Auth, RBAC aplicacional, bloqueio 5/15min via wrapper
sobre `auth_attempts`, sessão `@supabase/ssr` em cookie HttpOnly), ADR-T-0004 (auditoria/`auth_attempts`),
technical-design (`model AuthAttempt`: email, ip, success, failureCode, attemptedAt), project-guideline §4/§12.

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| AC-004-1 | WHEN…SHALL | WHEN o usuário submete e-mail e senha válidos, the system SHALL autenticar e redirecionar à tela inicial. | integração (+E2E candidato) | `@ac-004-1` | `modules/identity/__tests__/autenticarComSenha.integration.test.ts::happy-path` | Red |
| AC-004-2 | IF…THEN | IF as credenciais são inválidas, THEN the system SHALL exibir mensagem genérica "credenciais inválidas". | integração + schema Zod | `@ac-004-2` | `…autenticarComSenha.integration.test.ts::credenciais-invalidas` + `…::email-inexistente` + `modules/identity/schemas/loginInput.ts` | Red |
| AC-004-3 | IF…THEN | IF o usuário falhar 5 tentativas em 15 minutos, THEN the system SHALL bloquear novas tentativas por 15 minutos. | integração (stateful + concorrência) | `@ac-004-3` | `…autenticarComSenha.integration.test.ts::bloqueio-5-em-15min` + `…::bloqueio-expira` + `…::concorrencia-contagem` | Red |
| AC-004-4 | WHILE…SHALL | WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12 horas de inatividade. | integração / invariante de sessão | `@ac-004-4` | `…autenticarComSenha.integration.test.ts::sessao-expira-12h` + `…::sessao-mantida-com-atividade` | Red |

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- AC-004-1 (happy path) → `modules/identity/__tests__/autenticarComSenha.integration.test.ts::happy-path`
- AC-004-2 (credenciais inválidas) → `…::credenciais-invalidas`
- AC-004-2 (anti-enumeração e-mail inexistente) → `…::email-inexistente`
- AC-004-2 (validação de fronteira) → `modules/identity/schemas/loginInput.ts` (Zod) + `…::validacao-zod`
- AC-004-3 (bloqueio 5/15min) → `…::bloqueio-5-em-15min`
- AC-004-3 (expiração da janela) → `…::bloqueio-expira`
- AC-004-3 (concorrência da contagem) → `…::concorrencia-contagem`
- AC-004-4 (sessão expira 12h) → `…::sessao-expira-12h`
- AC-004-4 (sessão mantida com atividade) → `…::sessao-mantida-com-atividade`
- E2E (login como portão dos fluxos críticos) → `e2e/usp-004-login.e2e.ts` (test.fixme)

## Notas de derivação

- **Login é Server Action pública pré-autenticação:** `requirePermission` NÃO se aplica (justificado por
  ADR-T-0003). `requireActiveConsent` NÃO se aplica (login não está atrelado a finalidade LGPD). Por isso
  os casos obrigatórios "permissão recusada" e "consentimento ausente" do §12 ficam intencionalmente fora,
  com justificativa registrada no `.spec.ts`. Os demais casos obrigatórios (happy path, validação Zod,
  concorrência) estão cobertos.
- **AC-004-3 envolve concorrência** (corrida no contador da janela de 15 min sobre `auth_attempts`) — gerado
  como `it.todo` de concorrência, conforme §12 ("quando aplicável").
- **`auth_attempts` vs `audit_log`:** o bloqueio e o registro de sucesso/falha de login moram em `auth_attempts`
  (ADR-T-0003/T-0004), não em `audit_log`. O catálogo de eventos de auditoria (ADR-0004) não define evento de
  login dedicado (o comentário do schema cita `AUTH_LOGIN` apenas como exemplo). Os facts assertam contra
  `auth_attempts`, não exigem `withAudit` para o login em si.

## Lacunas / decisões pendentes

Itens abaixo são pontos de atenção para o Kickoff Gate (§22.2). Nenhum AC ficou SEM fact (cobertura 4/4),
mas três decisões de implementação afetam como o fact "fica verde":

1. **Mensagem de bloqueio (AC-004-3) — texto e código de erro.** O PRD especifica o comportamento ("bloquear
   novas tentativas por 15 minutos") mas não o texto exibido nem se a UI revela a duração do bloqueio. Os facts
   usam `code: 'ACCOUNT_TEMPORARILY_LOCKED'` e mensagem "temporariamente bloqueada" como placeholder. Confirmar
   com PO antes de marcar `Verified`. (Não bloqueia o Gate — comportamento testável; só o texto exato pende.)
2. **Escopo do bloqueio (AC-004-3) — por e-mail, por IP, ou ambos.** O `model AuthAttempt` indexa por `email`
   e por `ip`. O AC fala em "o usuário", sugerindo escopo por e-mail. ADR-T-0003 diz "via wrapper aplicacional
   sobre `auth_attempts`" sem fixar a chave. Os facts assumem escopo POR E-MAIL. Decisão de design a confirmar
   com o Tech Lead (impacta o teste de concorrência).
3. **Mecânica da expiração de sessão (AC-004-4) — 12h de inatividade (sliding) vs. tempo absoluto.** O AC diz
   "12 horas de inatividade", ou seja, janela deslizante renovada por atividade. O Supabase Auth expira por TTL
   de refresh/access token; mapear "inatividade" para a configuração concreta do Supabase é decisão técnica
   ainda não documentada em ADR. Marcado como `it.todo` até a definição. **É o item mais próximo de bloqueio**:
   se a plataforma não suportar "inatividade deslizante" nativamente, precisa de wrapper próprio — confirmar na Fase 0.
