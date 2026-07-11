# USP-049 — Pós-login: hub `/inicio`, redirects corrigidos, `/perfil` real, logout — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Esta unidade é uma **remediação de UAT** (Fase 8). Cada
> requisito está ancorado num achado do dossiê `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`
> (tabela "Fase 8"), que por sua vez ancora em AC/spec/PRD. Os IDs de achado — **ORQ-1, AUTH-1, AUTH-3,
> AUTH-4** — são **canônicos** aqui; os IDs locais (`HUB-*`, `REDIR-*`, `PERFIL-*`, `LOGOUT-*`) cobrem só o
> detalhe testável que o dossiê não enumera. Não se re-derivam requisitos de outras USPs — as specs vizinhas
> (USP-004 login → destino `/inicio`; USP-001 E-002 → próximo passo por papel; USP-006 → ativar papel) são
> referenciadas, não copiadas.

## Problem Statement

Todo usuário que faz login (ou troca a senha no 1º acesso) é redirecionado a **`/inicio`**, uma rota que
**nunca foi criada** por nenhuma USP → **404 pós-login para todo perfil** (ORQ-1, P0). Além disso, o fim do
fluxo de cadastro redireciona a caminhos com prefixo `/app/` (route group, que **não vira URL**) e a rotas
inexistentes → 404 no fim da entrada (AUTH-1). Não existe **logout** em tela alguma (sessão de 12h sem
encerramento voluntário, público-alvo em computador compartilhado — AUTH-3), e **`/perfil`** é um placeholder
de dev — o titular não vê a própria PII em lugar nenhum (AUTH-4).

## Goals

- [ ] Criar a rota autenticada `(app)/inicio` — **hub mínimo data-driven pelos papéis ativos da Pessoa**,
      linkando **apenas** rotas que existem e às quais o papel dá acesso → **nenhum fluxo pós-login termina em
      404 ou beco sem saída** (ORQ-1).
- [ ] Corrigir os redirects de `cadastro/page.tsx` (`NEXT_STEP_BY_ROLE`) e `cadastro/consentimento/page.tsx`
      para **rotas reais** (sem prefixo `/app/`) (AUTH-1).
- [ ] Entregar uma **Server Action de logout** (Supabase `signOut`) + botão "Sair" no hub e no `/perfil`
      (AUTH-3).
- [ ] Substituir o placeholder de `/perfil` por uma **tela mínima real do titular** (View Model do próprio =
      viewer=self): nome, e-mail, CPF (mascarado), papéis ativos e links para `/perfil/papeis` e
      `/consentimentos` (AUTH-4).

## Out of Scope

Explicitamente excluído — documentado para evitar scope creep.

