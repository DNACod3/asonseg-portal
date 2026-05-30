# spec.md — USP-004: Autenticar no portal com e-mail e senha

> **Modo híbrido IDSD.** Esta spec **resume e referencia** as fontes IDSD; não é fonte da verdade. Para o texto canônico:
> - PRD: `IDSD/prd/prd-asonseg-portal-mvp.md §USP-004 (linhas 272–283)`
> - Intent: `IDSD/ice-portal-asonseg/intents/intent-USP-004.md`
> - Expectations: `IDSD/ice-portal-asonseg/expectations/expectations-USP-004.md`
> - Diretrizes técnicas: `IDSD/architecture/technical-design.md §4.4, §7.1, §8.3`
> - ADRs: `architecture/adrs/0029-anti-abuso-rate-limit-captcha-lockout.md`, `0030-revalidacao-de-status-e-permissao-por-requisicao.md`, `0020-atomicidade-transacional-e-outbox.md`, `0023-log-append-only-auditoria-e-consentimentos.md`

## 1. História do Usuário

> Como **usuário com credencial ativa**, quero fazer login no portal com meu e-mail e senha, para que eu possa usar as funcionalidades autenticadas.

**Prioridade:** Must · **Épico:** 1 — Identidade, Acesso e Papéis · **Owner do intent:** Sponsor + Diretoria (segurança).

USP-004 é o **gate de entrada de todas as USPs autenticadas**. Qualquer fragilidade aqui (bypass de bloqueio, fixação de sessão, enumeração de e-mails) contamina o sistema inteiro (`intent-USP-004.md §1`).

## 2. Critérios de Aceitação (EARS)

Mapeados 1:1 dos Expectations IDSD (`expectations-USP-004.md §1`). IDs `AC-004-*` mantêm o numeral do PRD; novos cenários derivados levam letras (`AC-004-3a` etc.).

| ID | Critério (EARS) | Origem |
|----|------------------|--------|
| **AC-004-1** | **WHEN** o usuário submete e-mail e senha válidos, **THE SYSTEM SHALL** autenticar a Pessoa, iniciar sessão de 12h fixas, carregar papéis ativos e redirecionar para a tela inicial pertinente. | E-001 |
| **AC-004-2** | **IF** as credenciais são inválidas (e-mail não cadastrado **OU** senha incorreta), **THEN THE SYSTEM SHALL** exibir mensagem **idêntica** `"credenciais inválidas"` em ambos os casos. | E-002 (ajusta AC-004-2 do PRD) |
| **AC-004-3** | **IF** o usuário falha 5 tentativas em 15 minutos, **THEN THE SYSTEM SHALL** bloquear novas tentativas por 15 min usando chave combinada `(email, IP)`, **não-exponencial**. | E-003 + ADR-0029 |
| **AC-004-4** | **WHILE** o usuário está autenticado, **THE SYSTEM SHALL** encerrar a sessão **12h após o login** (tempo fixo, não inatividade). | E-004 (ajusta AC-004-4 do PRD: fixo, não inatividade) |
| **AC-004-5** | **WHEN** uma Pessoa cuja senha foi gerada pela ASONSEG (cenário USP-003) autentica pela 1ª vez, **THE SYSTEM SHALL** forçar troca de senha antes de liberar funcionalidades. | E-005 |
| **AC-004-6** | **WHEN** o login conclui (sucesso ou falha), **THE SYSTEM SHALL** gravar evento de auditoria com `pessoaId` (quando aplicável), `email`, `IP`, `userAgent`, `timestamp`, `outcome`. | E-006 |

## 3. Proibições (must-not)

Cada proibição cita o cenário de fracasso (F-x) do intent que ela neutraliza.

