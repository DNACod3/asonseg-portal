# ADR-0003 (Técnico) — Supabase Auth, RBAC aplicacional e identidade pública sem RLS

- **Status:** Aceito — Reescrito para Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** seguranca | autenticacao | autorizacao | lgpd | identidade-publica
- **Substitui:** versão anterior deste ADR (escopo Frente 4); a substituição amplia o escopo, não diverge do princípio

## Contexto e Problema

O Portal MVP traz três classes de usuários que não existiam na Frente 4 e que exigem ampliação consciente da arquitetura de identidade:

1. **Auto-cadastro público** — visitante anônimo se cadastra com nome, CPF, e-mail, senha e ativa ao menos um papel público (candidato, prestador, cliente, empresa-responsável). Cadastro exige CAPTCHA (USP-001).
2. **Pessoa cadastrada pela AS sem credencial** — em situações extremas (USP-002), AS cadastra Pessoa sem e-mail/senha; a Pessoa pode reivindicar credencial depois (USP-003) com verificação de identidade.
3. **Empresa N:N sem login** — Empresa é entidade do sistema mas não tem credencial; operações em nome dela são feitas por Pessoa-responsável logada (ADR-0014 de negócio).

Adicionalmente, o Portal introduz **visibilidade conservadora** (ADR-0017 de negócio): dados pessoais ocultos por padrão, revelação após autenticação + ação afirmativa. Isso é uma camada de autorização adicional sobre o RBAC tradicional, que será detalhada no ADR-T-0010.

A decisão central deste ADR é definida em três planos:

- Onde mora a autenticação (build vs. buy)
- Onde mora a autorização (aplicação vs. RLS no banco)
- Como representar **Pessoa unificada com papéis compostos** (ADR-0011 de negócio + ADR-T-0008 técnico)

## Drivers de Decisão

- Custo mínimo de desenvolvimento e manutenção (ADR-0010 de negócio)
- Auditabilidade do modelo de papéis e permissões delegáveis (catálogo finito definido no Glossário do PRD)
- Testabilidade do controle de acesso e da visibilidade conservadora
- Pessoa sem credencial precisa ser representada e referenciável em encaminhamentos, ficha social, relatórios — mas não pode fazer login
- Empresa precisa ter rastreabilidade individual de quem fez o quê (log identifica a Pessoa-responsável, não a Empresa)
- LGPD com múltiplas finalidades exige separação clara entre "Pessoa existe" e "Pessoa autorizou finalidade X" (ADR-0013 de negócio)

## Opções Consideradas

### Opção A — Autenticação própria + autorização aplicacional

Mesmas conclusões da versão anterior deste ADR para a Frente 4: descartada por custo de desenvolvimento e manutenção de auth crítico.

### Opção B — Supabase Auth + autorização aplicacional sem RLS (escolhida)

**Autenticação:** Supabase Auth (e-mail/senha) com CAPTCHA na borda de cadastro público (ADR-T-0014). Sessão server-side via `@supabase/ssr` em cookies HttpOnly. Bloqueio após 5 tentativas em 15 min via wrapper aplicacional sobre `auth_attempts`.

**Pessoa sem credencial:** representada na tabela `persons` com `supabase_user_id` NULL. Não tem entrada no Supabase Auth até reivindicar credencial. Reivindicação (USP-003) é fluxo administrativo da AS/diretoria que verifica identidade fora do sistema (presencial, carta com código, ou confirmação pela AS — Q-aberta QP-001 a resolver na Fase 0) e em seguida cria o usuário no Supabase Auth e vincula ao `person_id` existente.

**Autorização:** **inteiramente em código de aplicação**. Catálogo finito de papéis (Role) e permissões delegáveis em TypeScript. Helper `requirePermission(action, context)` chamado no topo de toda Server Action sensível.

**Empresa sem login:** entidade `companies` sem vínculo direto a Supabase Auth. Pessoa-responsável (vínculo N:N via `person_company_grants`) opera em nome da Empresa via toggle de sessão "atuar como [Empresa X] | como eu" (ADR-T-0015). Audit log sempre registra `actor_user_id` da Pessoa, com contexto adicional `acting_as_company_id` quando aplicável.

**Visibilidade conservadora:** camada adicional sobre RBAC, implementada via View Models por papel-consultante (ADR-T-0010). Resumo: `getCurrentUser()` retorna papéis e permissões; chamadas de leitura de dados de outra Pessoa passam por funções `viewXForY(personId)` que produzem o subconjunto de campos permitido por papel + ação afirmativa.

**Não-uso de RLS:** **mantemos a decisão de não habilitar RLS** em nenhuma tabela operacional. Justificativa reforçada no Portal MVP:
- Catálogo de visibilidade (ADR-0017 de negócio) tem combinatória complexa entre papel-consultante × papel-consultado × ação afirmativa. Expressar isso em policies SQL inflaria o schema com regras pouco revisáveis.
- Prisma + Transaction Pooler usa role único da aplicação — RLS via JWT impersonation tem atrito significativo nesse setup.
- Auditabilidade em TypeScript é superior para o time da Bravi e para revisão de PR.

