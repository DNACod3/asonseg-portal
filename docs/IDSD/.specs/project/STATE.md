# STATE — Memória persistente do projeto

> Decisões, pendências, riscos, blockers, convenções. Atualizar a cada sessão. Decisões consolidadas vivem nos ADRs IDSD — aqui só o índice + diff operacional.

## Preferências de modelagem (Bravi)

- **Local do `.specs/`** — `docs/IDSD/.specs/` (não raiz). Decidido em 2026-05-30 pelo usuário.
- **Tratamento das fontes IDSD** — **híbrido**: spec resume ACs, design referencia `architecture-document.md`/`technical-design.md`, tasks usa runbooks como base operacional.
- **USP piloto desta rodada** — USP-004 (Autenticar no portal).

## Decisões já tomadas

### Negócio (ADRs em `IDSD/prd/`)

| ADR | Título | Impacto principal |
|-----|--------|--------------------|
| 0001 | Delegação granular de permissões | Catálogo fechado `portal:*`, app-layer (sem RLS DB) |
| 0008 | Retenção indefinida e direito de acesso | Export manual em 15 dias via DPO |
| 0010 | Custo mínimo como diretriz arquitetural | **Transversal.** Proíbe microsserviços, mensageria pesada, múltiplas bases |
| 0011 | Pessoa = entidade fundamental + papéis compostos | Login único; múltiplos papéis públicos/internos |
| 0012 | Beneficiário como papel social da Pessoa | Cadastro pela AS em situação extrema |
| 0013 | Consentimentos LGPD por finalidade (8) | Append-only com versionamento minor/major |
| 0014 | Empresa sem login, com responsáveis N:N | Empresa validada na 1ª vaga (defesa contra RP-005) |
| 0015 | Moderação humana pré-publicação | FSM aplicada via `transitionContent` |
| 0016 | Encaminhamento = entidade de domínio social | Badge "Encaminhado por ASONSEG" |
| 0017 | Visibilidade conservadora de dados pessoais | Anonimização por padrão, contato sob demanda |
| 0018 | Extração de CV via IA generativa (best-effort) | Validação obrigatória do candidato antes de salvar |

### Técnica (ADRs em `IDSD/architecture/adrs/`)

| ADR | Título | Impacto principal |
|-----|--------|--------------------|
| 0019 | Stack, plataforma, ambientes | Next.js 15 + Supabase + Vercel |
| 0020 | Atomicidade transacional e outbox | `$transaction` única + outbox pós-commit |
| 0021 | Unicidade sob concorrência | `UNIQUE` no DB → 409 determinístico |
| 0022 | Visibilidade via View Models | Anonimização no serializer |
| 0023 | Log append-only (auditoria + consentimentos) | `REVOKE UPDATE, DELETE` no DB |
| 0024 | Máquina de estados de moderação | `transitionContent` única via |
| 0025 | Cascata de revogação de consentimento | Matriz finalidade→efeitos (semântica DEC-015) |
| 0026 | Expiração on-read + job agendado | Verdade no read, job apenas converge |
| 0027 | Porta `CVExtractor` + LLM ZDR | Anthropic Claude Haiku trocável |
| 0028 | Sanitização de PII e upload | Storage privado, URL assinada |
| 0029 | Anti-abuso (rate-limit, CAPTCHA, lockout) | Turnstile + lockout `(email,IP)` 5/15 min |
| 0030 | Revalidação de status/permissão por requisição | Janela ≤30s, cache opcional |

## Decisões pendentes (Gates por fase)

Fonte: `IDSD/architecture/pending-decisions.md`.

### Críticos Fase 1
- **DEC-002** Granularidade de redação dos 8 termos LGPD — *jurídico + DPO*.
- **DEC-011** Aprovação jurídica formal dos 8 termos — *jurídico + DPO*. **Bloqueante global** USP-043.
- **DEC-012** Validação retenção `auth_attempts` (proposta 90 dias) — *DPO Angélica*.
- **DEC-013** Texto UX inativação a pedido do titular — *jurídico + DPO*.
- **DEC-015** Matriz de cascata de revogação — *DPO + jurídico*. Crítico para USP-043.
- **DEC-016** Critério minor/major para mudanças de termo — *DPO + jurídico*.
- **DEC-021** Catálogo final permissões delegáveis `portal:*` — *diretoria + coordenador*.

