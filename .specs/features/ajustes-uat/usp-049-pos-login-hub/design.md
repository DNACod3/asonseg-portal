# USP-049 — Pós-login hub/redirects/perfil/logout — Design

**Spec**: `.specs/features/ajustes-uat/usp-049-pos-login-hub/spec.md`
**Status**: Draft

> **Decisões de projeto ativas conformadas (STATE.md `## Decisions`).** AD-025 (localização de componente de
> rota em `_components/` privado do grupo, `src/` fechado a `app/`+`modules/`+`shared/`, tokens-only, sem lib
> de estado/ícone), AD-022 (padrão **composition-root**: a página compõe guards/reads de vários módulos; o
> módulo não importa barrels de outros em runtime), AD-014 (Design System). Nada aqui **supersede** uma AD —
> tudo conforma. ADR-0030 (`requireActivePerson`/`getCurrentPerson` como resolução canônica de sessão) e a
> regra de privacidade do CLAUDE.md (acesso direto ao Prisma só para dados **próprios**) governam o `/perfil`.

---

## Architecture Overview

Quatro entregas, três módulos tocados (`identity`, `persons`) + duas páginas de rota. Nenhuma é escrita de
domínio nova; nenhuma migração. O **núcleo testável é puro** (`buildHubLinks`, `maskCpf`,
`registrationNextStep`); as páginas são **composition-roots** (ADR-0030 / AD-022) que resolvem sessão + guards
e passam dados prontos aos componentes de apresentação.

```mermaid
graph TD
    Login[login.ts / changePassword.ts] -->|redirectTo '/inicio' (já correto)| Inicio
    subgraph app_group["(app) — requireActivePerson no layout"]
      Inicio["/inicio/page.tsx (hub, composition-root)"]
      Perfil["/perfil/page.tsx (self, composition-root)"]
    end
    Inicio -->|person.roles + canAccessModerationQueue| Build[buildHubLinks - PURO]
    Build --> Cards[HubLinkCard - apresentação, tokens-only]
    Inicio --> SignOut[SignOutForm]
    Perfil --> Self[viewPersonForSelf]
    Self --> Mask[maskCpf - PURO]
    Perfil --> Labels[ROLE_LABELS]
    Perfil --> SignOut
    SignOut -->|action| SignOutAction[signOutAction -> supabase.auth.signOut -> /login]
    Cadastro[cadastro/page.tsx] -->|REGISTRATION_NEXT_STEP| Consent[cadastro/consentimento/page.tsx]
    Consent -->|POST_AUTH_FALLBACK '/inicio'| Inicio
```

**Fluxo do hub (composition-root):** `requireActivePerson()` → deriva `HubAccess` (flags) a partir de
`person.roles` (predicados puros = mesmos role-sets dos guards das rotas) **+** `await canAccessModerationQueue(person)`
para o flag de moderação → `buildHubLinks(access)` (puro) → renderiza cartões + `<SignOutForm/>`.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `requireActivePerson()` / `CurrentPerson.roles` | `@/modules/identity` (`identity/server/session.ts`) | Gate + fonte dos papéis ativos do hub e do `/perfil`. `/inicio` e `/perfil` chamam sem `allowFirstAccess` (herdam o redirect a `/trocar-senha` no 1º acesso — HUB-07). |
| `canAccessModerationQueue(person)` | `@/modules/moderation` (`moderation/server/moderation-access.ts`) | Flag ao vivo do link `/moderacao` (COORDINATOR inerente **ou** VOLUNTEER com delegação `MODERATE_*`). |
| Role-set guards puros: `canRegisterAssisted`, `canApproveCredentialClaim`, `isCoordinator`, `hasInactivationPrivilege` | `@/modules/identity` (`domain/assisted-registration.ts`, `domain/credential-claim.ts`, `domain/permissions.ts`) | Predicados dos flags institucionais do hub (subconjunto seguro por papel inerente). |
| `canViewOperationalReports`, `canViewSocialReports` | `@/modules/reporting` (`domain/report-access.ts`) | Flag do link `/relatorios`. |
| `canReferPersonToJob` inerente = roles ∩ {COORDINATOR, SOCIAL_ASSISTANT} | (predicado local, espelha `REFER_PERSON_TO_JOB` do `ROLE_PERMISSIONS`) | Flag de `/encaminhamentos/novo`. Usa role-set inerente (subconjunto seguro; delegação a voluntário é edge fora do MVP do hub). |
| `supabase.auth.signOut()` via `createSupabaseServerClient()` | `@/shared/lib/supabase/server` (template: `identity/actions/reset-password.ts:97`) | Corpo do `signOutAction`. |
| `getCurrentPerson()` | `@/modules/identity` | Gate de sessão do `signOutAction` (satisfaz o guard estático H3). |
| DS primitives `Card`, `Button` (`asChild`), `Badge`, `FormHeader`, `StepIcon` | `@/shared/ui` | Compor cartões de link (Card + `Button asChild` → `<a>`/Link), cabeçalho, badges de papel. Tokens-only. |
| `cpfSchema` / normalização de CPF | `@/modules/identity` (`schemas/registerPerson.ts`) | Referência do formato de CPF (11 dígitos) que `maskCpf` recebe. |
| `<form action={serverAction}>` como Server Component | precedente `cadastro/consentimento/page.tsx:128` | `SignOutForm` é Server Component (sem `'use client'`): form + `Button` submit chamando `signOutAction`. |
| Mapa PT-BR de papéis (referência) | `pessoas/[id]/page.tsx:17` (inline) | Fonte dos rótulos; recriado como `ROLE_LABELS` canônico em `identity/domain` (consolidação → USP-059). |

