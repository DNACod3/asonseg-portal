# ASONSEG — Documento de Arquitetura

**Projeto:** Portal Empregabilidade e Serviços (Release 1 — MVP) + fundação compartilhada para Release 2 (Frente 4)
**Versão:** 2.0 (corresponde ao PRD v0.3 — pivô para Portal)
**Data:** 2026-05-22
**Autor:** Bravi Software — Arquitetura
**Status:** Aceito — aguardando estimativa fina do Tech Lead (D-010)

---

## 1. Sumário Executivo

A ASONSEG (Ação Social Nossa Senhora de Guadalupe) precisa de um **portal público** que conecte candidatos a vagas e prestadores de serviço a clientes da comunidade de Florianópolis. O sistema também precisa preparar a **fundação compartilhada** (identidade unificada, papéis compostos, LGPD por finalidade) que vai sustentar a Frente 4 (gestão social) quando ela for retomada como Release 2.

Esta arquitetura propõe um **monolito modular Next.js fullstack**, hospedado em **Vercel** com banco e storage em **Supabase** (região São Paulo), implementando o domínio em **11 módulos coesos**: `identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`.

**Decisões diferenciadoras:**

- **Pessoa unificada com papéis compostos** (ADR-T-0008) — uma pessoa acumula livremente papéis de candidato, prestador, cliente, empresa-responsável, voluntária e (no Release 2) beneficiária. Schema sustenta isso desde o MVP.
- **Visibilidade conservadora via View Models tipados** (ADR-T-0010) — LGPD com minimização aplicada em TypeScript, não por boa intenção.
- **Moderação humana pré-publicação como máquina de estados explícita** (ADR-T-0011) — toda vaga, CV e serviço passa por aprovação; estados, transições e efeitos colaterais são código central.
- **Integração com LLM via Port-Adapter** (ADR-T-0012) — Anthropic Claude no MVP, mas **trocar de vendor é trivial** (requisito explícito do cliente).
- **ISR longo + on-demand revalidation** (ADR-T-0013) — conteúdo público rápido, vaga aprovada aparece em segundos, defesa em profundidade contra falhas de invalidação.
- **Custo operacional alvo:** US$ 5-15/mês inicial → US$ 60-80/mês confortável → US$ 100-150/mês em expansão (subiu da Frente 4 pelo LLM e pelo tráfego anônimo).

**Princípio dominante:** menor área de superfície para o time de 5 pessoas operar com confiança. Cada decisão pode ser revertida no nível do módulo ou do ADR sem refactor estrutural.

---

## 2. Contexto

### 2.1 O que estamos construindo

O Portal Empregabilidade e Serviços é o **canal estruturado** entre a comunidade atendida pela ASONSEG em Florianópolis (Canasvieiras, Jurerê, Ingleses) e:
- Empresas locais buscando candidatos
- Prestadores de serviço PF/MEI da comunidade
- Clientes contratando serviços

O sistema também atua como **plataforma institucional ativa** da ASONSEG via *encaminhamento* — assistente social pode indicar Pessoa para vaga com badge visível à empresa. Esse é o diferencial estratégico que separa o portal de um agregador comercial.

A entrega inclui **toda a fundação compartilhada** que o sistema ASONSEG vai usar nas próximas frentes (Cenário 1 — identidade unificada plena): Pessoa unificada, papéis compostos, autenticação e autorização, consentimentos LGPD por finalidade, auditoria imutável transversal, visão consolidada da Pessoa para gestão. Quando a Frente 4 voltar como Release 2 para implementar estoque, distribuição e Família estruturada, ela chega para *ativar* funcionalidades sobre Pessoa que já existe, não para refatorar.

### 2.2 Quem usa

