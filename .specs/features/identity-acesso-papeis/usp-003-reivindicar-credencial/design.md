# USP-003 Reivindicar credencial - Refactor (Fase 1) Design

**Spec**: `.specs/features/identity-acesso-papeis/usp-003-reivindicar-credencial/spec.md`
**Status**: Draft

> **Fontes da verdade upstream (adaptar, não re-derivar):**
> - Design System: `.specs/features/fundacao-ui-design-system/design.md` + barrel `src/shared/ui/index.ts` (**AD-014**, STATE.md).
> - Linguagem visual: protótipo `docs/prototipo/index.html` - estilos `.form-card`/`.form-header`/`.step-icon`/`.card` (L521-559). Estas telas **não existem** no protótipo: aplica-se a **linguagem** (mesmos primitivos/tokens do cadastro/login já restilizados), não uma cópia 1:1.
> - Fluxo e invariantes: épico `.specs/features/identity-acesso-papeis/spec.md` (IDN-07..08); ADR-0014 (CAPTCHA fail-closed); ADR-0021 (unicidade); `domain/credential-claim.ts` (política de aprovador).
> - Padrão de restyle já mergeado: `src/modules/identity/components/RegisterPersonForm.tsx` + `src/app/(auth)/cadastro/page.tsx` (AD-014) - **modelo a seguir**.
>
> **Decisões ativas de STATE.md `## Decisions`:** AD-014 (DS) e AD-013 (precedente ad-hoc / carve-out client-server) são os constraints. Nenhuma decisão ativa conflita com este design; ele **conforma** ao AD-014 e não supersede nada.

---

## Architecture Overview

Uma única frente sobre código já entregue: **apresentação (só estilo)** em 4 arquivos. Nenhum modelo de
dados, schema Prisma, Server Action, query, navegação, metadata ou cache muda. A decisão de estilo de autz
é **documental** (não gera task).

```mermaid
graph TD
    subgraph Public[Público (auth)]
      PP[reivindicar-credencial/page.tsx<br/>StepIcon(blue)+FormHeader+FormCard]
      PF[credential-claim-form.tsx<br/>Label/Input/Button + select-token + CAPTCHA preservado]
      PF -->|dentro do FormCard| PP
    end
    subgraph Internal[Interno (app)]
      IP[credenciais/reivindicacoes/page.tsx<br/>StepIcon(orange)+FormHeader]
      IR[credential-claim-review.tsx<br/>Card/tokens + select-token + Button]
      IR -->|dentro da página| IP
    end
    UI[(src/shared/ui barrel<br/>AD-014)]
    UI --> PP & PF & IP & IR
    subgraph Doc[Decisão documental - sem task]
      D[Autz do aprovador: manter inline<br/>getCurrentPerson + canApproveCredentialClaim]
    end
```

**Princípio:** troca-se **apenas marcação/classe**. Nenhum handler, schema, action, query, navegação,
metadata ou cache é tocado. Os gates de aprovador (rota `(app)` + action `verifyCredentialClaim`) e o gate
CAPTCHA permanecem byte-a-byte iguais.

---

## Decisão de consistência: estilo de autz do aprovador (documental)

**Decisão: manter a checagem de aprovador inline em `verifyCredentialClaim` (não migrar para `requirePermission`).**

Análise (evidência no código):

- `verifyCredentialClaim` (`actions/verify-credential-claim.ts:66-80`) faz `getCurrentPerson()` +
  `canApproveCredentialClaim(operator.roles)` e retorna `FORBIDDEN` para papéis não-aprovadores. É o
  passo 2 da sequência canônica (project-guideline §9), só que **inline**.
- `requirePermission(permission: PermissionId)` (`server/require-permission.ts:21-57`) recebe um
  `PermissionId` do **catálogo de permissões delegáveis** e avalia `checkPermission` (papel inerente +
  **delegação** explícita, ADR-0001/0030). Não existe `PermissionId` "aprovar reivindicação de credencial":
  o `domain/credential-claim.ts` documenta que, "enquanto o RBAC delegado da USP-008 não existe, esta lista
  [`CREDENTIAL_CLAIM_APPROVER_ROLES`] é a fonte de verdade da permissão deste fluxo (mesmo padrão de
  `ASSISTED_REGISTRATION_ROLES`)".
- Portanto o gate é de **papel institucional inerente** (`SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`), da mesma
  família de `requireCoordinator` (`server/require-permission.ts:68-77`) - que **deliberadamente** não passa
  pelo catálogo de `PermissionId`, porque "gerir delegações é prerrogativa de papel, não uma permissão
  delegável". A autz de aprovar reivindicação é do mesmo tipo.
- Migrar para `requirePermission` **não é um mapeamento limpo**: exigiria (a) inventar um `PermissionId` no
  enum Prisma, (b) alterar `checkPermission` para tratar os 3 papéis como concessão inerente, e (c) uma
  migração. Isso é **mudança de comportamento** (toca autz), **fora do escopo style-only** desta rodada, e
  **sem ganho de correção**: o gate atual não é enfraquecível (rota `(app)` + action repetem a checagem -
  defesa em profundidade / P-005) e é testado por `credential-claim.test.ts`/`.int.test.ts`.