### Integration Points

| System | Integration Method |
| --- | --- |
| Middleware Edge | `PROTECTED_PREFIXES` **já contém `/inicio`** e `/perfil` (`middleware.ts:86-95`) — **nenhuma mudança**; a rota nova cai no gate existente. |
| `login.ts` / `changePassword.ts` | **Intocados** — já redirecionam a `/inicio` (fixado por testes). O defeito ORQ-1 é a rota ausente. |
| Prisma | Só leitura de dados **próprios** em `viewPersonForSelf` (`person.findUnique` por id da sessão + `roleGrants ACTIVE`). Sem migração. |

---

## Components

### `buildHubLinks` (núcleo puro)
- **Purpose**: Dado um `HubAccess` (flags booleanos), retorna a lista ordenada de grupos/links do hub —
  garantindo que todo href pertence à allowlist de rotas existentes.
- **Location**: `src/modules/identity/domain/hub-links.ts` (+ export no barrel `identity/index.ts`)
- **Interfaces**:
  - `interface HubAccess { candidate: boolean; provider: boolean; companyResponsible: boolean; moderation: boolean; referral: boolean; assistedRegistration: boolean; credentialClaim: boolean; reports: boolean; permissions: boolean }`
  - `interface HubLink { href: string; label: string; description: string }`
  - `interface HubLinkGroup { title: string; links: HubLink[] }`
  - `const EXISTING_HUB_ROUTES: readonly string[]` — allowlist (sensor de HUB-MN-01)
  - `buildHubLinks(access: HubAccess): HubLinkGroup[]` — pura, sem IO. Sempre inclui o grupo "Minha conta"
    (`/perfil`, `/perfil/papeis`, `/consentimentos`).
  - `hubAccessFromRoles(roles: string[]): Omit<HubAccess,'moderation'>` — predicados puros de papel inerente
    (a página adiciona `moderation` via guard ao vivo).
- **Dependencies**: nenhuma (strings + role-sets). **Reuses**: role-sets já definidos nos módulos (valores
  espelhados como constantes locais para não puxar runtime; ver Tech Decisions).

### `HubPage` (`/inicio`)
- **Purpose**: Página de destino pós-login; composition-root que resolve acesso e renderiza o hub.
- **Location**: `src/app/(app)/inicio/page.tsx` (`export const dynamic = 'force-dynamic'`)
- **Interfaces**: `export default async function HubPage()` — `requireActivePerson()` →
  `hubAccessFromRoles(person.roles)` + `moderation: await canAccessModerationQueue(person)` →
  `buildHubLinks(...)` → render cartões + `<SignOutForm/>`.
- **Dependencies**: `@/modules/identity` (session, buildHubLinks), `@/modules/moderation` (guard), `@/shared/ui`.
- **Reuses**: DS primitives; padrão de página `force-dynamic` das demais rotas `(app)`.

### `HubLinkCard` / seção de cartões (apresentação)
- **Purpose**: Renderiza um `HubLink` como cartão clicável, tokens-only.
- **Location**: `src/app/(app)/inicio/_components/hub-link-card.tsx` (pasta privada do grupo — AD-025)
- **Interfaces**: `function HubLinkCard({ link }: { link: HubLink })` — `Card` + `Button asChild`/`<a>`.
- **Dependencies**: `@/shared/ui`. **Reuses**: `Card`, `Button`.

### `SignOutForm` (logout)
- **Purpose**: Botão "Sair" que submete `signOutAction`.
- **Location**: `src/modules/identity/components/SignOutForm.tsx` (+ barrel)
- **Interfaces**: `function SignOutForm()` — Server Component: `<form action={signOutAction}><Button variant="outline">Sair</Button></form>`.
- **Dependencies**: `signOutAction`, `@/shared/ui`. **Reuses**: `Button`, padrão `<form action={serverAction}>`.