| Persona | Perfil | Volume estimado V1 |
|---|---|---|
| Visitante anônimo | Navegação pública de vagas e serviços | Centenas a milhares de pageviews/mês |
| Candidato | Cadastro, busca de vagas, candidatura | 200-500 |
| Empresa-responsável | Pessoa que representa Empresa(s); publica vaga, busca candidato | 30-100 Empresas, 50-150 Pessoas-responsáveis |
| Prestador de serviço | PF/MEI publicando serviços | 50-150 |
| Cliente de serviço | Manifesta interesse em serviços | Centenas |
| Assistente social | Cadastra Pessoa em situação extrema, ficha social, encaminha | ~5 (núcleo interno) |
| Coordenador da área Portal | Modera, valida Empresa, delega permissões | 2-5 |
| Diretoria | Visão consolidada, configurações globais, DPO | 5-10 |

Vagas ativas alvo (final do 1º ano): 50-200. CVs ativos: 200-500. Serviços ativos: 30-100.

### 2.3 Restrições do contexto

- **Orçamento:** R$ 50.000 inicialmente aprovados; estimativa qualitativa do PO para escopo deste MVP indica faixa provável R$ 80-150k. Estimativa fina do Tech Lead (D-010) determina o número exato.
- **Custo operacional dominante:** custo mínimo (ADR-0010 de negócio estendido). Aceitação de Free tiers + LLM em volume controlado.
- **Sem prazo dura.** "O mais breve possível" — sem data dura de go-live.
- **LGPD substancial:** múltiplos titulares (candidatos, empresas-responsáveis, prestadores, clientes, beneficiários) com finalidades distintas. Termo único genérico não cobre.
- **PWA + web responsivo, online-only.** Sem modo offline. Disponibilidade até 21h.
- **Equipe inicial:** Tech Lead, 2 desenvolvedores plenos, QA, UI/UX, PO, DevOps. Não tem SRE dedicado — arquitetura precisa ser auto-suportável.

---

## 3. Visão da Arquitetura

### 3.1 Estilo arquitetural

**Monolito modular** com Next.js App Router (TypeScript estrito), Prisma sobre Postgres gerenciado, Supabase Auth para autenticação e Supabase Storage para arquivos. Server Components majoritariamente; Server Actions para mutations; Client Components apenas onde houver interatividade real (filtros, toggle "atuar como", formulários complexos).

Justificativa central: **único deploy, único banco, único pipeline de tipos**. Custos cognitivos baixos, blast radius pequeno, evolução para microsserviços disponível mas não necessária no horizonte conhecido. (ADR-T-0001)

### 3.2 Diagrama de contexto

```
                   ┌─────────────────────────────────────┐
                   │      Visitante anônimo (mobile)     │
                   │  - Navega vagas/serviços públicos   │
                   │  - Vê home com indicadores          │
                   └────────────────┬────────────────────┘
                                    │ HTTPS
                                    ▼
   ┌─────────────────────────────────────────────────────────────┐
   │              Portal ASONSEG (Next.js fullstack)             │
   │   ┌────────────────────────────────────────────────────┐    │
   │   │ Rotas públicas (ISR longo + on-demand revalidation)│    │
   │   └────────────────────────────────────────────────────┘    │
   │   ┌────────────────────────────────────────────────────┐    │
   │   │ Rotas autenticadas (NetworkOnly; SC dinâmicos)     │    │
   │   └────────────────────────────────────────────────────┘    │
   │   ┌────────────────────────────────────────────────────┐    │
   │   │ Server Actions (requirePermission + Zod + audit)   │    │
   │   └────────────────────────────────────────────────────┘    │
   └──┬──────┬──────────┬──────────┬─────────┬────────────┬─────┘
      │      │          │          │         │            │
      ▼      ▼          ▼          ▼         ▼            ▼
   Supabase  Supa-   Resend    Sentry   Anthropic    Cloudflare
   Postgres  base    (e-mail)  (errors) Claude       Turnstile
   sa-east-1 Storage           +logs    (CV extract) (CAPTCHA)
       │
       │ nightly
       ▼
   Backblaze B2 (backup duplo — ADR-T-0006)
```

### 3.3 Domínios e módulos

11 módulos no MVP, com fronteiras claras de responsabilidade:

| Módulo | Responsabilidade | ADRs principais |
|---|---|---|
| `identity` | Autenticação (Supabase Auth), sessão, recuperação senha, bloqueio temporário, CAPTCHA, toggle "atuar como" | T-0003, T-0014, T-0015 |
| `persons` | Pessoa unificada, papéis compostos via `person_role_grants`, perfis por papel (candidato, prestador, cliente), ficha socioeconômica simplificada, reivindicação de credencial, visão consolidada | T-0008 |
| `companies` | Empresa, vínculo N:N Pessoa-responsável, flag verificada, edição que rebaixa verificação | T-0015 |
| `consents` | Consentimentos LGPD por finalidade (8 finalidades MVP), versionamento de termo, revogação granular | T-0009 |
| `moderation` | Máquina de estados de moderação, fila do coordenador, validação manual de Empresa, decisões com justificativa | T-0011 |
| `jobs` | Vagas (CRUD do autor + busca pública), candidaturas silenciosas, expiração automática | T-0011, T-0013 |
| `services` | Serviços (CRUD + busca pública), manifestações de interesse | T-0011, T-0013 |
| `referrals` | Encaminhamentos institucionais (entidade própria), badge na ficha da Empresa, registro de resultado | — |
| `cv-extraction` | Integração com LLM via Port-Adapter; orquestração de upload, extração, validação humana | T-0012 |
| `audit` | `withAudit` wrapper, `audit_log` append-only, catálogo de eventos | T-0004 |
| `reporting` | Relatórios operacionais com CSV/PDF, home pública, indicadores | T-0013 |

Cada módulo tem estrutura padronizada (`actions/`, `queries/`, `domain/`, `schemas/`, `components/`, `views/`, `ports/`, `adapters/`, `__tests__/`). Detalhes no `project-guideline.md`.

### 3.4 Camadas e responsabilidades

```
┌────────────────────────────────────────────────────────────────┐
│ App Router pages                                               │
│   (public)/* — ISR + on-demand                                 │
│   (app)/*    — dinâmico, NetworkOnly no PWA                    │
├────────────────────────────────────────────────────────────────┤
│ Server Components & Client Components (UI)                     │
│   Renderiza View Models tipados                                │
├────────────────────────────────────────────────────────────────┤
│ Server Actions ('use server')                                  │
│   requirePermission + Zod + withAudit + transição               │
├────────────────────────────────────────────────────────────────┤
│ Domain & Application Services                                  │
│   transitionContent, viewXForY, computeIndicators, etc.        │
├────────────────────────────────────────────────────────────────┤
│ Ports (interfaces) & Adapters                                  │
│   CVExtractor, EmailSender, CaptchaVerifier, etc.              │
├────────────────────────────────────────────────────────────────┤
│ Prisma Client + Supabase Storage SDK + Resend SDK + Sentry     │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Quality Attributes & NFRs

### 4.1 Performance (PRD §6.1)

| Atributo | Alvo | Mecanismo |
|---|---|---|
| p95 operações interativas | ≤ 2s | Server Actions com Prisma transactional; queries indexadas |
| p95 home pública | ≤ 1.5s | ISR 10 min + indicadores cachados (ADR-T-0013) |
| p95 relatórios CSV (mensal) | ≤ 10s | Streaming de CSV server-side |
| p95 relatórios PDF | ≤ 20s | `@react-pdf/renderer` em Server Action |
| p95 extração CV via LLM | ≤ 30s | Async com feedback de progresso; fallback gracioso (AC-040-3) |

### 4.2 Disponibilidade

- 99% no horário operacional (8h-21h, todos os dias)
- Janela de manutenção 21h-8h
- Sem SLA contratual — alvo interno

### 4.3 Segurança (PRD §6.3)

- TLS em toda comunicação (Vercel default)
- Senhas com bcrypt via Supabase Auth (Argon2id default — equivalente)
- Bloqueio temporário 5 tentativas / 15min (wrapper aplicacional)
- CAPTCHA no auto-cadastro público (Cloudflare Turnstile)
- Rate limiting por IP/usuário/endpoint (Vercel Edge Middleware ou `@upstash/ratelimit` em sessão futura)
- Criptografia em repouso para dados sensíveis (Supabase column encryption configurável; ou criptografia aplicacional para CPF se decidido)
- Audit log imutável (ADR-T-0004)
- Validação de CNPJ por dígito verificador (lib `@brazilian-utils/brazilian-utils`)

### 4.4 LGPD (PRD §6.7)

- Consentimentos por finalidade (ADR-T-0009)
- DPO designado a um diretor (D-001 bloqueante)
- Termos de responsabilidade por categoria (D-002)
- Direito de acesso atendido em até 15 dias sob demanda da AS/diretoria
- Direito de revogação implementado granularmente
- Termo da finalidade `CV_AI_EXTRACTION` cita o provedor LLM atual (ADR-T-0012)

### 4.5 Acessibilidade

- WCAG 2.1 AA como diretriz
- Atenção especial a público com baixo letramento digital (idosos, beneficiários)
- shadcn/ui base + Radix — componentes acessíveis por padrão

### 4.6 Observabilidade

- Logs estruturados via `pino`
- Sentry para erros (frontend + backend, free tier 5k events/mês)
- Vercel Analytics (web vitals) — free
- Métricas funcionais (MP1–MP10) via queries no Postgres + dashboard básico (Metabase em V2 ou cron-job exportando para CSV)
- Audit log como fonte de verdade para auditoria humana

---

## 5. Modelo de Dados — Visão Macro

### 5.1 Entidades centrais

```
Person (id, fullName, cpf?, emailLogin?, supabaseUserId?, isActive, ...)
  │
  ├─ PersonRoleGrant (role, status, activatedAt, revokedAt) [1:N]
  ├─ CandidateProfile [1:0..1]
  ├─ ProviderProfile [1:0..1]
  ├─ ClientProfile [1:0..1]
  ├─ SocioeconomicRecord [1:0..1]
  ├─ Consent (purpose, termVersion, acceptedAt, revokedAt) [1:N]
  └─ PersonCompanyGrant (companyId, type, startedAt, endedAt) [1:N]