| Feature | Reason |
| --- | --- |
| App-shell autenticado completo (header/nav global persistente em todas as rotas `(app)`) | **Fase 9 / H-3** (decisão PO+DPO). Esta unidade entrega só o **hub** `/inicio` como página de destino, não a casca global. |
| Busca/lista de Pessoas para a assistente social; navegação por nome/CPF | **Fase 9 / H-3** — envolve nota de privacidade ADR-0014; exige View Model de busca definido por PO+DPO. |
| Gestão de Empresa existente pelo responsável (listar/selecionar empresas por `empresaId`) | Não existe rota-índice `/empresa` (só `/empresa/cadastrar` e `/empresa/[empresaId]/…`). O gap de descoberta de empresa é **Fase 9 / H-3**. O hub só liga a `/empresa/cadastrar` (rota real). |
| Header público refletir sessão ("Entrar/Cadastrar" para logado) | **Fase 9 / H-4** (CASCA-MN-01, casca ISR sem sessão). Não se toca a casca pública `(public)`. |
| Auditoria do evento de logout (`AUTH_LOGOUT`) | Sem `AuditEvent` no catálogo; logout é término de sessão do provedor (sem escrita de domínio). Deferido — ver Assumptions. O log de auth do Supabase registra o sign-out. |
| Alterar `login.ts` / `changePassword.ts` | Os redirects a `/inicio` **já estão corretos** e são fixados por testes verdes; o defeito ORQ-1 é a **rota ausente**, não o destino. Não se toca essas actions. |
| Consolidar `ROLE_LABELS` duplicado em `pessoas/[id]/page.tsx` / consentimento | Consolidação de rótulos PT-BR é da **USP-059 (SOC-4)**. Aqui cria-se um mapa canônico novo e usa-se nas superfícies novas. |
| Mudança de arquitetura, schema/migração de DB, dependência nova | Premissa inviolável da Fase 8: correção de fluxo sem alterar arquitetura/premissas técnicas. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Destino pós-cadastro por papel (AUTH-1): `CANDIDATE → /candidato`, `PROVIDER → /prestador`, `CLIENT → /inicio`, fallback → `/inicio`. | agent | Mapa `REGISTRATION_NEXT_STEP` corrige o `NEXT_STEP_BY_ROLE` bugado. | E-002 (USP-001) quer guiar ao "próximo passo" do papel: candidato/prestador completam o perfil em `/candidato`/`/prestador` (rotas reais); CLIENT não tem área de auto-serviço (USP-011, sem UI) → cai no hub. Todos os alvos existem e não têm prefixo `/app/`. Alinhado ao dossiê ("/candidato, /prestador, /perfil"). | y |
| Fallback de consentimento ("Aceitar depois" + `safeRedirect`) → `/inicio` (não `/app/perfil`). | agent | Constante `POST_AUTH_FALLBACK = '/inicio'`. | Quem se cadastra mas adia o aceite do papel ainda aterrissa num destino válido e role-aware (o hub). `/inicio` é o destino canônico pós-login (USP-004). | y |
| CPF do titular em `/perfil` é exibido **mascarado** (revela só os 2 últimos dígitos): `***.***.***-NN`. | agent | Novo util puro `maskCpf`. | O público-alvo usa **computador compartilhado** (mesma justificativa do logout, AUTH-3) → reduzir shoulder-surfing. O titular reconhece o próprio CPF pelos 2 dígitos finais. O "?" do dossiê ("CPF mascarado?") é resolvido por padrão conservador. | y |
| Visibilidade dos links do hub = **espelho do guard de cada rota**. Para rotas de papel inerente, predicado puro sobre `person.roles`; para **`/moderacao`**, o guard **ao vivo** `canAccessModerationQueue(person)` (inclui voluntário com delegação `MODERATE_*`). | agent | Página compõe os flags de acesso; `buildHubLinks` (puro) monta os links a partir dos flags. | Garante **shown ⟺ accessible** para `/moderacao` (exato) e **shown ⟹ accessible** (subconjunto seguro) para as demais → nenhum link leva a 403/notFound. O voluntário (persona cujo acesso é só por delegação) precisa do link de moderação no hub, senão seu hub fica vazio (smoke por perfil). Padrão composition-root (precedente visão-consolidada, AD-022). | y |
| Link de Empresa no hub para `COMPANY_RESPONSIBLE` → `/empresa/cadastrar` (única rota-índice existente). | agent | Rótulo "Empresas — cadastrar nova". | Não há rota-índice `/empresa`; gestão da empresa existente é H-3 (Fase 9). `/empresa/cadastrar` é rota real e ação legítima (registrar outra empresa). Se `COMPANY_RESPONSIBLE` não estiver em `roleGrants` ativo, o link simplesmente não aparece (falha segura). | y |
| Logout **não** grava evento de auditoria no MVP. | agent | `signOutAction` = gate de sessão + `supabase.auth.signOut()` + `redirect('/login')`. | Não existe `AUTH_LOGOUT` no catálogo; logout não é escrita de domínio (não entra na sequência de Server Action sensível). Adicionar evento seria escopo novo/arquitetural (proibido na Fase 8). Deferível como follow-up trivial. | y |
| `signOutAction` satisfaz o guard estático H3 (toda `'use server'` action exige gate) chamando `getCurrentPerson()` antes do sign-out; se `null`, ainda redireciona a `/login` (idempotente). | agent | — | O ator do logout está autenticado; resolver a sessão é o gate. Idempotência evita erro se a sessão já expirou. | y |
| Mapa canônico `ROLE_LABELS` (PT-BR) para o `/perfil` vive em `identity/domain`. | agent | Novo `identity/domain/roles.ts`. | Papéis são conceito de `identity`. Duplicação com o mapa inline de `pessoas/[id]` é aceita e sinalizada para consolidação na USP-059. | y |
| `viewPersonForSelf` lê os dados do **próprio** titular por `person.id` da sessão (acesso direto ao Prisma é permitido só para dados próprios — CLAUDE.md §Privacy). | agent | Novo `persons/views/view-person-for-self.ts`. | Não existe View Model self; os existentes (staff/employer/search) removem CPF/e-mail estruturalmente. O titular pode ver os próprios dados. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Hub `/inicio` — destino pós-login role-aware, sem 404/beco ⭐ MVP

