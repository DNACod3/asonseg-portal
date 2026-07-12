# USP-053 — Cascata de revogação de JOB_APPLICATION (Design)

> Design auto-suficiente. Ancorado em código existente (paths+linhas verificados no HEAD da branch
> `feat/fase-8-remediacao-uat`). **Sem migração. Sem dependência nova.** Reusa a mecânica da USP-026 e o
> seam de container (precedente `COMPANY_RESPONSIBILITY_TOKEN`).

## 1. Âncoras de código

| Peça | Arquivo | Nota |
| --- | --- | --- |
| Ponto de entrada da revogação | `src/modules/consents/actions/revoke-consent.ts` | tx `withAudit(CONSENT_REVOKED)`; hoje só cascateia o papel (`:82-134`) |
| Matriz declarativa (política) | `src/modules/consents/domain/revocation-cascade.ts:111-134` | `JOB_APPLICATION` → ENCERRAR+MARCAR / OCULTAR / MANTER |
| Papel da finalidade | `src/modules/consents/domain/purpose-role-map.ts:19-28` | `JOB_APPLICATION → 'CANDIDATE'` |
| Mecânica de cancelamento (USP-026) | `src/modules/jobs/actions/cancel-application.ts:62-79` | `updateMany where cancelledAt:null` otimista + `APPLICATION_CANCELLED` |
| Model `Application` | `prisma/schema.prisma:533-559` | colunas: `id, candidatePersonId, jobId, cancelledAt, appliedAt, viaEncaminhamento, viaReferralId` — **sem** coluna de motivo/status |
| Busca ativa (realiza o OCULTAR) | `src/modules/persons/queries/search-candidates.ts:42-66,111-124` | `WHERE cp.publication_status='ACTIVE' AND p.status='ATIVO'` (raw SQL) |
| Model `CandidateProfile` + enum | `prisma/schema.prisma:708-738` (`publicationStatus ContentStatus`) + `690-702` (enum) | valores não-ACTIVE (inclui `PAUSED`) já são não-listáveis |
| Escrita direta de status (precedente) | `src/modules/persons/actions/activate-candidate-role.ts:100-116` | escreve `publicationStatus` direto; sem guard proibindo |
| Auditoria secundária in-tx | `src/modules/audit/withAudit.ts:94-136` (`recordAuditEvent`) · precedente `src/modules/referrals/actions/create-referral.ts:166` | emite evento no mesmo tx sem abrir outra transação |
| Seam de port (precedente exato) | `src/modules/persons/ports/companyResponsibility.ts`, `src/shared/container.ts:15,26,32,59,131` | `createToken` + `container.resolve`; deep-imports no container "para evitar dependência circular" |

## 2. Visão geral da solução

Três camadas, todas dentro da **única** transação `withAudit(CONSENT_REVOKED)` do `revokeConsent`:

```
revokeConsent(JOB_APPLICATION)              [consents/actions/revoke-consent.ts]
  └─ withAudit(CONSENT_REVOKED, async (tx, audit) => {
       tx.consent.updateMany(...)           ── (já existe) revoga o consentimento vigente
       tx.personRoleGrant.updateMany(...)   ── (já existe) cascateia CANDIDATE → REVOKED
       recordAuditEvent(ROLE_GRANT_REVOKED) ── (já existe)

       if (purpose === 'JOB_APPLICATION' && revoked.count > 0) {      ← NOVO (A-6)
         const applier = container.resolve(REVOCATION_EFFECTS_TOKEN)  ← seam sem ciclo (A-5)
         const outcome = await applier.applyJobApplicationCascade(tx, ctx)
         audit.after = { …, applicationsEnded, profileHidden }        ← A-7
       }
     })
```

O **adapter** ligado no container compõe dois **participantes de tx**, cada um no módulo dono do dado:

```
DefaultRevocationEffects.applyJobApplicationCascade(tx, ctx)   [ligado em shared/container.ts]
  ├─ jobs:    endJobApplicationsForRevocation(tx, ctx)   → { endedCount, endedApplicationIds }
  └─ persons: hideCandidateProfileForRevocation(tx, ctx)  → { hidden: boolean }
```

**Por que este seam (A-5):** `jobs→consents` e `persons→consents` já existem; importar o inverso pelos
barrels arriscaria ciclo (o repo é sensível a ciclo de barrel). O container resolve por token, com
deep-imports no `container.ts` (feito exatamente "para evitar dependência circular", `container.ts:59`),
espelhando `COMPANY_RESPONSIBILITY_TOKEN`. Bônus: o unit test do `revokeConsent` mocka o applier
(`container.register(REVOCATION_EFFECTS_TOKEN, () => fake)`), mantendo o teste isolado do DB.