Alternativa considerada e **não** planejada nesta rodada: extrair um helper irmão
`requireCredentialClaimApprover()` em `server/require-permission.ts` (espelhando `requireCoordinator`) para
centralizar a sequência inline. É uma melhoria de coesão válida, mas toca o cabeamento da action (não é
style-only) e não é necessária; fica registrada como **ideia diferida**, não como task.

> Registrada como decisão de consistência (não é AD nova - conforma ao padrão de papel inerente já vigente).
> Sinalizada no relatório do Planner para o gate humano/orquestrador. O Planner não edita STATE.md no
> pipeline autônomo.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| Primitivos DS | `src/shared/ui/index.ts` | `Label`, `Input`, `Button`, `FormHeader`, `StepIcon`, `FormCard`, `Card` - importar via barrel `@/shared/ui`. |
| Padrão de restyle do cadastro público | `src/modules/identity/components/RegisterPersonForm.tsx`, `src/app/(auth)/cadastro/page.tsx` | Modelo verbatim de tokens: `Label`+`Input`, `Button variant="primary" size="lg" className="w-full"`, caixa de erro danger-token, texto `text-fg-muted`, link `text-primary hover:underline`, página `StepIcon`+`FormHeader`+`FormCard`. |
| Classe-token do `<select>` | `src/shared/ui/input.tsx:14-16` | Espelhar no `<select>` nativo (meio de verificação) no form público e na fila. |
| `Card` | `src/shared/ui/card.tsx` (barrel) | Item da fila (`CredentialClaimReview`) e estado vazio: superfície+borda+shadow via primitivo em vez de `bg-white`/`border-gray-*`. |
| Teste RTL existente | `src/modules/identity/__tests__/CredentialClaimForms.test.tsx` | Manter os 9 casos verdes (5 form + 4 review); estender se necessário mantendo asserções. |

### Integration Points

| System | Integration Method |
| --- | --- |
| App Router `(auth)` / `(app)` | Rotas já `force-dynamic`; restyle não altera cache/metadata/gate. |
| `react-hook-form` | `Input` encaminha `ref`/props → `register()` continua funcionando sem mudança. |
| `@marsidev/react-turnstile` | O widget e o `<input type="hidden">` do `captchaToken` são preservados; só o container muda de classe. |
| Vitest (jsdom) | RTL dos Client Components em `npm run test`; páginas validadas por `npm run build`. |

---

## Components

### `CredentialClaimForm` (restyle - Client Component, público)
- **Purpose**: formulário público de solicitação restilizado; comportamento intacto.
- **Location**: `src/modules/identity/components/credential-claim-form.tsx`
- **Interfaces**: props inalteradas (`siteKey`). Remover `const inputClass` cru; `<label>`→`Label`,
  `<input>`→`Input`, `<button>`→`Button variant="primary" size="lg" className="w-full"`; `<select>` de
  meio de verificação restilizado com a classe-token; texto intro `text-fg-muted`; caixa de sucesso
  `success`; caixa de erro do servidor `danger`; CAPTCHA `<input type="hidden">` + `Turnstile` preservados.
- **Preserva (must-not U3-MN-01/02):** o gate `if (!captchaToken) { setServerError(...); return; }`; a
  render de `role="status"` com a `message` genérica do servidor (sem ramo por existência); textos
  "Solicitar reivindicação"/"Enviando…", labels de CPF/identificador/e-mail/meio.

### `reivindicar-credencial/page.tsx` (restyle - Server Component, público)
- **Purpose**: casca pública com header/ícone/card.
- **Location**: `src/app/(auth)/reivindicar-credencial/page.tsx`
- **Interfaces**: `<StepIcon variant="blue">{keyIcon}</StepIcon>` + `<FormHeader title="Reivindicar
  credencial" description="..." />` + `<FormCard>` ao redor do `CredentialClaimForm`; link "Entrar" com
  `text-primary` (em vez de `text-blue-600`).