### Críticos Fase 2
- **DEC-001, 003, 004, 005, 006** Redações de termos finalidades 1–5 — *jurídico*.
- **DEC-018** Checklist verificação manual Empresa (1ª vaga) — *coordenador + Bravi PO*. Defesa principal contra RP-005.
- **DEC-019** Checklist conformidade legal mínima de vaga — *coordenador + jurídico*.
- **DEC-020** Checklist moderação de serviços — *coordenador + jurídico*.
- **DEC-022** Catálogo de unidades + áreas/categorias/regiões com bairro — *diretoria + coordenador*.

### Críticos Fase 3
- **DEC-007, 008, 009, 010** Redações de termos finalidades 4, 6, 8 + template e-mail encaminhamento.
- **DEC-014** Cruzamento dados sociais com públicos — *jurídico + DPO*.
- **DEC-023** Lista 3–5 relatórios prioritários — *diretoria + coordenador*.
- **DEC-025** Treinamento + guideline encaminhadores — *coordenador + AS*.

### Go-Live
- **DEC-017** Revisão final templates e-mail pela DPO.
- **DEC-024** Metas absolutas MP1–MP10 — *sponsor*. Bloqueante de lançamento.

## Riscos abertos (Top 5)

| ID | Risco | Severidade | Mitigação principal |
|----|-------|------------|---------------------|
| RP-005 | Empresa-fantasma ou fraudulenta | **CRÍTICO** | Validação manual 1ª vaga (USP-017) + checklist DEC-018 |
| RP-002 | Vazamento PII via canal lateral (JSON-LD, OG, API) | **CRÍTICO** | View Models (ADR-0022) + storage privado (ADR-0028) |
| RP-008 | ZDR Claude Haiku não confirmado formalmente | **CRÍTICO** | Porta `CVExtractor` + flag de desligamento; fallback manual |
| RP-001 | Gate DEC-002 bloqueia ~17 USPs em produção | **CRÍTICO** | Fase 0 redige + aprova 8 termos ANTES |
| RP-004 | Vaga discriminatória escapa moderação | **ALTO** | Checklist legal mínima (DEC-019) + treinamento coordenador |

## Blockers atuais

**Stack alinhada com IDSD** — Next 15.5.18, Prisma 5.22, Supabase SSR 0.10.3, Zod 3.25, date-fns 4, pino, Vitest 4 e Playwright todos instalados e configurados (ver [.specs/codebase/STACK.md](../codebase/STACK.md)).

### Bloqueadores técnicos descobertos no brownfield (2026-05-30)

Levantados via mapeamento do repo. Detalhes em [.specs/codebase/CONCERNS.md](../codebase/CONCERNS.md) e [.specs/features/usp-004-autenticar-no-portal/gap-analysis.md](../features/usp-004-autenticar-no-portal/gap-analysis.md).

| Concern | Severidade | Bloqueia USP-004? | Status |
|---------|------------|--------------------|--------|
| C-02 `src/middleware.ts` ausente | 🔴 Alta | ✅ bloqueia T-08 | ✅ resolvido (commit 5) |
| C-03 Prisma sem `Person`/`Credential`/`AuthAttempt` | 🔴 Alta | ✅ bloqueia T-00/T-01 | ✅ resolvido (commit 4) |
| C-05 `ActionErrorCode` sem `INVALID_CREDENTIALS` | 🟠 Média | ✅ bloqueia T-06 | ✅ resolvido (commit 3) |
| C-06 `.env`/`env.ts` sem `AUTH_ATTEMPTS_RETENTION_DAYS`, `AUTH_LOGIN_ENABLED` | 🟠 Média | ✅ bloqueia T-06/T-11 | ✅ resolvido (commit 2) |
| Módulos `identity` e `audit` não scaffoldados | 🔴 Alta | ✅ bloqueia T-02..T-09 | ✅ resolvido (commit 1) |
| `bcryptjs` não instalado (anti-timing) | 🟡 Média | ⚠️ T-06 (D-A) | ✅ resolvido (commit 6) |
| C-01 `docker-compose.yml` legado + README desatualizado | 🔴 Alta | ❌ (DX) | ⏳ pendente |
| C-09 `ANTHROPIC_MODEL=claude-sonnet-4-6` em vez de Haiku | 🟡 Média | ❌ (USP-040) | ⏳ pendente (trocar antes USP-040) |