## 3. Componentes

### 3.1 Port + token (módulo `consents`)

Novo arquivo `src/modules/consents/ports/revocation-effects.ts` (folha, só tipos + `createToken`):

```ts
import type { Prisma } from '@prisma/client';
import { createToken } from '@/shared/container';

/** tx interativa da revogação (mesma de withAudit). */
export type RevocationTx = Prisma.TransactionClient;

export interface RevocationEffectsContext {
  personId: string;
  actorPersonId: string;
  ip: string | null;
  userAgent: string | null;
  justification: string;
}

export interface JobApplicationCascadeOutcome {
  applicationsEnded: number;
  endedApplicationIds: string[];
  profileHidden: boolean;
}

export interface RevocationEffectsPort {
  applyJobApplicationCascade(
    tx: RevocationTx,
    ctx: RevocationEffectsContext,
  ): Promise<JobApplicationCascadeOutcome>;
}

export const REVOCATION_EFFECTS_TOKEN = createToken<RevocationEffectsPort>(
  'consents.RevocationEffects',
);
```

> **Contrato-guarda (T6):** um teste de domínio afirma que `revocationCascadeFor('JOB_APPLICATION').artifactEffects`
> continua declarando `candidaturas-ativas → [ENCERRAR, MARCAR]` e `perfil-candidato-visivel-empregadores → [OCULTAR]`.
> Isso amarra a implementação à política declarada (se a matriz mudar, o teste avisa) sem os participantes lerem
> a matriz em runtime (mantidos simples).

### 3.2 Participante em `jobs` — ENCERRAR + MARCAR (reusa USP-026)

Novo `src/modules/jobs/actions/end-job-applications-for-revocation.ts`, exportado no barrel `jobs/index.ts`.
**Não abre transação** — recebe o `tx` (padrão `createReferralApplication`).

```ts
// pseudo — assinatura e mecânica
export async function endJobApplicationsForRevocation(
  tx: Prisma.TransactionClient,
  ctx: { personId; actorPersonId; ip; userAgent; justification },
): Promise<{ endedCount: number; endedApplicationIds: string[] }> {
  const active = await tx.application.findMany({
    where: { candidatePersonId: ctx.personId, cancelledAt: null },
    select: { id: true },
  });
  const cancelledAt = new Date();
  const endedApplicationIds: string[] = [];
  for (const { id } of active) {
    // guarda otimista idêntica à USP-026 → concorrência com cancel avulso: 1 só vence (E3/MN-01)
    const res = await tx.application.updateMany({
      where: { id, cancelledAt: null },
      data: { cancelledAt },
    });
    if (res.count === 1) {
      endedApplicationIds.push(id);
      await recordAuditEvent(tx, AuditEvent.APPLICATION_CANCELLED, {
        entityType: 'APPLICATION',
        entityId: id,
        before: { cancelledAt: null },
        // MARCAR (A-1): a "flag histórica" vive no evento append-only, sem coluna nova
        after: { cancelledAt: cancelledAt.toISOString(), via: 'consent_revoke',
                 reason: 'retirada por revogação de consentimento JOB_APPLICATION' },
        justification: ctx.justification,
      }, { actorPersonId: ctx.actorPersonId, ip: ctx.ip, userAgent: ctx.userAgent });
    }
  }
  return { endedCount: endedApplicationIds.length, endedApplicationIds };
}
```

- **ENCERRAR** = `cancelledAt` (soft-cancel, USP-026). **MARCAR** = o `APPLICATION_CANCELLED` per-linha com
  `after.via='consent_revoke'` (A-1). `APPLICATION_CANCELLED` **não** exige justification (`events.ts`), mas
  passamos a da revogação por rastreabilidade.
- Escopo por `candidatePersonId = ctx.personId` (MN-05). Bulk por titular, todas as vagas (E4/MN-01).
- Preserva o invariante da USP-026 ("1 `APPLICATION_CANCELLED` por candidatura", concorrência via guarda
  otimista — E3). Nenhuma deleção (MN-03).

### 3.3 Participante em `persons` — OCULTAR

Novo `src/modules/persons/actions/hide-candidate-profile-for-revocation.ts`, exportado no barrel. Recebe `tx`.