Company (id, legalName, cnpj, isVerified, status, createdByPersonId, ...)
  └─ PersonCompanyGrant (personId, type) [1:N]

Job (id, companyId, title, description, validUntil, status, ...)
  └─ Application (candidatePersonId, appliedAt, cancelledAt, viaReferralId?)

Service (id, personId, companyId?, categoryId, status, ...)
  └─ ServiceInterest (clientPersonId, interestedAt, cancelledAt)

Referral (id, personId, jobId, referrerPersonId, justification, result, ...)

ModerationDecision (id, contentKind, contentId, fromStatus, toStatus, moderatorId, justification, decidedAt)
  ↑ catálogo histórico complementar; audit_log é a fonte de verdade

AuditLog (id, actorUserId, action, entityType, entityId, before, after, context, ip, userAgent, occurredAt)
  ↑ append-only com REVOKE UPDATE,DELETE (ADR-T-0004)

JobArea, ServiceCategory, Region — dados mestres parametrizados pela diretoria
```

Schema Prisma detalhado em `technical-design.md`.

### 5.2 Decisões de modelagem que valem destacar

- **Pessoa pode existir sem credencial** (`supabaseUserId IS NULL`) — viabiliza USP-002
- **Papel é grant explícito**, não flag — viabiliza revogação granular sem perder dados de perfil (ADR-T-0008)
- **Empresa é entidade autônoma** com responsáveis via N:N — sem login próprio, com rastreabilidade individual (ADR-T-0015)
- **Consentimento é registro independente** com versão de termo + hash de conteúdo — comprovação LGPD robusta (ADR-T-0009)
- **Status de conteúdo é coluna em cada tabela** (job, service, candidateProfile) com transições controladas por função canônica `transitionContent` (ADR-T-0011)

---

## 6. Fluxos Críticos (visão macro)

Detalhados em sequence diagrams no `technical-design.md`. Aqui só listagem:

1. **Auto-cadastro público de Pessoa** (USP-001) — CAPTCHA → cria Pessoa + ativa papel + envia boas-vindas
2. **Reivindicação de credencial** (USP-003) — solicitação → verificação humana (AS/diretoria) → ativação
3. **Ativar papel adicional** (USP-006) — exibe consentimento da finalidade → aceite → grant ativa
4. **Publicar vaga** (USP-020 + USP-016 + USP-017) — empresa-responsável cria rascunho → submete → moderador valida (checklist se 1ª vaga) → aprova → revalidation
5. **Candidatura silenciosa** (USP-025) — candidato candidata → empresa recebe na lista com contato revelado (sensitive access logged) → e-mail confirma candidato
6. **Encaminhamento institucional** (USP-037) — AS encaminha Pessoa → papel candidato ativado se necessário → candidatura gerada com badge → e-mail informativo
7. **Upload + extração de CV** (USP-040) — candidato faz upload → consentimento finalidade 7 → LLM extrai → revisão humana obrigatória → confirmação → audit
8. **Moderação aprovar/devolver/rejeitar** (USP-016) — fluxo de transitionContent + side effects orquestrados
9. **Revogação de consentimento** (USP-043) — Pessoa revoga finalidade X → role grant correspondente vira REVOKED → dados de perfil preservados mas não acessíveis

---

## 7. Plataforma e Custos

### 7.1 Componentes da plataforma

| Componente | Provedor | Tier MVP | Função |
|---|---|---|---|
| Hospedagem app | Vercel | Hobby | Edge + Server runtime |
| Database | Supabase Postgres 15 | Free | RDBMS principal |
| Storage | Supabase Storage | Free | CV, foto prestador, termos |
| Auth | Supabase Auth | Free | E-mail/senha |
| E-mail | Resend | Free | 100/dia (suficiente MVP) |
| Erros | Sentry | Free | 5k events/mês |
| LLM | Anthropic Claude API | pay-as-you-go | Extração de CV |
| CAPTCHA | Cloudflare Turnstile | Free | Ilimitado |
| Backup externo | Backblaze B2 | pay-as-you-go | ~US$ 0,005/GB/mês |

### 7.2 Custos estimados

| Cenário | Componentes pagantes | Total mensal |
|---|---|---|
| **Tier inicial** (Free tiers + LLM modesto) | LLM ~US$ 5-15 + B2 ~US$ 0,50 | **US$ 5-15** |
| **Tier confortável** (Vercel Pro + Supabase Pro) | Vercel US$ 20 + Supabase US$ 25 + LLM US$ 10-30 + B2 US$ 1 | **US$ 60-80** |
| **Tier expansão** (volume crescendo) | Idem confortável + LLM mais alto | **US$ 100-150** |

Premissas: 500 extrações de CV/ano em volume confortável; volume baixo de e-mails; tráfego anônimo cabe em Hobby (100GB bandwidth/mês). ⚠️ Vercel Hobby tem cláusula "non-commercial" — para ONG operando portal aberto, **validar elegibilidade com a Vercel antes do go-live** (também levantado no ADR-T-0002).

### 7.3 Ambientes

- **Local** — stack do **Supabase CLI** (Postgres 15 + Auth + Storage + Mailpit), via `supabase start` — ver **ADR-0016**. _(Estratégia anterior — Docker Compose com Postgres + MailHog — descontinuada; o `docker-compose.yml` permanece apenas como fallback.)_
- **Staging** — projeto Supabase + projeto Vercel dedicados (data sintético)
- **Produção** — projeto Supabase + projeto Vercel dedicados

---

## 8. Trade-offs Aceitos Conscientemente

| Trade-off | Por que aceitamos |
|---|---|
| Sem RLS no Postgres | Combinatória de visibilidade do Portal seria invívivel em SQL; View Models em TypeScript ganham em revisão |
| Monolito vs. microsserviços | Volume e equipe não justificam; reversível mais tarde |
| Free tiers como ponto de partida | ASONSEG é ONG; custo mínimo é diretriz dura; upgrade quando dor real aparecer |
| Sem job runner dedicado (Inngest/Trigger) | GitHub Actions cron cobre o mínimo (backup, expiração de vagas); custo zero |
| Sem SEO no MVP | Captação inicial via rede da ASONSEG; SEO em V2 |
| Sem sistema de denúncia formal | Coordenador inativa via USP-018; canal externo de e-mail; baixa frequência esperada |
| Termo de consentimento versionado fora do banco (Git) | Auditável via PR; hash persistido garante integridade |
| LLM em fluxo síncrono (até 30s) | Volume baixo; fallback gracioso resolve casos ruins; assinc real exigiria fila |

---

## 9. Riscos e Premissas

### 9.1 Premissas a validar na Fase 0

| ⚠️ | Premissa | Validação |
|---|---|---|
| ⚠️ | Vercel Hobby aceita uso da ASONSEG (ONG operando portal aberto) | Contato com Vercel ou upgrade preventivo para Pro |
| ⚠️ | Supabase sa-east-1 estável o suficiente; região próxima reduz latência | Monitorar p95 em ambiente staging |
| ⚠️ | Anthropic ZDR continua default para clientes pagantes | Revisar termos vigentes; jurídico confirma |
| ⚠️ | Time da Bravi tem expertise em Next.js App Router + Prisma + Supabase | Confirmar; se gap, capacitação na Fase 0 |

### 9.2 Riscos arquiteturais novos vs. Frente 4

| Risco | Mitigação |
|---|---|
| Carga de moderação inviabiliza operação (RP-004) | Métrica MP10; voluntários delegados; em escala, autopilot via LLM em V2 |
| Custo do LLM excede expectativa | Rate limit em uploads de CV (3/candidato/dia); monitoramento de custo |
| Conteúdo proibido permanece visível por até 30 min (cache) | Inativação via USP-018 dispara revalidation imediato; redeploy purga total se crítico |
| Drift entre visibilidade pretendida e implementada | View Models tipados + testes de cada combinação |
| Vaga aprovada com Empresa-fantasma escapando da validação manual (RP-005) | Checklist obrigatória do moderador na 1ª vaga; lista de verificação como entregável Fase 0 |

---

## 10. Decisões Registradas

| # | Título | Status |
|---|---|---|
| ADR-T-0001 | Monolito modular Next.js fullstack | Aceito + nota de extensão Portal |
| ADR-T-0002 | Vercel + Supabase como plataforma | Aceito + nota de extensão Portal |
| ADR-T-0003 | Supabase Auth + RBAC aplicacional + identidade pública (sem RLS) | Reescrito para Portal |
| ADR-T-0004 | Auditoria imutável via tabela append-only | Aceito + nota de extensão Portal |
| ADR-T-0005 | Storage de arquivos sensíveis (CV/termo privados, foto pública) | Reescrito para Portal |
| ADR-T-0006 | Backup duplo Supabase + Backblaze B2 | Aceito + nota de extensão Portal |
| ADR-T-0007 | PWA online-only + ISR longo + on-demand revalidation | Reescrito para Portal |
| ADR-T-0008 | Pessoa unificada + papéis compostos | Novo |
| ADR-T-0009 | Consentimentos LGPD por finalidade | Novo |
| ADR-T-0010 | Visibilidade conservadora via View Models | Novo |
| ADR-T-0011 | Máquina de estados de moderação | Novo |
| ADR-T-0012 | LLM com abstração de provedor (Claude inicial) | Novo |
| ADR-T-0013 | ISR + on-demand revalidation (detalhado) | Novo |
| ADR-T-0014 | CAPTCHA Cloudflare Turnstile | Novo |
| ADR-T-0015 | Empresa sem login + toggle "atuar como" | Novo |
| ADR-T-0016 | Ambiente de desenvolvimento local via Supabase CLI | Novo |

ADRs de negócio 0001-0018 estão sob `decisions/` do projeto (ADRs 0011-0018 são deste release; 0001-0010 ficam aplicáveis ao Release 2).

---

## 11. Plano de Fases

| Fase | Duração estimada | Conteúdo principal |
|---|---|---|
| **Fase 0 — Setup e Spikes** | 1-2 semanas | Provisionar Vercel + Supabase + Resend + Sentry + Turnstile + Anthropic API; drill restore obrigatório; spike Pooler + Prisma; spike Turnstile; spike Claude com prompt de extração; validar Vercel ONG; checklist Empresa-fantasma; lista inicial de regiões/categorias |
| **Fase 1 — Identidade + Consentimentos** | 3-4 semanas | Schema `persons`, `person_role_grants`, `consents`; Supabase Auth integrado; auto-cadastro USP-001 com CAPTCHA; recuperação senha; reivindicação credencial USP-003; helpers `getCurrentUser/requirePermission`; audit_log + withAudit; consentimentos por finalidade USP-043; termos versionados |
| **Fase 2 — Empresas + Vagas + Moderação** | 4-5 semanas | Schema `companies`, `person_company_grants`, `jobs`; toggle "atuar como"; cadastro Empresa USP-012-015; máquina de estados de moderação `transitionContent` USP-016-018; validação manual Empresa USP-017; vaga USP-020-024; e-mails de moderação (USP-044 parcial) |
| **Fase 3 — Candidaturas + Busca + CV Extraction** | 3-4 semanas | Schema `applications`; busca pública vagas USP-021-022 com ISR; candidatura silenciosa USP-025-026; busca de candidatos USP-027-028 com View Models; visibilidade conservadora; integração LLM USP-040 com abstração; upload CV; revalidation on-demand |
| **Fase 4 — Serviços + Manifestações** | 2-3 semanas | Schema `services`, `service_interests`; CRUD serviços USP-029-032; busca pública USP-030-031; manifestação USP-033-035; foto prestador no bucket público |
| **Fase 5 — Ficha social + Encaminhamento + Visão consolidada** | 2 semanas | `socioeconomic_records`; ficha simplificada USP-036; `referrals`; encaminhamento USP-037 + resultado USP-038; visão consolidada USP-039 com View Model de AS |
| **Fase 6 — Relatórios + Home + Hardening + LGPD** | 2-3 semanas | Home pública USP-041 com indicadores; relatórios USP-042 (CSV/PDF); painel de consentimentos USP-043 com revogação; e-mails restantes USP-044; hardening de segurança; revisão LGPD com DPO (D-001) |
| **Lançamento** | 1 semana | UAT com sponsor; documentação operacional; treinamento de moderadores e AS; cutover |

**Total: 18-24 semanas.** Maior que a Frente 4 (14-19 semanas), refletindo o escopo dobrado.

Fases podem se sobrepor parcialmente após a Fase 2 (paralelizar candidaturas com serviços quando estabilidade permitir). Fatiamento real só após estimativa fina (D-010).

---

## 12. Próximos Passos

1. **Validação do pacote** com Nei (CTO Bravi / sponsor projeto).
2. **Estimativa fina pelo Tech Lead** (D-010 bloqueante para nova rodada de orçamento).
3. **Resolver Q-abertas do PRD**: QP-001 (verificação de credencial), QP-002 (provedor LLM — endossado neste pacote como Claude), QP-003 (CAPTCHA — endossado como Turnstile), QP-004 (TTL home — endossado 10 min), QP-008 (retenção audit log — 1 ano), QP-010 (regiões/categorias).
4. **Designar DPO** (D-001 — diretor ASONSEG).
5. **Produzir termos de consentimento** revisados por jurídico (D-002 — 8 termos no MVP).
6. **Fase 0 do projeto** assim que orçamento for confirmado.

---

## 13. Referências

- PRD MVP Portal v0.3 (`prd-asonseg-portal-mvp.md`)
- PRD Frente 4 v0.2 (`prd-asonseg-frente4-v2.md`) — Release 2
- CHANGELOG do projeto (`CHANGELOG.md`)
- 15 ADRs técnicos em `architecture/adrs/`
- ADRs de negócio 0001-0018 em `decisions/`
- `project-guideline.md` — guia de implementação e convenções
- `technical-design.md` — detalhamento técnico, schema, sequências, plano de fases