### Bloqueadores de produto/compliance (gates de Fase 1)
- **DEC-002** (termos LGPD), **DEC-011** (aprovação jurídica), **DEC-015** (matriz cascata revogação) — bloqueiam **produção** de USP-043 e dependentes. Não bloqueiam código da USP-004.
- **DEC-012** (retenção 90 dias de `auth_attempts`) — bloqueia **produção** da USP-004 (job de retenção). Solicitar à DPO Angélica.

## Convenções canônicas

Fonte: `IDSD/architecture/project-guideline.md` + `CLAUDE.md`.

1. **Conventional Commits** com escopos válidos: `identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`, `infra`, `docs`, `tests`, `ci`. Squash merge.
2. **Server Action sensível** segue a sequência canônica: Zod → `requirePermission` → `requireActiveConsent` → pré-condições → `withAudit(...)` → transação única. Retorno `ActionResult<T>`. Nunca `throw`.
3. **Mapa de erros**: `VALIDATION | CONFLICT | FORBIDDEN | CONSENT_REQUIRED | NOT_FOUND | PRECONDITION`.
4. **DoD** — happy + 4 sad paths testados (validação, permissão, consentimento, concorrência); cobertura ≥70% geral, ≥90% em domínio; E2E top-8 fluxos.
5. **Privacidade** — nunca retornar Prisma cru de uma Pessoa para outra. Sempre View Model por papel.
6. **Auditoria** — `audit_log` e `consents` append-only (`REVOKE UPDATE, DELETE` no DB).
7. **Cache** — Home/Busca pública = ISR + TTL 600s + revalidação on-demand. Status/permissão revalidado por request (janela ≤30s).
8. **Stack proibida** — Redux, Zustand, Jotai, ORMs alternativos, Redis, Kafka/RabbitMQ, microsserviços. Novos top-level em `src/` exigem RFC.

## TODOs em aberto

### ✅ Sprint pré-USP-004 — CONCLUÍDA (2026-05-30)

Os 6 commits técnicos foram executados em sequência com gates verdes a cada etapa. Resultado: typecheck 0 erros, lint 0 erros (1 warning trivial), **33/33 testes passando** (+11 vs baseline de 22).

| # | Commit | SHA |
|---|--------|-----|
| 1 | `chore(identity): scaffold módulos identity + audit (pré-USP-004)` | `94ff0ac` |
| 2 | `feat(infra): vars de ambiente para autenticação (USP-004)` | `5d8a283` |
| 3 | `feat(identity): INVALID_CREDENTIALS no ActionErrorCode (USP-004)` | `1f5fbab` |
| 4 | `feat(identity): schema Person + Credential + AuthAttempt (USP-004)` | `f080dc8` |
| 5 | `feat(infra): middleware Next stub para revalidação de sessão (ADR-0030)` | `b31b2db` |
| 6 | `chore(identity): bcryptjs + helper anti-timing para login (USP-004)` | `d5c7b37` |

Migration `20260530173731_init_identity_and_auth_attempts` aplicada local (Supabase CLI :55322). Tabelas criadas: `persons`, `credentials`, `auth_attempts` + enums `person_status`, `auth_outcome`.

### Pendências assíncronas
- Solicitar **DEC-012** à DPO Angélica (retenção 90d de `auth_attempts`). Não bloqueia código, bloqueia produção do job T-11.
- Validar `supabase status` com Auth provider habilitado antes de T-05.

### Próximas iterações
- Expandir pipeline para outras USPs Must Have (sugestão: USP-001 auto-cadastro ou USP-043 consentimentos)
- Remover ou atualizar `docker-compose.yml` + `README.md` (C-01)
- Subir threshold coverage de 65% → 70% quando T-06 introduzir 1ª Server Action sensível (C-04)
- Adicionar `dependabot.yml` semanal (C-14)

## Lições / Ideias adiadas

- *Lição inicial* — a base IDSD já cobre arquitetura/contratos com profundidade. O papel dos `.specs` é **operacionalizar a execução** (tasks atômicas com Gate, rastreabilidade AC → spec → task), não duplicar a documentação técnica.
- *Lição do brownfield* — código existe na fundação (`src/shared/*`) mas zero domínio. Os 11 módulos previstos no IDSD ainda não foram scaffoldados — confirma que estamos na transição **pré-Fase 1**, não dentro dela.
- *Ideia adiada* — verificar via `dependabot.yml` + tooling se Prisma 5.22 / Next 15.5 já têm minor updates importantes antes da Fase 1.
