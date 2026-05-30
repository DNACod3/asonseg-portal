# Project Guideline — Portal Empregabilidade e Serviços ASONSEG

**Versão:** 1.0
**Última atualização:** 2026-05-28
**Status:** Ativo
**Referência arquitetural:** [`architecture-document.md`](./architecture-document.md)

Este documento define os padrões, convenções e regras técnicas para o projeto **Portal ASONSEG**. É a fonte de verdade consultada pelos PRs (via skill `pr-review`) e por novos desenvolvedores.

**Como ler este documento:**
- ✅ regra obrigatória (deve)
- ❌ regra proibitiva (não deve)
- 💡 recomendação (boa prática, não obrigatória)
- 🚨 violação crítica (bloqueia PR)
- ⚠️ violação de aviso (não bloqueia, mas requer atenção)

---

## 1. Stack Técnico

| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Linguagem | TypeScript | 5.x | strict: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` |
| Runtime | Node.js | 20 LTS | runtime da Vercel |
| Framework | Next.js (App Router) | 15.x | Server Components first; mutações via Server Actions |
| Banco de dados | PostgreSQL via Supabase | 15 | região `sa-east-1` |
| Cache | Next.js ISR / cache de dados | — | sem Redis no MVP |
| Fila / Mensageria | Tabela `outbox` + Vercel Cron | — | ❌ sem broker (ADR-0010/0020) |
| Storage | Supabase Storage (privado) | — | URLs assinadas (ADR-0028) |
| Autenticação | Supabase Auth (e-mail/senha) | — | sem RLS — autorização na app |
| ORM | Prisma | 5.x | `$transaction` p/ atomicidade |
| Migrations | Supabase CLI / Prisma migrate | — | forward-only |
| Validação | Zod | 3.x | toda entrada de Server Action |
| UI | shadcn/ui + Tailwind + Radix | — | WCAG 2.1 AA |
| Forms | React Hook Form + zodResolver | — | |
| IA | Anthropic Claude Haiku (ZDR) | — | via porta `CVExtractor` (ADR-0027) |
| CAPTCHA | Cloudflare Turnstile | — | validação server-side (ADR-0029) |
| E-mail | SMTP gerenciado (Resend/SES) | — | via outbox |
| Datas | date-fns + date-fns-tz | — | TZ `America/Sao_Paulo` |
| Testes | Vitest (unit/int) + Playwright (E2E) | — | cobertura: meta 70%, CI falha < 65% |
| Linter/Format | ESLint + Prettier | — | |
| CI/CD | GitHub Actions + Vercel | — | |
| Observabilidade | pino (logs estruturados) | — | |

### 1.1. Bibliotecas Permitidas

- **Validação:** Zod
- **Datas:** date-fns + date-fns-tz (TZ `America/Sao_Paulo`)
- **Forms:** React Hook Form
- **UI:** shadcn/ui, Radix, Tailwind
- **LLM:** `@anthropic-ai/sdk` (apenas no adapter de `cv-extraction`)

✅ Antes de adicionar uma nova dependência, validar com o Tech Lead.
❌ Não introduzir Redux, MobX, Zustand, Jotai, ORMs alternativos, CSS-in-JS além do Tailwind, libs de data além de date-fns, ou libs de state machine.

---

## 2. Estrutura de Pastas e Padrão Arquitetural

**Padrão adotado:** Monolito Modular fullstack (Next.js App Router + Server Actions) com Ports & Adapters.

### 2.1. Estrutura de Diretórios

```
src/
├── app/
│   ├── (public)/      # ISR + revalidação on-demand (home, vagas, servicos)
│   ├── (auth)/        # no-cache (login, cadastro, recuperar-senha)
│   └── (app)/         # autenticado, force-dynamic (perfil, empresa, moderacao, ...)
├── modules/
│   └── <dominio>/     # identity | persons | companies | consents | moderation |
│       ├── actions/        # Server Actions ('use server')
│       ├── queries/        # leituras (read-only)
│       ├── domain/         # tipos, enums, regras puras (sem IO)
│       ├── schemas/        # Zod
│       ├── components/     # componentes React do módulo
│       ├── views/          # View Models por papel (privacidade)
│       ├── ports/          # interfaces (DI)
│       ├── adapters/       # implementações concretas
│       ├── __tests__/
│       └── index.ts        # barrel export — todo import passa por aqui
└── shared/
    ├── ui/            # shadcn/ui genérico
    ├── lib/           # Prisma singleton, Supabase clients, time, logger
    ├── env.ts         # variáveis validadas por Zod
    ├── errors.ts      # tipo ActionResult<T>
    └── container.ts   # bindings ports→adapters (DI)