| ID | Proibição | Mitiga | Fonte |
|----|-----------|--------|-------|
| **P-001** | NÃO PODE permitir bypass do lockout via troca de IP **nem** troca de e-mail isolada. Política cobre ambos os vetores via `(email, IP)`. | F1 brute-force | ADR-0029 |
| **P-002** | NÃO PODE diferenciar mensagens de "e-mail não encontrado" vs "senha incorreta". Resposta idêntica **e tempos comparáveis** (±50ms) — sem timing attack. | F2 enumeração | E-002, L-001 |
| **P-003** | NÃO PODE emitir cookie de sessão sem `HttpOnly`, `Secure`, `SameSite` adequados. Cookie inseguro em produção é falha bloqueante. | F3 fixação | E-003, L-005 |
| **P-004** | NÃO PODE permitir que Pessoa marcada inativa (USP-007) execute operações autenticadas mesmo com sessão de 12h ativa. Status revalidado por request (janela ≤30s). | F4 sessão zumbi | ADR-0030 |
| **P-005** | NÃO PODE concluir login bem-sucedido sem registrar evento de auditoria. Falha de auditoria dispara alerta operacional. | F5 log silencioso | ADR-0023, technical-design §8.3 |
| **P-006** | NÃO PODE permitir, após reset de senha via USP-005, que sessões ativas com a senha antiga continuem válidas. Reset invalida todas as sessões da Pessoa. | F6 janela dupla | E-006, ADR-0023 |
| **P-007** | NÃO PODE permitir login de Pessoa cadastrada **sem credencial** (USP-002 — cadastro pela AS). Nenhuma rota — direta, "esqueci minha senha", ou alternativa. | controle de acesso | E-007 |

## 4. Limites Não-Funcionais

| ID | Limite | Valor | Origem |
|----|--------|-------|--------|
| **L-001** | Performance (p95) | ≤ 3s submit → resposta. Sucesso e falha em tempos comparáveis. | E-L-001 |
| **L-002** | Duração da sessão | 12h fixas desde o login. | E-L-002 |
| **L-003** | Lockout | 5 tentativas em 15 min por `(email, IP)`. Não-exponencial. | ADR-0029 |
| **L-004** | Rate limit por IP | Endpoint de login com rate limit agressivo (parâmetro tunável). | technical-design §7.1 |
| **L-005** | Cookie | `HttpOnly` + `Secure` + `SameSite=Lax` (mínimo). Não-negociável em produção. | E-L-005 |
| **L-006** | Retenção `auth_attempts` | 90 dias (env `AUTH_ATTEMPTS_RETENTION_DAYS`). **Pendente:** validação DPO (DEC-012). | project-guideline §10 |

## 5. Critérios de Pronto (do dono do intent)

Espelhados de `expectations-USP-004.md §4`. Cada um vira teste demonstrável.

- **D-001** Ensaio de carga: 100 tentativas de senha errada para a mesma Pessoa, de IPs diferentes, acionam bloqueio dessa Pessoa após 5 tentativas no agregado **ou mecanismo equivalente**. Validar com sponsor.
- **D-002** Teste de enumeração: 10 tentativas alternadas com e-mails existentes e inexistentes retornam mensagens **idênticas** e tempos indistinguíveis (within ±50ms).
- **D-003** Teste de inativação: após inativar Pessoa com sessão ativa, próxima requisição autenticada é negada em ≤30s (ADR-0030).
- **D-004** Ensaio de reset: senha antiga deixa de funcionar **e** sessões ativas são derrubadas imediatamente após USP-005.
- **D-005** Sponsor abre auditoria de logins recentes (via USP-008/USP-039) e vê eventos sucesso/falha com Pessoa, IP, UA, timestamp.

## 6. Escopo

### Dentro do escopo
- Login via e-mail e senha contra Supabase Auth com adapter na camada `identity`.
- Lockout `(email, IP)` 5/15 min via tabela `auth_attempts`.
- Resposta genérica + tempos comparáveis (anti-enumeração + anti-timing).
- Sessão 12h fixa (decisão de elicitação — não inatividade).
- Cookie `HttpOnly+Secure+SameSite`.
- Revalidação de status/permissão a cada request via `requirePermission()` / middleware (ADR-0030).
- Evento de auditoria `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILURE` (`audit_log`) + alerta de volume anômalo.
- Troca forçada de senha no 1º acesso (`primeiro_acesso=true`).
- Bloqueio de login para Pessoa sem `credential` (USP-002).
- Tela de login + tela de troca obrigatória de senha.