### `signOutAction`
- **Purpose**: Encerrar a sessão no provedor e redirecionar a `/login`.
- **Location**: `src/modules/identity/actions/signOut.ts` (+ barrel `signOutAction`)
- **Interfaces**: `export async function signOutAction(): Promise<void>` — `'use server'`;
  `await getCurrentPerson()` (gate H3) → `createSupabaseServerClient()` → `supabase.auth.signOut()` →
  `redirect('/login')`. Idempotente (sem sessão → redireciona mesmo assim).
- **Dependencies**: `@/modules/identity` (session), `@/shared/lib/supabase/server`, `next/navigation`.
- **Reuses**: template `reset-password.ts:97`.

### `viewPersonForSelf` (View Model do titular)
- **Purpose**: Projeção dos dados do **próprio** titular para a tela `/perfil`.
- **Location**: `src/modules/persons/views/view-person-for-self.ts` (+ barrel `persons/index.ts`)
- **Interfaces**:
  - `interface SelfProfileView { fullName: string; emailLogin: string; cpfMasked: string; roles: string[] }`
  - `async function viewPersonForSelf(personId: string): Promise<SelfProfileView | null>` —
    `prisma.person.findUnique({ where: { id: personId }, select: { fullName, emailLogin, cpf, roleGrants: { where: { status: 'ACTIVE' }, select: { role }, take: 50 } } })`; aplica `maskCpf(cpf)`.
- **Dependencies**: `prisma`, `maskCpf`. **Reuses**: padrão de select de `getCurrentPerson`/`viewPersonForStaff`.
- **Privacidade**: só recebe o id da sessão (PERFIL-MN-01); dados próprios ⇒ Prisma direto permitido.

### `maskCpf` (núcleo puro)
- **Purpose**: Mascarar CPF revelando só os 2 últimos dígitos.
- **Location**: `src/modules/persons/domain/cpf-mask.ts` (+ barrel)
- **Interfaces**: `maskCpf(cpf: string): string` — 11 dígitos → `***.***.***-NN` (usa os 2 finais); entrada
  malformada → retorna máscara neutra `***.***.***-**` (nunca vaza dígitos).
- **Dependencies**: nenhuma. **Reuses**: — (novo; precedente de formatador `companies/domain/cnpj.ts`).

### `PerfilPage` (`/perfil`)
- **Purpose**: Tela mínima real do titular.
- **Location**: `src/app/(app)/perfil/page.tsx` (substitui o placeholder; `dynamic = 'force-dynamic'`)
- **Interfaces**: `export default async function PerfilPage()` — `requireActivePerson()` →
  `viewPersonForSelf(person.id)` → render (nome, e-mail, CPF mascarado, papéis via `ROLE_LABELS`) + atalhos
  `/perfil/papeis`, `/consentimentos` + `<SignOutForm/>`.
- **Dependencies**: `@/modules/identity` (session, ROLE_LABELS), `@/modules/persons` (viewPersonForSelf), `@/shared/ui`.

### `ROLE_LABELS` (rótulos PT-BR canônicos)
- **Purpose**: Mapa `Record<string,string>` de papel → rótulo PT-BR.
- **Location**: `src/modules/identity/domain/roles.ts` (+ barrel)
- **Reuses**: valores idênticos ao mapa inline de `pessoas/[id]/page.tsx` (consolidação → USP-059).

### Redirect fixes (AUTH-1)
- **`REGISTRATION_NEXT_STEP` / `registrationNextStep(role)` / `POST_AUTH_FALLBACK`**
  - **Location**: `src/modules/identity/domain/role-activation.ts` (junto do `ROLE_NEXT_STEP` existente) (+ barrel)
  - **Interfaces**: `const REGISTRATION_NEXT_STEP: Record<PublicRole,string> = { CANDIDATE:'/candidato', PROVIDER:'/prestador', CLIENT:'/inicio' }`; `registrationNextStep(role: string): string` (fallback `POST_AUTH_FALLBACK`); `const POST_AUTH_FALLBACK = '/inicio'`.
- **`cadastro/page.tsx`**: remove o `NEXT_STEP_BY_ROLE` bugado; usa `registrationNextStep(result.role)`.
- **`cadastro/consentimento/page.tsx`**: `safeRedirect(next, POST_AUTH_FALLBACK)` e `<a href={POST_AUTH_FALLBACK}>Aceitar depois</a>`.

---

## Data Models (if applicable)