```ts
export async function hideCandidateProfileForRevocation(
  tx: Prisma.TransactionClient,
  ctx: { personId },
): Promise<{ hidden: boolean }> {
  const res = await tx.candidateProfile.updateMany({
    where: { personId: ctx.personId, publicationStatus: 'ACTIVE' },  // só ACTIVE (E2/A-2)
    data: { publicationStatus: 'PAUSED', lastStatusChangeAt: new Date() }, // A-3
  });
  return { hidden: res.count > 0 };
}
```

- `ACTIVE→PAUSED` (A-2/A-3): a busca já exclui não-ACTIVE → OCULTAR sem tocar `search-candidates`. Perfil
  não-ACTIVE ou ausente → no-op (E2). Escopo por `personId` (MN-05). Só muda `publicationStatus`/`lastStatusChangeAt`
  — demais campos preservados (MN-03). Escrita direta consistente com `activate-candidate-role.ts` (A-4).
- **Não** roteia por `transitionContent` (A-4: não aninhável na tx; `PAUSED` via FSM inalcançável p/ CANDIDATE_PROFILE).

### 3.4 Adapter no composition-root

Em `src/shared/container.ts` (deep-imports, como já se faz):

```ts
import { REVOCATION_EFFECTS_TOKEN } from '@/modules/consents/ports/revocation-effects';
import { endJobApplicationsForRevocation } from '@/modules/jobs/actions/end-job-applications-for-revocation';
import { hideCandidateProfileForRevocation } from '@/modules/persons/actions/hide-candidate-profile-for-revocation';

container.register(REVOCATION_EFFECTS_TOKEN, () => ({
  async applyJobApplicationCascade(tx, ctx) {
    const ended  = await endJobApplicationsForRevocation(tx, ctx);
    const hidden = await hideCandidateProfileForRevocation(tx, { personId: ctx.personId });
    return { applicationsEnded: ended.endedCount, endedApplicationIds: ended.endedApplicationIds,
             profileHidden: hidden.hidden };
  },
}));
```

### 3.5 Alteração em `revoke-consent.ts` (wiring — mínima, aditiva)

Dentro do callback de `withAudit`, **após** a cascata de papel existente (`revoke-consent.ts:120`), antes de
setar `audit.after`:

```ts
let applicationsEnded = 0, profileHidden = false;
if (purpose === 'JOB_APPLICATION' && revoked.count > 0) {   // A-6 / MN-06
  const applier = container.resolve(REVOCATION_EFFECTS_TOKEN);
  const outcome = await applier.applyJobApplicationCascade(tx, {
    personId: person.id, actorPersonId: person.id, ip, userAgent, justification,
  });
  applicationsEnded = outcome.applicationsEnded;
  profileHidden = outcome.profileHidden;
}
audit.after = { purpose, consentsRevoked: revoked.count, roleRevoked, applicationsEnded, profileHidden }; // A-7
```

- Roda **na mesma tx** → atomicidade grátis: qualquer throw dos participantes rejeita a `$transaction` e
  desfaz consent+papel+candidaturas+perfil (MN-04). O `try/catch` externo já retorna `fail('INTERNAL', …)`.
- `RevokeConsentResult` **pode** ganhar `applicationsEnded?`/`profileHidden?` (opcionais, aditivo) — decisão do
  Implementer; não é exigido pela UI (o painel só precisa do `ok`).
- Fora de `JOB_APPLICATION`, nada muda (MN-06). Idempotência/`NOT_FOUND`/`UNAUTHENTICATED` intocados (USP053-05):
  a pré-checagem `revoke-consent.ts:60-75` continua barrando o no-op antes de abrir a tx.

## 4. Fluxo (sequência)

```
Titular → revokeConsent({purpose:'JOB_APPLICATION'})
  pré-check: consentimento vigente? não → alreadyRevoked/NOT_FOUND (sem tx)      [USP053-05]
  withAudit(CONSENT_REVOKED) {
    consent.updateMany(revokedAt, revokedReason)
    personRoleGrant.updateMany(CANDIDATE ACTIVE → REVOKED) + ROLE_GRANT_REVOKED
    applier.applyJobApplicationCascade(tx):
       jobs:    findMany(active) → per-id updateMany(cancelledAt) + APPLICATION_CANCELLED(via) [01/MN-01]
       persons: updateMany(ACTIVE→PAUSED)                                                       [02/MN-02]
    audit.after = {…, applicationsEnded, profileHidden}                                          [03/A-7]
  }  ← commit atômico; qualquer erro → rollback total                                            [04/MN-04]
Efeito on-read: searchCandidates deixa de retornar o titular (publicationStatus≠ACTIVE)          [02]
```