**User Story**: Como Pessoa autenticada, quero aterrissar numa página inicial que me mostre atalhos válidos
para as áreas que meu papel me permite usar, para que eu nunca caia num 404 depois de entrar.

**Why P1**: Fecha o **P0 do UAT** (ORQ-1): hoje **todo** login termina em 404. É o destino que USP-004 e a
troca de senha do 1º acesso já apontam (`/inicio`) e que o middleware já protege.

**Acceptance Criteria**:

1. QUANDO uma Pessoa ativa (não em 1º acesso) acessa `/inicio` ENTÃO o sistema DEVE renderizar (HTTP 200) um
   hub com uma saudação usando `person.fullName` e a lista de atalhos aplicáveis — **sem 404** (HUB-01).
2. QUANDO o hub monta os atalhos ENTÃO o sistema DEVE incluir os **links pessoais fixos** — `/perfil`,
   `/perfil/papeis`, `/consentimentos` — para **qualquer** Pessoa ativa, inclusive uma sem papel público
   ativo (garante hub não-vazio / sem beco) (HUB-02).
3. QUANDO `person.roles` inclui `CANDIDATE` ENTÃO o hub DEVE exibir o atalho para `/candidato`; QUANDO inclui
   `PROVIDER` DEVE exibir `/prestador`, `/prestador/servicos` e `/prestador/manifestacoes`; QUANDO inclui
   `COMPANY_RESPONSIBLE` DEVE exibir `/empresa/cadastrar` (HUB-03).
4. QUANDO a Pessoa tem acesso à fila de moderação (`canAccessModerationQueue` = COORDINATOR inerente **ou**
   VOLUNTEER com delegação `MODERATE_*`) ENTÃO o hub DEVE exibir o atalho para `/moderacao`; caso contrário
   NÃO deve exibi-lo (HUB-04).
5. QUANDO `person.roles` concede acesso inerente às áreas institucionais ENTÃO o hub DEVE exibir: `/relatorios`
   (COORDINATOR/BOARD/SOCIAL_ASSISTANT), `/encaminhamentos/novo` (COORDINATOR/SOCIAL_ASSISTANT),
   `/cadastro-assistido` (SOCIAL_ASSISTANT/BOARD), `/credenciais/reivindicacoes`
   (SOCIAL_ASSISTANT/BOARD/COORDINATOR), `/permissoes` (COORDINATOR) — cada um **só** para os papéis do seu
   guard (HUB-05).
6. QUANDO o hub é renderizado ENTÃO DEVE conter a opção de logout (`SignOutForm`, ver US4) (HUB-06).
7. QUANDO uma Pessoa **em 1º acesso** tenta `/inicio` ENTÃO o sistema DEVE redirecioná-la a `/trocar-senha`
   (comportamento herdado de `requireActivePerson()`, não reimplementado) (HUB-07).