Nenhum model/migração novo. Só leitura de colunas existentes de `Person` (`fullName`, `emailLogin`, `cpf`) e
`PersonRoleGrant` (`role`, `status`) — schema.prisma inalterado.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Pessoa em 1º acesso em `/inicio` ou `/perfil` | `requireActivePerson()` redireciona a `/trocar-senha` | Levada à troca de senha (esperado). |
| Sessão inexistente/expirada em `signOutAction` | `getCurrentPerson()` → `null`; ainda `redirect('/login')` | "Sair" nunca erra; leva ao login. |
| `viewPersonForSelf` não encontra a Pessoa (corrida rara) | Retorna `null`; a página trata (a sessão já garantiu Pessoa ativa; fallback defensivo → mensagem/`notFound`) | Improvável; nunca vaza dados de terceiros. |
| `next` de consentimento ausente/externo | `safeRedirect` cai em `POST_AUTH_FALLBACK` | Aterrissa no hub. |
| Papel sem área correspondente | `buildHubLinks` inclui só links pessoais | Hub não-vazio. |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Divergência de allowlist se rotas `(app)` mudarem no futuro | `identity/domain/hub-links.ts` (`EXISTING_HUB_ROUTES`) | Link poderia apontar a rota removida → 404 | Teste HUB-MN-01 falha se um href sair da allowlist; a allowlist é a especificação única do sensor. Comentário aponta a fonte (rotas de `src/app/(app)`). |
| Guard estático H3 (Fase 6) exige gate em toda `'use server'` action | `identity/actions/signOut.ts` | Build/guard falha se `signOutAction` não tiver gate | `signOutAction` chama `getCurrentPerson()` antes do sign-out (gate presente e idempotente). |
| `canAccessModerationQueue` é async e bate no DB no hot path do hub | `inicio/page.tsx` | 1 query extra por render do hub | Hub é `force-dynamic`, baixo tráfego, autenticado; 1 guarded query é aceitável (precedente: guards de rota já fazem isso). Demais flags são puros (sem DB). |
| Duplicação de role-sets/labels entre módulos e o hub | `identity/domain/*` | Deriva de rótulos/permissões | Espelhamento consciente (evita runtime cross-module); consolidação de labels agendada na USP-059; predicados de acesso reusam os guards reais onde já expostos por barrel. |
| `COMPANY_RESPONSIBLE` pode não ser `roleGrant` ativo em todos os fluxos | `hub-links.ts` | Link de empresa não aparece p/ alguns responsáveis | Falha **segura** (ausência de link, não 404). Gestão de empresa existente é H-3/Fase 9 (fora de escopo). |

> Nenhuma outra fragilidade/PII/perf encontrada nas áreas tocadas além das acima.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Onde vive o catálogo de links do hub | `identity/domain/hub-links.ts` (puro) + página compõe | `identity` é dono de sessão/papéis; o catálogo é dado estático (strings + labels). Núcleo puro = HUB-MN-01/02 verificáveis sem render. |
| Visibilidade de `/moderacao` | Guard **ao vivo** `canAccessModerationQueue`; demais flags por papel inerente | Acesso do voluntário é **só por delegação**; sem o guard ao vivo o hub do voluntário ficaria vazio. Garante `shown ⟺ accessible` onde importa. |
| `signOutAction` sem auditoria | Só `signOut()` + `redirect` | Sem `AuditEvent` no catálogo; logout não é escrita de domínio; adicionar evento = escopo/arquitetura (proibido na Fase 8). Deferível. |
| CPF mascarado (2 dígitos) para o titular | `maskCpf` revela só os finais | Público em computador compartilhado (anti shoulder-surfing); resolve o "?" do dossiê por padrão conservador. |
| Corrigir AUTH-1 extraindo `REGISTRATION_NEXT_STEP` para `identity/domain` (não reusar `ROLE_NEXT_STEP`) | Novo mapa testável, distinto | `ROLE_NEXT_STEP` é do fluxo de **papel adicional** (USP-006, aponta tudo a `/perfil`); o cadastro inicial (E-002) quer o próximo passo do papel (`/candidato`,`/prestador`). Extrair torna o fix testável e mata o mapa bugado inline. |
| `SignOutForm` como Server Component | `<form action={signOutAction}>` sem `'use client'` | Precedente do consentimento; nenhum estado client necessário; menos superfície. |

> **Project-level decisions:** Esta USP estabelece o **primeiro destino autenticado (hub `/inicio`)**, o padrão
> **self View Model do titular** (`viewPersonForSelf`) e o **logout**. Se o Verifier passar, o orquestrador
> pode registrar um **AD-NNN** em `.specs/STATE.md` (padrão AD-022/AD-025) — o Planner não edita STATE.md.
</content>