```

Os 11 módulos: `identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`.

### 2.2. Regras de Importação Entre Camadas

✅ `app/` pode importar de `modules/*` (via barrel) e `shared/`
✅ `modules/<a>` pode importar de outro `modules/<b>` **apenas via barrel** (`@/modules/<b>`)
✅ `modules/*/adapters` pode importar SDKs externos; `modules/*/domain` NÃO
❌ `domain/` NÃO importa de `actions/`, `adapters/`, Prisma ou SDK externo
❌ Import por deep path (`@/modules/persons/actions/x`) — sempre via barrel `@/modules/persons`
❌ Criar nova pasta de topo em `src/` (só `app/`, `modules/`, `shared/`) — requer RFC

🚨 Violações de regra de importação são bloqueantes em PR.

**Aplicação automática:** ESLint `no-restricted-imports` (proíbe deep paths e import de `@anthropic-ai/sdk` fora de `cv-extraction/adapters`).

### 2.3. Limites de Arquivo

✅ Tamanho máximo de arquivo: 300 linhas
✅ Tamanho máximo de função/método: 50 linhas

⚠️ Arquivos ou funções acima do limite devem ser refatorados antes do merge.

---

## 3. Convenções de Nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivos | kebab-case | `cadastrar-empresa.ts` |
| Classes / Tipos | PascalCase | `PessoaView` |
| Funções / Server Actions | camelCase, verbo | `cadastrarEmpresa` |
| Variáveis locais | camelCase | `pessoaId` |
| Constantes | UPPER_SNAKE_CASE | `MAX_TENTATIVAS_LOGIN` |
| Tabelas DB | snake_case, plural | `person_role_grants` |
| Colunas DB | snake_case | `created_at` |
| Enums de domínio | PascalCase | `StatusConteudo` |
| Eventos de auditoria | UPPER_SNAKE_CASE | `PERSON_CREATED` |

### 3.1. Sufixos de Arquivo

| Tipo | Sufixo |
|---|---|
| Server Action | `.action.ts` |
| Query (leitura) | `.query.ts` |
| View Model | `.view.ts` |
| Schema Zod | `.schema.ts` |
| Port (interface) | `.port.ts` |
| Adapter | `.adapter.ts` |
| Teste unitário | `.spec.ts` |
| Teste integração | `.int.spec.ts` |
| Teste E2E | `.e2e.spec.ts` |

✅ Todo arquivo deve seguir o sufixo da sua categoria.

---

## 4. Padrões de Projeto

### 4.1. Permitidos

- Port-Adapter (DI via `shared/container.ts`), Repository (via Prisma), Factory, Strategy, Adapter
- View Model por papel, Outbox, State Machine de domínio (tabela de transições — sem lib)
- `ActionResult<T>` (Either-like) para retorno de Server Action

### 4.2. Requerem Aprovação

- Qualquer cache distribuído (Redis), qualquer broker, qualquer novo serviço externo

### 4.3. Proibidos

❌ God Object — módulo/arquivo com múltiplas responsabilidades distintas
❌ Acesso direto ao Prisma para retornar dados de uma Pessoa a outra (usar View Model)
❌ `prisma.<conteudo>.update({ status })` direto (usar `transitionContent` — ADR-0024)
❌ Bibliotecas de state machine (XState etc.)

---

## 5. Tratamento de Erros

✅ Server Actions retornam sempre `ActionResult<T>` = `{ ok: true, data } | { ok: false, error }`
✅ Conflito de unicidade → `{ ok: false, error: 'CONFLICT' }` (HTTP 409 determinístico, ADR-0021)
✅ Erros inesperados: logar (pino, sem PII) e retornar erro genérico ao usuário

❌ **`throw` a partir de Server Action** — sempre retornar `ActionResult`
❌ Retornar `null`/`undefined` em caso de falha esperada
❌ Engolir exceções silenciosamente em jobs/worker do outbox
🚨 Falha de auditoria (`withAudit`) NÃO pode ser silenciosa — reverte a transação ou dispara alerta (ADR-0023)

### 5.1. Mapa de Erros

| Erro | Resultado | Tratamento |
|---|---|---|
| Validação Zod | `{ ok:false, error:'VALIDATION' }` | mensagens por campo |
| Unicidade (P2002) | `{ ok:false, error:'CONFLICT' }` | 409, mensagem específica por chave |
| Permissão negada | `{ ok:false, error:'FORBIDDEN' }` | `requirePermission` |
| Consentimento ausente | `{ ok:false, error:'CONSENT_REQUIRED' }` | `requireActiveConsent` |
| Não encontrado | `{ ok:false, error:'NOT_FOUND' }` | |

---

## 6. Validação

### 6.1. Validação Sintática (entrada de Server Action)

✅ Toda Server Action valida a entrada com um **schema Zod** (`*.schema.ts`) antes de qualquer lógica
✅ O retorno do LLM (extração de CV) passa por **whitelist Zod** — campos fora do escopo são descartados (ADR-0027/0028)

### 6.2. Validação de Domínio

✅ Regras puras de negócio ficam em `domain/` (sem IO) e são testadas isoladamente
✅ Pré-condições de negócio (ex.: "Empresa tem ≥1 responsável") são verificadas antes da escrita

❌ Repetir a mesma validação sem propósito entre camadas

---

## 7. Padrões de Mutação e Leitura (substitui "API REST")

> O MVP não expõe API REST versionada. Mutações = Server Actions; leituras = Server Components/queries. Rotas HTTP só para Cron, validação de CAPTCHA e health check.

### 7.1. Sequência Canônica da Server Action Sensível

✅ Toda Server Action sensível segue **exatamente** esta ordem (ver `runbook-server-action`):

```
1. Validar entrada com Zod
2. requirePermission(...)              // autorização por papel/permissão delegada
3. requireActiveConsent(pessoaId, finalidade)   // quando a operação é vinculada a finalidade LGPD
4. Checar pré-condições de negócio
5. withAudit('EVENT', async (tx) => { ...escritas + outbox... })   // transação única
6. return { ok: true, data } | { ok: false, error }
```

✅ `pessoaId` vem **sempre da sessão**, nunca do payload (anti-IDOR — USP-006/P-002)
🚨 Pular `requirePermission` ou `requireActiveConsent` numa ação sensível é bloqueante

### 7.2. Códigos / Resultados

| Operação | Sucesso | Observação |
|---|---|---|
| Criar | `{ ok:true, data }` | |
| Conflito de unicidade | `{ ok:false, error:'CONFLICT' }` | nunca 500, nunca dupla escrita |
| Validação | `{ ok:false, error:'VALIDATION' }` | |
| Sem permissão | `{ ok:false, error:'FORBIDDEN' }` | |
| Sem consentimento | `{ ok:false, error:'CONSENT_REQUIRED' }` | |

### 7.3. Paginação e Busca

✅ Toda query de listagem usa `take` (paginação obrigatória) + `select`/`include` explícitos
✅ Busca textual: match case-insensitive **sem acentos** sobre os campos definidos (ADR/`runbook-search-pagination`)
✅ Busca pública filtra **on-read** (`status='ativo' AND validade >= now()`), independente do job de expiração
❌ `findMany` sem `take` em coleção que cresce
❌ Query N+1 (lookup dentro de loop) — usar `include`/batch

### 7.4. Autenticação

✅ Rotas `(public)/` explicitamente sem sessão; `(auth)/` e `(app)/` exigem o fluxo de sessão
✅ Status e permissões revalidados **a cada requisição** autenticada (cache ≤30s — ADR-0030)

---

## 8. Persistência e Acesso a Dados

### 8.1. Acesso

✅ Acesso a dados via Prisma encapsulado no módulo dono da entidade
✅ Dados de uma Pessoa expostos a **outra** Pessoa: somente via **View Model** (`*.view.ts`) — ADR-0022
❌ `actions`/`components` de um módulo importando Prisma de outro módulo (passar pelo barrel)
❌ Retornar entidade Prisma crua de Pessoa/ficha social para outro papel

### 8.2. Transações

✅ Operações com múltiplas escritas usam **uma transação Prisma** (`$transaction`) — ADR-0020
✅ `withAudit('EVENT', tx)` participa da **mesma transação** da escrita — ADR-0023
✅ Efeitos colaterais externos (e-mail) via **outbox** (linha gravada na mesma transação, despacho pós-commit)
❌ Disparar e-mail/efeito externo **dentro** da transação (gera órfão em rollback — USP-044/P-003)

### 8.3. Unicidade, Imutabilidade e Estado

✅ Unicidade (CPF, e-mail, CNPJ, candidatura/manifestação/vínculo ativo) garantida por `UNIQUE` no DB — ADR-0021
✅ `audit_log` e `consents` são append-only (`REVOKE UPDATE, DELETE`); revogação/atualização = novo INSERT — ADR-0023
✅ Mudança de status de conteúdo **somente** via `transitionContent()` — ADR-0024
✅ Soft-delete por status terminal (retenção indefinida — ADR-0008); sem DELETE físico de Pessoa/conteúdo/consentimento
🚨 `prisma.<conteudo>.update({ status })` fora de `transitionContent` é bloqueante

### 8.4. Migrations

✅ Toda mudança de schema em migration versionada (Supabase CLI / Prisma)
✅ Migrations forward-only
✅ `REVOKE UPDATE, DELETE` aplicado a `audit_log` e `consents` por migration

---

## 9. Testes

### 9.1. Cobertura Mínima

✅ Cobertura geral: meta **70%**; CI falha abaixo de **65%**
✅ Cobertura de `domain/` (regras puras): **90%**
✅ Server Actions sensíveis: **80%** (integração)

### 9.2. Tipos Obrigatórios

✅ Server Action sensível cobre: **happy path, falha de validação Zod, permissão negada, consentimento ausente, concorrência (quando aplicável)**
✅ Unitários — regras de `domain/`, View Models (visibilidade por papel)
✅ Integração — Server Actions, adapters externos (mock do LLM/SMTP)
✅ E2E — top 8 fluxos críticos (Playwright)

### 9.3. Convenções

✅ Nome de teste: `deve_[resultado]_quando_[condição]` (PT-BR)
✅ Testes de View Model verificam explicitamente "papel X NÃO vê campo Y"

### 9.4. Localização

- Unit + Integração: `modules/<dominio>/__tests__/`
- E2E: `e2e/` na raiz

---

## 10. Observabilidade

### 10.1. Logs

✅ Formato: JSON estruturado (pino)
✅ Campos obrigatórios: `timestamp`, `level`, `context` (módulo), `message`, `correlationId`
✅ Contexto de negócio quando aplicável: `pessoaId`, `empresaId` (IDs internos, não PII)
✅ Retenção de **logs operacionais: 2 anos** (QP-008). `audit_log` e `consents` têm retenção indefinida (ADR-0008/0023 — não confundir com logs operacionais).
✅ Retenção de **`auth_attempts` (tentativas de login/cadastro falhas): 90 dias**, parametrizável via env `AUTH_ATTEMPTS_RETENTION_DAYS` (default 90), expurgado por job agendado. Janela curta e própria (carrega PII: IP + e-mail; finalidade anti-bot não exige histórico longo — minimização LGPD, ADR-0008). Ver expectations USP-001/L-004.

❌ Logar: senhas, tokens, CPF, e-mail/telefone completos, conteúdo de CV, **corpo de e-mail**, dados da ficha social (USP-044/P-008)

### 10.2. Métricas

✅ Técnicas: latência por ação, taxa de erro, tamanho/retry do outbox
✅ Negócio: MP1–MP10 (candidatos ativos, empresas verificadas, vagas, candidaturas, encaminhamentos, MP10 = tempo médio de moderação)
✅ Nomenclatura snake_case com sufixo de unidade (`_total`, `_seconds`)

### 10.3. Alertas (RNF 6.6)

✅ Job de expiração **não rodou** (heartbeat ausente) — ADR-0026
✅ Quota SMTP ≥ 80% — USP-044/P-006
✅ Volume anômalo de login bloqueado / candidatura / scraping — ADR-0029
✅ Custo/uso da API LLM acima do limite — ADR-0027

### 10.4. Health Check

✅ Endpoint: `GET /api/health` — checa Postgres, Auth, Storage, e provedores críticos

---

## 11. Segurança

✅ HTTPS/TLS em toda comunicação
✅ Senhas com bcrypt via Supabase Auth (cost factor 10, gerenciado pelo provedor — não configurável pela app; senha em claro nunca toca o nosso código)
✅ Lockout: 5 tentativas / 15 min por chave combinada `(email, IP)` — ADR-0029
✅ CAPTCHA (Turnstile) validado **server-side** no auto-cadastro
✅ Rate limiting por rota/identidade nas APIs públicas e sensíveis
✅ Secrets em variáveis de ambiente validadas por Zod (`shared/env.ts`), NUNCA em código
✅ Upload validado por magic bytes + tamanho + checagem de conteúdo antes do storage (ADR-0028)
✅ Token de reset de senha: uso único, 24h, invalida pendentes, não exposto em referrer

❌ Logar dados sensíveis (ver 10.1)
❌ Expor stack traces em produção
❌ Hardcoded credentials de qualquer tipo
❌ Revelar existência/inexistência de Pessoa (mensagem genérica + timing normalizado) — ADR-0029

### 11.1. Proteção de PII

| Dado | Tratamento em logs |
|---|---|
| Telefone | NUNCA logar completo |
| CPF / Documento | NUNCA logar |
| E-mail | NUNCA logar completo |
| CV (conteúdo/arquivo) | NUNCA logar; storage privado + URL assinada |
| Ficha socioeconômica | NUNCA logar; cripto em repouso; só AS/diretoria |
| Corpo de e-mail | NUNCA logar (só metadado de envio) |

### 11.2. Visibilidade por Papel

✅ Anonimização (Empresa→setor para anônimo) feita na **montagem do View Model/serializer**, cobrindo HTML, JSON, meta tags OG/Twitter, JSON-LD, schema.org, alt de imagem e URL canônica — ADR-0022
🚨 Vazar nome de Empresa para anônimo ou ficha social para coordenador/voluntário por **qualquer canal** é bloqueante (USP-021/022/036/039/042)
✅ Contato só revelado após ação afirmativa (candidatura/manifestação) — reciprocidade (ADR-0017)

---

## 12. Compliance e Privacidade

**Frameworks aplicáveis:** LGPD (Lei 13.709/2018).

✅ Consentimento por **finalidade** (8 finalidades, enum fechado) registrado append-only com titular+finalidade+versão+data+IP — ADR-0013/0023
✅ `requireActiveConsent(pessoaId, finalidade)` antes de toda operação vinculada a finalidade
✅ Revogação desativa o papel/funcionalidade da finalidade via **matriz de cascata** + verificação **on-read**; preserva histórico — ADR-0025
✅ Versionamento de termo: mudança "major" exige re-aceite; "minor" preserva aceite
✅ CV enviado ao LLM **somente** com ZDR configurado; termo da finalidade 7 menciona o provedor — ADR-0027
✅ Retenção indefinida com base institucional; direito de acesso atendido manualmente em 15 dias (ADR-0008); export auditado

❌ Adicionar finalidade fora das 8 sem decisão de produto + revisão jurídica (USP-043/P-008)
🚨 Ativar papel/funcionalidade sem consentimento da finalidade persistido na mesma transação (USP-001/P-002) é bloqueante
🚨 Editar/apagar registro de consentimento (revogação é novo INSERT) é bloqueante

---

## 13. Git e Versionamento

### 13.1. Estratégia de Branches

**Estratégia:** GitHub Flow. **Branch base:** `master`. **Merge:** Squash; PR + CI verde + dual review (agente IA + Tech Lead).

### 13.2. Nomenclatura de Branches

✅ Padrão: `{tipo}/{ID}-{descrição-curta}` — tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`
Exemplos: `feat/USP-001-auto-cadastro`, `fix/USP-024-expiracao-on-read`

### 13.3. Commits

✅ Conventional Commits: `<tipo>(<escopo>): <descrição>`
✅ Escopos válidos: `identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`, `infra`, `docs`, `tests`, `ci`
Exemplos: `feat(referrals): encaminha Pessoa para vaga com badge`, `fix(consents): cascata de revogação on-read`

### 13.4. Pull Requests

✅ Descrição com: o que muda, por que muda, como testar; link para a USP
✅ CI verde obrigatório; dual review obrigatório

⚠️ PRs muito grandes devem ser justificados ou divididos.

---

## 14. Performance

### 14.1. Metas

| Métrica | Meta |
|---|---|
| Operações interativas | ≤ 2s p95 |
| Home pública | ≤ 1.5s p95 (cache TTL 600s + revalidação on-demand) |
| Extração de CV (assíncrona) | ≤ 30s p95 |
| Export CSV (mensal) | ≤ 10s p95 |
| Export PDF | ≤ 20s p95 |

### 14.2. Padrões a Evitar

❌ Query N+1 — usar `include`/batch
❌ `findMany` sem `take`
❌ `await` sequencial em operações independentes — usar `Promise.all`
❌ Múltiplas escritas sem transação

💡 ISR + cache curto para busca pública e home; pré-agregação para relatórios de janela longa.

---

## 15. Checklist Estrutural — Pre-Commit

```
□ Nomeação e sufixo de arquivo seguem seção 3
□ Importação respeita regras de camadas (seção 2.2) e usa barrel
□ Nenhum arquivo > 300 linhas; nenhuma função > 50 linhas
□ Server Action sensível segue a sequência canônica (Zod → requirePermission → requireActiveConsent → pré-condições → withAudit/transação)
□ pessoaId vem da sessão, nunca do payload
□ Server Action retorna ActionResult, nunca faz throw
□ Dados de Pessoa→Pessoa passam por View Model (nunca entidade crua)
□ Anonimização/recorte de campos no View Model/serializer, não no template
□ Mudança de status de conteúdo só via transitionContent()
□ Múltiplas escritas em uma transação; e-mail via outbox (nunca dentro da transação)
□ Unicidade por UNIQUE no DB; conflito → 409 determinístico
□ withAudit na mesma transação; consents/audit append-only
□ requireActiveConsent presente em operação vinculada a finalidade LGPD
□ Busca pública filtra on-read (status ativo + validade)
□ Logs sem PII (seção 11.1)
□ Testes: happy path + validação + permissão + consentimento (+ concorrência quando aplicável)
□ Cobertura mínima atendida (seção 9.1)
□ Migration criada se schema mudou (REVOKE em audit_log/consents quando aplicável)
□ Conventional commits com escopo válido
```

---

## 16. Referências do Projeto

- [Documento de Arquitetura](./architecture-document.md)
- [Technical Design Document](./technical-design.md)
- [ADRs](./adrs/) — negócio 0001–0018, técnicos 0019–0030
- [Matriz de Conexões](../ice-portal-asonseg/matriz-conexoes.md) — índice por-USP (ICE)
- [Runbooks](./runbooks/) — padrões reutilizáveis de implementação

### 16.1. Padrões Externos Adotados

- Sequência de Server Action, View Models e auditoria seguem os runbooks em `./runbooks/`.

---

## 17. Atualização Deste Documento

Mudanças significativas seguem: (1) proposta via ADR; (2) aprovação Tech Lead + Arquiteto; (3) atualização desta versão + CHANGELOG; (4) comunicação ao time.

**Última revisão:** 2026-05-28 por Arquiteto Bravi