**Independent Test**: `buildHubLinks` (unit) para cada combinação de flags produz o conjunto correto de hrefs,
todos ∈ allowlist de rotas existentes; page test de `/inicio` (mock `requireActivePerson` + `canAccessModerationQueue`)
renderiza os links do papel + logout; smoke manual por perfil do seed (candidato, prestador, AS, coordenador,
voluntário, diretoria) → login→`/inicio` sem 404.

---

### P1: Redirects de cadastro/consentimento para rotas reais

**User Story**: Como pessoa que acabou de se cadastrar, quero que o fim do fluxo me leve a uma página que
existe, para não terminar a entrada num 404.

**Why P1**: AUTH-1 (P1) — o prefixo `/app/` (route group) não vira URL e as rotas `/app/perfil/*/novo` nem
existem; o `next` bugado se propaga por toda a cadeia pós-consentimento.

**Acceptance Criteria**:

1. QUANDO o cadastro conclui para um papel ENTÃO o sistema DEVE redirecionar ao próximo passo real:
   `CANDIDATE → /candidato`, `PROVIDER → /prestador`, `CLIENT → /inicio`, e qualquer papel desconhecido →
   `/inicio` — **nenhum destino com prefixo `/app/`** (REDIR-01).
2. QUANDO o aceite de consentimento conclui com sucesso ENTÃO o sistema DEVE redirecionar ao `next` validado
   (rota real) e, na ausência de `next`, ao fallback `/inicio` (não `/app/perfil`) (REDIR-02).
3. QUANDO a página de consentimento oferece "Aceitar depois" ENTÃO o link DEVE apontar para `/inicio`
   (não `/app/perfil`) (REDIR-03).
4. QUANDO qualquer valor de próximo-passo é resolvido ENTÃO ele DEVE passar pelo `safeRedirect` existente
   (relativo interno) — comportamento anti-open-redirect preservado (REDIR-04).

**Independent Test**: unit de `REGISTRATION_NEXT_STEP`/`registrationNextStep(role)` e `POST_AUTH_FALLBACK`:
nenhum valor casa `/^\/app\//`, todos ∈ allowlist; casos por papel corretos. (As páginas consomem as
constantes testadas.)

---

### P2: `/perfil` real do titular (viewer=self)

**User Story**: Como titular, quero ver meus próprios dados básicos e papéis num só lugar, com atalhos para
gerenciar papéis e consentimentos, para ter controle da minha conta.

**Why P2**: AUTH-4 (P2) — hoje `/perfil` é placeholder de dev; o titular não vê a própria PII em lugar nenhum.

**Acceptance Criteria**:

1. QUANDO o titular acessa `/perfil` ENTÃO o sistema DEVE exibir **seus próprios** dados via View Model self:
   `fullName`, e-mail (`emailLogin`), **CPF mascarado** (`***.***.***-NN`) e os **papéis ativos** rotulados em
   PT-BR (PERFIL-01).
2. QUANDO o `/perfil` é renderizado ENTÃO DEVE conter atalhos para `/perfil/papeis` (ativar papel) e
   `/consentimentos` (gerenciar consentimentos) e a opção de logout (US4) (PERFIL-02).
3. QUANDO o View Model self resolve os papéis ENTÃO DEVE listar **apenas** os grants com `status = ACTIVE`
   (PERFIL-03).

**Independent Test**: unit de `maskCpf` (formato exato); unit/integração de `viewPersonForSelf` (retorna
nome/e-mail/CPF-mascarado/papéis-ativos do próprio id); page test de `/perfil` renderiza dados próprios +
links + logout.

---

### P2: Logout (Server Action `signOut` + botão "Sair")

**User Story**: Como usuário em computador compartilhado, quero um botão "Sair" que encerre minha sessão, para
que a próxima pessoa não use minha conta.