- **Preserva**: `dynamic='force-dynamic'`, o `env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, a natureza pública da rota.

### `CredentialClaimReview` (restyle - Client Component, interno)
- **Purpose**: fila interna de verificação restilizada; comportamento intacto.
- **Location**: `src/modules/identity/components/credential-claim-review.tsx`
- **Interfaces**: props inalteradas (`items`). Remover `const selectClass` cru; item `<li>` como `Card`
  (surface+border) em vez de `bg-white`/`border-gray-*`/`shadow-sm`; `<select>` de meio utilizado com a
  classe-token; `<button>`→`Button variant="primary"`; estado vazio com `Card`/tokens `text-fg-muted`;
  erro `role="alert"` com `text-danger`.
- **Preserva (must-not U3-MN-03):** `onConfirm` (chama `verifyCredentialClaim({ claimId, verificationMethod })`),
  a remoção do item em sucesso (`setClaims(filter)`), a manutenção em erro, o `role="status"` do estado
  vazio; textos "Confirmar e ativar"/"Ativando…", labels "Meio de verificação utilizado".

### `credenciais/reivindicacoes/page.tsx` (restyle - Server Component, interno)
- **Purpose**: casca interna com header/ícone.
- **Location**: `src/app/(app)/credenciais/reivindicacoes/page.tsx`
- **Interfaces**: `<StepIcon variant="orange">{reviewIcon}</StepIcon>` + `<FormHeader title="Reivindicações
  de credencial" description="..." />` ao redor do `CredentialClaimReview`; nota com `text-fg-muted`.
- **Preserva**: o gate de aprovador (`requireActivePerson` + `canApproveCredentialClaim` → `notFound`),
  `listPendingCredentialClaims`, `formatSaoPaulo`, `dynamic='force-dynamic'`. **Nenhuma** mudança nesses.

---

## Data Models

N/A - nenhum modelo de dados, migração Prisma, Server Action ou query é criado ou alterado. O restyle é
puramente de apresentação.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Submit sem CAPTCHA resolvido | gate client (`setServerError`) + fail-closed server (já existe) | Mensagem "Complete o desafio CAPTCHA..."; sem submit. |
| E-mail em uso / conflito | caixa `role="alert"` com token danger (padrão existente) | Mensagem do servidor; sucesso não exibido. |
| Corrida de aprovação (concorrência) | tratada na action (`updateMany` count===0); UI mantém o item e exibe erro | Mensagem "Esta solicitação já foi processada."; item permanece na fila. |
| Classe de token conflita no `cn`/tailwind-merge | resolvido pelo merge (última vence) | Estilo previsível. |
| `localStorage`/tema indisponível | coberto pela fundação (ThemeScript try/catch) | Sem FOUC; segue `prefers-color-scheme`. |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Form e review compartilham `CredentialClaimForms.test.tsx` | `__tests__/CredentialClaimForms.test.tsx` | Duas tasks editando o mesmo arquivo de teste podem conflitar | T1 (form) e T3 (review) são **sequenciais** (T3 após T1); cada uma mantém verdes as asserções da outra. |
| `<select>` localizado por `getByLabelText`/`fireEvent.change` nos testes | `CredentialClaimForms.test.tsx:53,149` | Trocar por primitivo custom quebraria as queries | `<select>` fica nativo restilizado com tokens; associação `<label htmlFor>` preservada. |
| Restyle toca módulo `identity` já entregue | `credential-claim-form.tsx`, `credential-claim-review.tsx`, páginas | Regressão de fluxo público/interno | Só marcação/estilo; 9 testes RTL existentes seguem verdes; asserções de must-not (U3-MN-01/02/03) já cobertas pelos casos existentes. |
| CAPTCHA fail-closed é o único anti-bot da porta pública | `credential-claim-form.tsx:47-50` | Restyle acidentalmente remover o gate | T1 preserva o `if (!captchaToken)`; teste "sem CAPTCHA → não chama a action" trava (U3-MN-01). |

> Nenhum outro concern relevante encontrado nos arquivos tocados.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Autz do aprovador | Manter inline (`getCurrentPerson` + `canApproveCredentialClaim`) | Gate de papel inerente (família `requireCoordinator`/`ASSISTED_REGISTRATION_ROLES`); `requirePermission` exige `PermissionId`+`checkPermission` (mudança de comportamento, fora do style-only). |
| `<select>` sem primitivo | Nativo restilizado com classe-token espelhando `Input` | DS não tem Select; preserva `getByLabelText`/`onChange`; usa tokens. |
| Item/estado vazio da fila | `Card` do barrel + tokens | Substitui `bg-white`/`border-gray-*` por primitivo/tokens; paridade DS. |
| Ícones das páginas | `blue` (chave) na pública; `orange` (checklist) na interna; SVG inline | Linguagem: identidade=blue, fila operacional=orange; sem `lucide-react`. |
| Tasks separadas para form e review, sequenciais | T1 → T3 (mesmo arquivo de teste) | Atomicidade por componente sem conflito de edição no teste compartilhado. |

> **Nenhuma decisão nova de projeto (AD-NNN) criada pelo Planner.** Este design conforma a AD-014 e ao
> padrão de autz por papel inerente já vigente. A decisão de autz e a ideia diferida
> (`requireCredentialClaimApprover`) são registradas aqui e sinalizadas no relatório.

---

## Tips aplicadas
- Reuse é rei: `RegisterPersonForm`/`cadastro/page.tsx` são o gabarito de restyle; `Card` reusado; nada reinventado.
- Interfaces first: o restyle não muda assinaturas nem props; só marcação/classe.
- Escopo travado: uma frente só (estilo); a decisão de autz é documental, não uma task.