### Fora do escopo (deferred / outra USP)
- SSO, OAuth, MFA (decididamente fora do MVP — `intent §2`).
- Auto-cadastro (USP-001), reivindicação de credencial (USP-003), recuperação de senha (USP-005), inativação de Pessoa (USP-007).
- CAPTCHA na tela de login — Turnstile é aplicado em **auto-cadastro** (USP-001) e **reset de senha** (USP-005). Não é exigência da USP-004 (intent §2 + ADR-0029).
- Botão "Continuar conectado" / refresh token rotativo — sessão 12h fixa.

## 7. Conexões

Triangulação com `IDSD/ice-portal-asonseg/matriz-conexoes.md` (linha da USP-004).

- **Upstream (precondições):** USP-001 (auto-cadastro) **ou** USP-003 (reivindicação de credencial) precisam ter rodado para a Pessoa ter credencial.
- **Downstream (depende):** todas as USPs autenticadas — USP-006, 007, 008, 009, 010, 011, 012, ..., 044.
- **ADRs aplicáveis:** ADR-0010 (custo mínimo), ADR-0020 (transação + outbox), ADR-0023 (auditoria append-only), ADR-0029 (lockout + rate limit), ADR-0030 (revalidação por request).
- **Riscos:** RP-009 (volume / DoS — mitigado por rate limit), risco proposto pelo intent: brute-force + enumeração.
- **Métricas indiretas:** "nº de logins bloqueados/dia" como sinal anti-bot (`technical-design §11`).

## 8. Dependências e Pendências

- ✅ Stack auth decidida — Supabase Auth (bcrypt cost factor 10 default, gerenciado pelo provedor; **não assumir cost ≥12** — technical-design §7.1).
- ✅ Lockout: chave `(email, IP)`, 5/15 min, não-exponencial (ADR-0029).
- ✅ Revalidação por request: janela ≤30s (ADR-0030).
- ⚠️ **DEC-012** — janela de retenção de `auth_attempts` (proposta 90 dias) precisa de validação da DPO Angélica. **Não bloqueia código**; pode-se shipar com 90 dias e ajustar via env após validação.
- ✅ DEC-001 (DPO) — resolvido (Angélica).
- ✅ Consentimento — login em si **não** consome `requireActiveConsent` (operação técnica de identidade, não finalidade LGPD). Acesso ao conteúdo após login dispara seus próprios gates.

## 9. Notas de Implementação

- **Anti-timing**: o caminho de senha incorreta deve **sempre** executar um `bcrypt.compare` contra hash dummy para nivelar tempo com o caminho de e-mail inexistente. Validar empiricamente em CI (teste de variância de tempo).
- **Atomicidade**: incremento de `auth_attempts` + emissão de evento de auditoria devem estar na mesma transação (ADR-0020) para evitar contagem fantasma em caso de crash.
- **Revalidação**: o helper `requirePermission()` central (a ser criado no módulo `identity`) é a única via de revalidação por request. Server Components autenticados o invocam no início.
- **Reset**: a invalidação de sessões ativas após reset (USP-005) precisa de mecanismo Supabase (`auth.admin.signOut(userId)` ou bump de `session_version` no JWT custom claim). Decidir na USP-005; **aqui** apenas garantimos que a USP-004 *honra* o bump (re-check do session version a cada request).
- **Auditoria de falha**: registrar mesmo em falha — payload sem `pessoaId` quando e-mail inexistente, com `pessoaId` quando senha incorreta. Cuidar para não revelar a existência da Pessoa via diferença de payload em logs públicos.