## 5. Estratégia de teste (facts por AC → materializados na fase Tasks via skill-tdad)

| Fact | Tipo | Cobre |
| --- | --- | --- |
| `hide-candidate-profile-for-revocation.int` — ACTIVE→PAUSED; não-ACTIVE/ausente = no-op; outra Pessoa intocada; campos preservados | int (DB) | USP053-02, E2, MN-02, MN-03, MN-05 |
| `end-job-applications-for-revocation.int` — todas ativas encerradas (várias vagas); `cancelledAt` setado (não apagado); 1 `APPLICATION_CANCELLED` `via=consent_revoke` por linha; concorrência com cancel avulso = 1 evento; outra Pessoa intocada | int (DB) | USP053-01, E3, E4, MN-01, MN-03, MN-05 |
| `revoke-consent.test` (existente, **estendido**) — mocka `REVOCATION_EFFECTS_TOKEN`: applier **chamado** p/ JOB_APPLICATION; **não** chamado p/ outra finalidade; `after` inclui os novos campos; idempotência/NOT_FOUND/UNAUTH preservados | unit | USP053-05, MN-06, USP053-03 |
| `revoke-consent.int` (novo, DB) — fim-a-fim: candidaturas encerradas + perfil PAUSED + `searchCandidates` exclui + papel REVOKED + `after` correto, tudo atômico; injeção de falha no applier → rollback total (consent ainda ativo) | int (DB) | USP053-01..04, MN-01, MN-02, MN-04, MN-05 |
| `search-candidates.int` (existente) — **preservado**: prova que perfil PAUSED é excluído como DRAFT/IN_MODERATION | int (DB) | USP053-02 (reuso) |
| `revocation-cascade.contract.test` — matriz ainda declara ENCERRAR+MARCAR/OCULTAR p/ JOB_APPLICATION | unit | fidelidade à política (drift guard) |

**Sensor de discriminação (Verifier):** desligar o gate `purpose==='JOB_APPLICATION'` (MN-06), trocar
`ACTIVE→PAUSED` por no-op (MN-02), trocar `cancelledAt:null` por match-all/no-op (MN-01), remover o
`recordAuditEvent` (MARCAR), fazer o participante `throw` (MN-04) — cada mutação deve matar ≥1 fact.

## 6. Testes existentes a preservar (não enfraquecer)

- `src/modules/consents/__tests__/revoke-consent.test.ts` — mock de `tx` expõe só `consent/personRoleGrant/auditLog`;
  o applier é **mockado via container** (não passa pelo mock de `tx`), então os asserts de cascata de papel/idempotência
  seguem válidos. Estender (não substituir) as asserções de `after` e adicionar "applier chamado/não-chamado".
- `src/modules/consents/__tests__/revocation-cascade.test.ts` — invariantes da matriz. **Não** mudar a matriz.
- `src/modules/persons/__tests__/search-candidates.int.test.ts` — gate ACTIVE/ATIVO. Query **inalterada** (A-2) → segue verde.
- `src/modules/jobs/__tests__/cancel-application.int.test.ts` — mecânica USP-026 intocada (novo participante é caminho à parte).

## 7. Não-objetivos / decisões registradas

- **Zero migração** (A-1 MARCAR via audit; A-2/A-3 OCULTAR via enum existente `PAUSED`).
- **Sem dependência nova**; sem evento de catálogo novo (A-7 reusa `APPLICATION_CANCELLED` + `CONSENT_REVOKED.after`).
- **Arquitetura preservada:** append-only (ADR-0023), `withAudit`, View Models/ADR-0010 (busca inalterada),
  ADR-0025 (mecanismo + cascata de papel), ADR-0008 (não-exclusão). O seam (port/container) **usa** a
  arquitetura de ports/adapters do CLAUDE.md, não a altera.
- **Nada para a Fase 9:** todos os efeitos declarados são implementáveis pela letra da política sem decisão
  nova de produto. Única flag opcional ao DPO (não bloqueia): se exigirem flag estrutural de "retirada por
  revogação" **na linha** de `applications`, isso é migração → Fase 9; hoje o MARCAR (flag histórica) é
  satisfeito pelo `audit_log`.