**Why P2**: AUTH-3 (P1→P2) — não existe logout em tela alguma; sessão de 12h sem encerramento voluntário.

**Acceptance Criteria**:

1. QUANDO o usuário aciona "Sair" ENTÃO o sistema DEVE encerrar a sessão no provedor
   (`supabase.auth.signOut()`) e redirecionar a `/login` (LOGOUT-01).
2. QUANDO `signOutAction` é chamada ENTÃO DEVE resolver a sessão (`getCurrentPerson()`) como gate antes do
   sign-out; se não houver sessão, ainda redireciona a `/login` (idempotente) (LOGOUT-02).
3. QUANDO o hub `/inicio` e a tela `/perfil` são renderizados ENTÃO ambos DEVEM apresentar o `SignOutForm`
   (botão "Sair") (LOGOUT-03).

**Independent Test**: unit de `signOutAction` (mock supabase/session): `signOut()` chamado e `redirect('/login')`;
caso sem sessão → ainda redireciona; component test de `SignOutForm` (form com `action` + botão "Sair").

---

## Edge Cases

- QUANDO uma Pessoa ativa **sem nenhum papel público/institucional** acessa `/inicio` ENTÃO o hub DEVE ainda
  renderizar os links pessoais fixos + logout (nunca vazio/404) — HUB-02.
- QUANDO a Pessoa está em 1º acesso ENTÃO `/inicio` e `/perfil` DEVEM redirecionar a `/trocar-senha`
  (`requireActivePerson()` sem `allowFirstAccess`).
- QUANDO a sessão expirou entre render e submit do "Sair" ENTÃO `signOutAction` DEVE redirecionar a `/login`
  sem erro (idempotência) — LOGOUT-02.
- QUANDO `next` do consentimento vem ausente/externo/`//…` ENTÃO `safeRedirect` DEVE cair no fallback
  `/inicio` (anti-open-redirect preservado) — REDIR-02/04.
- QUANDO um voluntário **sem** delegação de moderação acessa `/inicio` ENTÃO o hub NÃO deve exibir `/moderacao`
  (evita beco em `notFound()`) — HUB-04.

---

## Must-Nots (world-level prohibitions)

Cada must-not exige um teste negativo que assevera que o resultado proibido não ocorre (ver validate.md §6b).

