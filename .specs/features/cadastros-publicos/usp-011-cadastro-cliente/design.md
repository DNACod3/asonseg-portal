# USP-011 — Cadastro de cliente de serviço (papel) — Design

> **Modo ICE — adaptador.** O design resolve para ADR-0008/0011/0013/0020/0023 + TD §2.2/§4.4/§4.5/§4.6.
> **Padrão de referência:** `src/modules/identity/actions/activate-additional-role.ts` (USP-006) — `ensureClientRole`
> é a extração do corpo da transação dele, parametrizada para CLIENT/SERVICE_HIRING e **recebendo `tx`** (sem abrir
> a própria), para composição atômica dentro da USP-033 (ADR-0020).

## 1. Schema — `ClientProfile` (TD §2.2, ADR-0008) — verbatim

```prisma
model ClientProfile {
  personId  String   @id @map("person_id") @db.Uuid
  cityId    String?  @map("city_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  person    Person   @relation(fields: [personId], references: [id])
  @@map("client_profiles")
}
```

- Relação reversa em `Person`: `clientProfile ClientProfile?` (TD §2.1 / ADR-0008 linha 89).
- **`cityId` é coluna UUID nullable SEM FK** — não existe model `City` no schema. Fiel à TD (só a relação `person`).
  Se/quando `City` existir, a FK é aditiva (outra US). **Não** criar `City` aqui.
- Perfil **leve**: sem `publicationStatus`/moderação (diferente de Candidate/Provider). CLIENT não passa por moderação (ADR-0011).

## 2. Helper de ativação — `ensureClientRole`

**Contrato (recomendado):** recebe `tx` + dados do termo já validados pelo chamador.

```ts
// src/modules/persons/actions/ensure-client-role.ts  (NÃO é 'use server' isolado — é helper de transação)
export async function ensureClientRole(
  tx: Prisma.TransactionClient,
  args: { personId: string; term: { version: string; hash: string }; ip: string | null; userAgent: string | null },
): Promise<{ activated: boolean; grantId: string }>;
```

> **Q-aberta de design — RESOLVIDA (2026-07-08, reconciliação Fase 4).** A implementação de #120 **adotou a
> assinatura rica recomendada**: `ensureClientRole(tx, { personId, term: { version, hash }, ip, userAgent })`
> → `{ activated, grantId }`. O helper **não** reabre `loadTerm`/`headers()` (o chamador USP-033 já carrega o termo
> para exibir — E-001), satisfazendo P-001 (consentimento com versão/hash/IP **na mesma transação**) sem acoplar o
> helper ao request. Exportado no barrel `@/modules/persons` (`ensureClientRole` + tipos `EnsureClientRoleArgs`/`EnsureClientRoleResult`).
> A assinatura mínima `(tx, personId)` grafada na issue foi **descartada**. Nenhuma pendência com Tech Lead.

**Lógica (idempotente, dentro da `tx` do chamador):**

1. Releitura defensiva: grant `CLIENT` já `ACTIVE` para `personId`? → **no-op** (`activated: false`), sem duplicar nada (E-002 / CAD idempotência / AC #118-3).
2. Senão: reaproveita grant pendente/inativo ou cria novo em `AWAITING_CONSENT` (espelha `activate-additional-role.ts:146-157`).
3. **P-001:** persiste `Consent` da finalidade `SERVICE_HIRING` (com `termVersion`/`termContentHash` do servidor + `acceptedIp`/`userAgent`) se não houver ativo; idem garantir `PORTAL_ACCESS` ativo (vem do cadastro base — em geral já existe). Reaproveita consent ativo via índice parcial único.
4. **upsert `ClientProfile`** por `personId` (idempotente; `cityId` opcional).
5. Promove o grant a `ACTIVE` **só após** o consent persistido (ADR-0020 / P-001).
6. Emite `CLIENT_ROLE_ACTIVATED` **apenas quando houver ativação real** (passo 2/5 executados); o `CONSENT_GRANTED` é emitido junto da criação do consent (espelha `activate-additional-role.ts:181-192`).

**Regra pura (domínio):** `src/modules/persons/domain/client.ts`
- `decideClientActivation(currentRoles: Role[]): { needsActivation: boolean }` — `needsActivation = !currentRoles.includes('CLIENT')`.
- Sem IO; testável isoladamente (decisão de idempotência).

## 3. Evento de auditoria

Adicionar ao catálogo fechado (ADR-0023): `src/modules/audit/events.ts`
```ts
CLIENT_ROLE_ACTIVATED: 'CLIENT_ROLE_ACTIVATED',
```
(irmão de `CANDIDATE_ROLE_ACTIVATED` / `PROVIDER_ROLE_ACTIVATED`).

## 4. Mapa de reúso (não recriar)

| Precisa | Reusar | Onde |
|---|---|---|
| Pessoa autenticada da sessão (chamador) | `getCurrentPerson` | `@/modules/identity` |
| Papel↔finalidade | `ROLE_PURPOSE_MAP` / `PURPOSE_ROLE_MAP` | `@/modules/identity`, `@/modules/consents` |
| Termo server-side | `loadTerm` (no chamador USP-033) | `@/modules/consents` |
| Consent ativo / criação | índice parcial `consents_active_purpose_unique` + padrão de `activate-additional-role` | `prisma`, `@/modules/consents` |
| Transação + auditoria (no chamador) | `withAudit` | `@/modules/audit` |
| `ActionResult` (no chamador) | `ok`/`fail` | `@/shared/errors` |
| Lógica de grant/consent verbatim | corpo de `activateAdditionalRole` (linhas 128-218) | `identity/actions/activate-additional-role.ts` |

## 5. Diferenças vs. Candidate/Provider (USP-009/010)

- **Sem formulário/UI próprios** e **sem Server Action standalone** — é um **helper de `tx`** composto pela USP-033.
- **Sem `publicationStatus`/moderação** no perfil.
- Ativação **automática** (no 1º interesse), não por tela dedicada.

## 6. Rastreabilidade (AC → artefato)

| AC / expectativa | Onde se verifica |
|---|---|
| AC #118-1 (ativa sem formulário) | `ensureClientRole` (#120) — sem input de perfil obrigatório |
| AC #118-2 (consent `PORTAL_ACCESS` + `SERVICE_HIRING`) | passo 3 do helper (#120) |
| AC #118-3 / E-002 (idempotência) | passo 1 + `domain/client.ts` (#120) |
| P-001 (consent na mesma tx) | passos 3+5, ordem garantida (#120) |
| P-003 (precisa logar) | chamador USP-033 (`getCurrentPerson`) — fora desta US |
| schema `client_profiles` | model + migration (#119) |