### Opção C — Supabase Auth + RLS

Descartada pelos mesmos motivos da versão anterior, agora com mais peso por causa da combinatória de visibilidade do Portal.

## Decisão

Adotamos a **Opção B — Supabase Auth + RBAC aplicacional + visibilidade conservadora via View Models, sem RLS**.

**Componentes concretos:**

1. **Tabela `persons`** com:
   - `id` (UUID), `full_name`, `cpf` (nullable se exceção AS), `cpf_exception_justification` (texto), `email_login` (nullable se sem credencial)
   - `supabase_user_id` (UUID, nullable — vinculado quando há credencial)
   - `must_change_password`, `is_active`, `created_by_person_id` (rastreia se foi auto-cadastro ou cadastro AS)

2. **Tabela `person_role_grants`** (uma linha por papel ativo):
   - `id`, `person_id`, `role` (enum: VOLUNTEER, COORDINATOR, SOCIAL_ASSISTANT, BOARD, CANDIDATE, PROVIDER, CLIENT, COMPANY_RESPONSIBLE, BENEFICIARY_RELEASE2)
   - `status` (ACTIVE, REVOKED, AWAITING_CONSENT), `activated_at`, `revoked_at`, `revoked_by_person_id`
   - Detalhamento estrutural no ADR-T-0008

3. **Tabela `delegated_permissions`** (mesma da Frente 4, com catálogo do Portal):
   - Permissões específicas do Portal: `MODERATE_JOB`, `MODERATE_CV`, `MODERATE_SERVICE`, `VALIDATE_COMPANY_FIRST_JOB`, `INACTIVATE_PUBLISHED_CONTENT`, `REFER_PERSON_TO_JOB`, `APPROVE_CATEGORY_SUGGESTION`, `REGISTER_REFERRAL_RESULT`, `APPROVE_CREDENTIAL_CLAIM`
   - Permissões do Release 2 (Frente 4) entram quando esse release for retomado

4. **Tabela `auth_attempts`** — sem mudança em relação à Frente 4.

5. **CAPTCHA** — provedor escolhido no ADR-T-0014 (Cloudflare Turnstile). Server Action de auto-cadastro chama `verifyCaptcha(token)` antes de qualquer outra validação.

6. **Helpers transversais** (em `src/modules/identity/`):
   - `getCurrentUser()` — retorna Pessoa tipada com papéis ativos + permissões delegadas + sessão "atuar como"
   - `requirePermission(action, context)` — verifica papel + permissão + área quando aplicável
   - `requireRole(role)` — checagem direta de papel
   - `viewPersonAs(viewerRole, targetPersonId)` — entry point para View Models de visibilidade (ADR-T-0010)
   - `setActingAsCompany(companyId)` / `clearActingAsCompany()` — toggle de sessão (ADR-T-0015)

## Consequências

**Positivas:**
- Pessoa unificada com papéis compostos modelada de forma explícita, audit-friendly e testável
- Auto-cadastro público integrado a CAPTCHA reduz risco de spam
- Pessoa sem credencial é cidadão de primeira classe do sistema (referenciável em encaminhamentos, ficha social) sem violar regras de auth
- Empresa sem login mantém rastreabilidade individual (Pessoa-responsável sempre identificada no log)
- Visibilidade conservadora reside em código revisável e testável

**Negativas (trade-offs aceitos):**
- Custo cognitivo maior — desenvolvedor precisa entender que `getCurrentUser()` retorna estrutura rica com papéis ativos, permissões delegadas e contexto "atuar como"
- Bypass acidental de `requirePermission` ou de `viewXAs` continua sendo possível — mitigação pela convenção rígida no project-guideline + revisão de PR + lint custom planejado
- Reivindicação de credencial (USP-003) é fluxo manual com dependência operacional — exige clareza no runbook

**Neutras / a monitorar:**
- Volume previsto de Pessoas (200-500 candidatos + 100-300 outros no primeiro ano) está dentro do Free tier do Supabase Auth (50k MAU)
- Se um dia houver requisito de multi-tenancy (vários ASONSEGs no mesmo sistema), RLS volta a ser candidato

## Implicações em outros ADRs

- **ADR-T-0008 (Pessoa unificada + papéis compostos)** — define a estrutura detalhada de `persons` e `person_role_grants`
- **ADR-T-0010 (Visibilidade conservadora)** — define os View Models por papel-consultante
- **ADR-T-0014 (CAPTCHA)** — Cloudflare Turnstile como provedor
- **ADR-T-0015 (Empresa sem login, toggle "atuar como")** — define o mecanismo de sessão
- **ADR-T-0009 (Consentimentos por finalidade)** — depende de Pessoa para vincular consentimento

## Referências

- PRD MVP Portal §6.3 (Segurança), USP-001 a USP-008 (Identidade)
- ADR-0011 de negócio (Pessoa como entidade fundamental)
- ADR-0013 de negócio (Consentimentos LGPD por finalidade)
- ADR-0014 de negócio (Empresa sem login)
- ADR-0017 de negócio (Visibilidade conservadora)
- Lentes do arquiteto: Acoplamento & Coesão, Simplicidade, Observability by Design