| ID | QUANDO [contexto] ENTÃO o sistema NÃO DEVE… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| HUB-MN-01 | QUANDO `buildHubLinks` monta os atalhos, para **qualquer** combinação de acesso, ENTÃO NÃO DEVE produzir href fora da allowlist de rotas existentes — nunca um path com prefixo `/app/`, nem a rota-bare inexistente `/empresa` ou `/encaminhamentos`, nem `/pessoas`. | 404/beco pós-login (classe ORQ-1). | T2 | Unit: para todo subconjunto de flags, todo href ∈ `EXISTING_HUB_ROUTES`; nenhum casa `/^\/app\//`; `/empresa` bare, `/encaminhamentos` bare e `/pessoas` ausentes. |
| HUB-MN-02 | QUANDO a Pessoa não tem o papel/permissão do guard de uma área ENTÃO o hub NÃO DEVE exibir o link daquela área (nenhum link leva a 403/`notFound`). | Beco por privilégio / vazamento da superfície staff a papel público. | T2, T7 | Unit: `roles=[CANDIDATE]` ⇒ nenhum de {`/moderacao`,`/relatorios`,`/permissoes`,`/cadastro-assistido`,`/credenciais/reivindicacoes`,`/encaminhamentos/novo`}; `moderationAccess=false` ⇒ sem `/moderacao`. |
| PERFIL-MN-01 | QUANDO `/perfil` é renderizado ENTÃO NÃO DEVE exibir dados de outra Pessoa que não o titular autenticado (sem parâmetro/id de terceiro; `viewPersonForSelf` só pelo id da sessão). | Vazamento de PII / IDOR. | T5, T6 | Unit/integração: `viewPersonForSelf` consulta pelo id da sessão; a rota `/perfil` não aceita param de pessoa; render usa só dados do titular. |
| LOGOUT-MN-01 | QUANDO "Sair" é acionado ENTÃO o sistema NÃO DEVE prosseguir a navegação sem antes encerrar a sessão no provedor (`signOut()` chamado antes do `redirect`). | Sessão persistente após logout em computador compartilhado. | T4 | Unit: `signOutAction` — `supabase.auth.signOut` é invocado; sem ele, o teste falha; `redirect('/login')` ocorre depois. |
| REDIR-MN-01 | QUANDO o fluxo de cadastro/consentimento resolve um destino ENTÃO NÃO DEVE emitir um path com prefixo `/app/` nem uma rota inexistente. | 404 no fim da entrada (AUTH-1). | T3 | Unit: nenhum valor de `REGISTRATION_NEXT_STEP`/`POST_AUTH_FALLBACK` casa `/^\/app\//`; todos ∈ allowlist. |
| DS-MN-01 | QUANDO os componentes novos (`inicio`, `/perfil`, `SignOutForm`, cartões do hub) são estilizados ENTÃO NÃO DEVEM usar hex cru / paleta fixa — apenas tokens de `globals.css`. | Regressão do Design System (tokens-only). | T2, T5, T4 | Static scan: nenhum `#RRGGBB` / `bg-*-600` cru nos arquivos novos; só classes de token (`text-fg`, `bg-surface`, `text-primary`, …). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ORQ-1 (upstream, canônico) | P1 Hub | Tasks | Pending |
| AUTH-1 (upstream, canônico) | P1 Redirects | Tasks | Pending |
| AUTH-3 (upstream, canônico) | P2 Logout | Tasks | Pending |
| AUTH-4 (upstream, canônico) | P2 Perfil | Tasks | Pending |
| HUB-01..07 (local) | P1 Hub | Tasks | Pending |
| REDIR-01..04 (local) | P1 Redirects | Tasks | Pending |
| PERFIL-01..03 (local) | P2 Perfil | Tasks | Pending |
| LOGOUT-01..03 (local) | P2 Logout | Tasks | Pending |
| HUB-MN-01, HUB-MN-02 (local) | P1 Hub | Tasks | Pending |
| PERFIL-MN-01 (local) | P2 Perfil | Tasks | Pending |
| LOGOUT-MN-01 (local) | P2 Logout | Tasks | Pending |
| REDIR-MN-01 (local) | P1 Redirects | Tasks | Pending |
| DS-MN-01 (local) | P1/P2 (UI nova) | Tasks | Pending |

**ID format:** achados do dossiê são canônicos (ORQ-1/AUTH-1/AUTH-3/AUTH-4); locais em `[AREA]-NN` e must-nots
em `[AREA]-MN-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 4 upstream + 17 locais + 6 must-nots = 27 itens; todos mapeados a tasks em `tasks.md`.

---

## Success Criteria

- [ ] Login e troca de senha do 1º acesso terminam em `/inicio` **200** (não 404), em todos os perfis do seed.
- [ ] `buildHubLinks` nunca produz link para rota inexistente nem para área sem permissão (HUB-MN-01/02 verdes).
- [ ] Fim do cadastro (todos os papéis) e "Aceitar depois" aterrissam em rota real (REDIR-MN-01 verde).
- [ ] `/perfil` mostra nome + e-mail + CPF mascarado + papéis ativos do **próprio** titular + logout, sem
      vazar dados de terceiros (PERFIL-MN-01 verde).
- [ ] "Sair" encerra a sessão Supabase e leva a `/login` (LOGOUT-MN-01 verde).
- [ ] Gates verdes: typecheck, lint, unit (novos + os `/inicio`-redirect existentes intactos), build
      `NODE_ENV=production`; **zero migração, zero dependência nova**.
</content>
</invoke>
