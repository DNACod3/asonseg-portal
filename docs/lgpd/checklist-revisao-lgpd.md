# Checklist de revisão LGPD — go-live (USP-043)

> **Escopo:** revisão final de conformidade LGPD do Portal ASONSEG antes do go-live.
> Cobre o ciclo completo de consentimento por finalidade (registro → leitura →
> revogação granular com cascata) e o direito de acesso do titular (art. 19).
> **Não duplica regra de negócio:** cada item aponta para o ADR, o termo ou o
> código que é a fonte da verdade.
>
> **Origem:** USP-043 (#209), sub-task #214 · Requisitos LGP-04/05/06 ·
> Decisões D-001 (DPO) e D-002 (revisão jurídica dos termos).
> **Revisores:** DPO designada (diretora Angélica) + jurídico + Tech Lead.

---

## 0. Como usar este checklist

- Marque cada item apenas quando **verificado** (não quando "deveria estar ok").
- Itens com ⚠️ são **pendências bloqueantes de go-live** — ver §8.
- A semântica de negócio que ainda depende da DPO está marcada com 🔶 — exige
  decisão registrada antes de tratar o item como fechado.

### Mapa de ADRs (atenção à numeração divergente)

O projeto tem **dois conjuntos** de ADRs e a numeração não coincide entre eles.
Sempre que este checklist citar um ADR, vale a tabela abaixo:

| Tema | ADR técnico do repo (`docs/arch/`) | ADR de spec IDSD (`docs/IDSD/architecture/adrs/`) |
|---|---|---|
| Consentimento por finalidade + versionamento de termo | [ADR-0009](../arch/0009-consentimentos-lgpd-por-finalidade.md) | — |
| Auditoria append-only + hash de termo | [ADR-0004](../arch/0004-auditoria-imutavel-append-only.md) | [ADR-0023](../IDSD/architecture/adrs/0023-log-append-only-auditoria-e-consentimentos.md) |
| Cascata de revogação de consentimento | — | [ADR-0025](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md) |
| Expiração on-read / job agendado (retenção operacional) | — | [ADR-0026](../IDSD/architecture/adrs/0026-expiracao-on-read-e-job-agendado.md) |
| Pessoa unificada + papéis compostos (grant ↔ consentimento) | [ADR-0008](../arch/0008-pessoa-unificada-papeis-compostos.md) | — |
| Retenção indefinida + direito de acesso (tabela de decisão) | matriz-conexoes §ADRs (linha "ADR-0008") | — |

> A "ADR-0008 (retenção)" e "ADR-0013 (LGPD)" citadas no corpo das issues #209/#214
> referem-se à **tabela de decisão da matriz-conexoes** e aos **ADRs de negócio**,
> não aos arquivos técnicos de mesmo número no repo. Use sempre a tabela acima.

---

## 1. Bases legais e finalidades (LGPD art. 7º e art. 11)

Fonte: [`src/modules/consents/domain/purposes.ts`](../../src/modules/consents/domain/purposes.ts) ·
termos em [`legal/consent-terms/`](../../legal/consent-terms/README.md) ·
[ADR-0009](../arch/0009-consentimentos-lgpd-por-finalidade.md).

- [ ] As **8 finalidades** do MVP estão fechadas e cada uma tem base legal declarada:

  | # | `ConsentPurpose` | Base legal declarada | Termo |
  |---|---|---|---|
  | 1 | `PORTAL_ACCESS` | art. 7º, V (contrato) + art. 7º, I (consentimento) | [v1.0](../../legal/consent-terms/portal-access/v1.0.md) |
  | 2 | `JOB_APPLICATION` | art. 7º, I (consentimento) | [v1.0](../../legal/consent-terms/job-application/v1.0.md) |
  | 3 | `SERVICE_OFFERING` | art. 7º, I (consentimento) | [v1.0](../../legal/consent-terms/service-offering/v1.0.md) |
  | 4 | `SERVICE_HIRING` | art. 7º, I + art. 7º, V (contrato) | [v1.0](../../legal/consent-terms/service-hiring/v1.0.md) |
  | 5 | `COMPANY_REPRESENTATION` | art. 7º, I + art. 7º, IX (legítimo interesse) | [v1.0](../../legal/consent-terms/company-representation/v1.0.md) |
  | 6 | `SOCIAL_ASSISTANCE` | **art. 11, I (dado sensível)** | [v1.0](../../legal/consent-terms/social-assistance/v1.0.md) |
  | 7 | `CV_AI_EXTRACTION` | art. 7º, I (consentimento específico) | [v1.0](../../legal/consent-terms/cv-ai-extraction/v1.0.md) |
  | 8 | `SOCIAL_REFERRAL_TO_JOB` | art. 7º, I + art. 7º, IX | [v1.0](../../legal/consent-terms/social-referral-to-job/v1.0.md) |

- [ ] A finalidade **6 (`SOCIAL_ASSISTANCE`) trata dado sensível** e usa a base
      do **art. 11, I** (consentimento específico para dado sensível) — confirmado
      pela DPO que o termo é explícito sobre a sensibilidade.
- [ ] Conjunto é **fechado**: adicionar finalidade exige decisão de produto +
      revisão jurídica (P-008 das expectations). Não há finalidade "genérica".
- [ ] O painel apresenta **nome humano + descrição + base legal** de cada
      finalidade, nunca só o código (transparência — P-005, `PURPOSE_METADATA`).

## 2. Registro de consentimento (LGP-01 / LGP-02 / LGP-03)

Fonte: [`actions/grant-consent.ts`](../../src/modules/consents/actions/grant-consent.ts) ·
[`adapters/term-loader.ts`](../../src/modules/consents/adapters/term-loader.ts).

- [ ] Cada aceite grava `personId`, `purpose`, `termVersion`, `termContentHash`,
      `acceptedAt` (UTC), `acceptedIp` e `userAgent`.
- [ ] Aceite é **explícito** (sem pré-marcação de checkbox); um aceite por finalidade.
- [ ] O termo íntegro é exibido a partir de `legal/consent-terms/` antes do aceite.
- [ ] **Integridade por hash**: o aceite é **bloqueado** (`TERM_HASH_MISMATCH`) se o
      conteúdo do arquivo divergir do hash registrado da versão vigente
      (`TERMS_REGISTRY`). Verificado por teste de integridade.
- [ ] Toda gravação ocorre dentro de `withAudit('CONSENT_GRANTED', ...)`.

## 3. Guarda de finalidade — `requireActiveConsent` (LGP-03)

Fonte: [`server/require-active-consent.ts`](../../src/modules/consents/server/require-active-consent.ts) ·
runbook [runbook-consent-gate.md](../IDSD/architecture/runbooks/runbook-consent-gate.md).

- [ ] `requireActiveConsent(personId, purpose)` roda **após** a checagem de
      permissão e **antes** das pré-condições de negócio (sequência da Server Action).
- [ ] Consentimento ausente, de versão antiga ou revogado ⇒ `{ ok: false }`
      **sem efeito colateral**.

## 4. Painel do titular + revogação granular (LGP-04 / LGP-05)

Fonte: [`(app)/consentimentos/page.tsx`](<../../src/app/(app)/consentimentos/page.tsx>) ·
[`components/consents-panel.tsx`](../../src/modules/consents/components/consents-panel.tsx) ·
[`actions/revoke-consent.ts`](../../src/modules/consents/actions/revoke-consent.ts) ·
[`queries/list-own-consents.ts`](../../src/modules/consents/queries/list-own-consents.ts) ·
[ADR-0025](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md).

- [ ] O painel `(app)` (`force-dynamic`) lista consentimentos **vigentes e revogados**
      (com data de revogação) e oferta revogação por finalidade.
- [ ] A leitura retorna **apenas os consentimentos do próprio titular** autenticado
      (privacidade — isolamento por titular).
- [ ] Revogar preenche `revokedAt`/`revokedReason` no registro vigente.
- [ ] Revogar **cascateia** o `PersonRoleGrant` vinculado para `REVOKED`
      (preenchendo `revokedAt`) — matriz finalidade↔papel do [ADR-0025](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md).
- [ ] Revogar **preserva os dados de perfil** (sem exclusão) e **não afeta outras
      finalidades** (ADR-0008 / ADR-0009 — não-exclusão).
- [ ] Revogação é **idempotente**: finalidade já revogada ⇒ `ok` sem novo efeito de
      cascata e **sem** novo evento `CONSENT_REVOKED` espúrio no `audit_log`.
- [ ] `CONSENT_REVOKED` exige **justificativa** (`JUSTIFICATION_REQUIRED_EVENTS`),
      tudo em transação dentro de `withAudit('CONSENT_REVOKED', ...)`.
- [ ] Caso especial `PORTAL_ACCESS`: a cascata desativa a base de acesso **sem
      excluir** histórico institucional.
- [x] **Semântica da cascata sobre visibilidade** (dados já compartilhados / vínculos
      ativos) — **APROVADA (2026-06-03)** pela DPO + jurídico em
      [cascata-revogacao-semantica.md](cascata-revogacao-semantica.md) (adendo ao
      ADR-0025) e materializada em código em
      [`revocation-cascade.ts`](../../src/modules/consents/domain/revocation-cascade.ts).
      Resta a **aplicação** dos efeitos nos módulos consumidores (USPs de jobs/services/referrals).

## 5. Direito de acesso do titular — art. 19 (LGP-06)

Fonte: [`reporting/actions/access-report.ts`](../../src/modules/reporting/actions/access-report.ts) ·
[`views/access-report.view.ts`](../../src/modules/reporting/views/access-report.view.ts) ·
[ADR-0010](../arch/0010-visibilidade-conservadora-view-models.md).

- [ ] `issueAccessReport(personId)` consolida **dados pessoais + papéis +
      histórico completo de consentimentos** (finalidade, versão, aceite, revogação).
- [ ] A leitura cross-Pessoa passa por **View Model** (`viewPersonForAccessReport`),
      nunca Prisma direto na action (ADR-0010).
- [ ] Restrito a **papel interno autorizado** — `ACCESS_REPORT_ROLES`
      (`SOCIAL_ASSISTANT`, `BOARD`, `COORDINATOR`); solicitante sem papel ⇒
      `FORBIDDEN` **sem gerar relatório**.
- [ ] Sessão ausente ⇒ `UNAUTHENTICATED` sem efeito.
- [ ] A **emissão** (não a leitura) é registrada em `withAudit('ACCESS_REPORT_ISSUED', ...)`
      com `actorPersonId`, IP, user-agent e contagem de consentimentos/papéis.
- [ ] O fluxo viabiliza a entrega ao titular em **≤ 15 dias** (prazo operacional;
      o relatório é gerado sob demanda).
- ⚠️ A autorização é feita por **checagem inline de papel**, não pelo
      `requirePermission()` RBAC canônico — este só chega em **USP-007+**. Confirmar
      com a DPO que a checagem inline é suficiente para go-live (ver §8).
- ⚠️ **UI interna** para a equipe disparar o relatório está **fora do escopo da
      USP-043** (Server Action pronta). Definir como a equipe aciona o relatório no
      go-live (ex.: rota interna posterior ou execução assistida).

## 6. Auditoria append-only + retenção (ADR-0004 / IDSD ADR-0023; ADR-0026)

Fonte: [`audit/withAudit.ts`](../../src/modules/audit/withAudit.ts) ·
[`audit/events.ts`](../../src/modules/audit/events.ts) ·
[`audit/retention.ts`](../../src/modules/audit/retention.ts) ·
migration [`audit_log_append_only`](../../prisma/migrations/20260601142224_audit_log_append_only/migration.sql).

- [ ] `audit_log` é **append-only no nível do banco**: `UPDATE`/`DELETE` revogados
      por trigger; `DELETE` só é liberado sob a flag de sessão `app.audit_purge`.
- [ ] Eventos vêm do **catálogo fechado** `AuditEvent` (`@/modules/audit/events`) —
      nunca string solta. Eventos LGPD presentes: `CONSENT_GRANTED`, `CONSENT_REVOKED`,
      `ROLE_GRANT_REVOKED`, `ACCESS_REPORT_ISSUED`.
- [ ] Eventos que exigem justificativa (`JUSTIFICATION_REQUIRED_EVENTS`) incluem a
      revogação de consentimento.
- [ ] **Retenção do log**: `AUDIT_RETENTION_DAYS = 365`; job mensal
      `purgeExpiredAuditLogs` poda registros e grava `AUDIT_LOG_PURGED` (com job de
      infra rodando em role privilegiada — ver infra #205).
- [ ] **Dados pessoais nas tabelas operacionais** têm retenção **indefinida** (sem
      exclusão na revogação); apenas o `audit_log` é podado (ADR-0026 / decisão de
      retenção da matriz).

## 7. Termos versionados (D-002)

Fonte: [`legal/consent-terms/README.md`](../../legal/consent-terms/README.md).

- [ ] Um diretório por finalidade; um arquivo `vN.M.md` por versão; header YAML com
      `version`, `purpose`, `effective_date`, `legal_basis`, `status`.
- [ ] Termos aceitos são **imutáveis**: revisão cria **nova versão** (`vN+1`);
      consentimentos anteriores permanecem válidos na versão aceita.
- [ ] Troca de provedor de IA (finalidade 7) exige **nova versão + re-aceite**
      (ADR-0009 / ADR-0012).
- [x] **Os 8 termos v1.0 estão `status: aprovado`** — revisão jurídica (D-002)
      concluída em 2026-06-03. Hashes revalidados no `TERMS_REGISTRY` (teste de
      integridade verde). Ver registro em [dpo.md §5](dpo.md#5-registro-de-aprova%C3%A7%C3%B5es).

---

## 8. Pendências bloqueantes de go-live

| # | Pendência | Responsável | Status | Bloqueia |
|---|---|---|---|---|
| **D-002** | Revisão jurídica e aprovação dos **8 termos**. | Jurídico + DPO (Angélica) | ✅ **Resolvido (2026-06-03)** — 8 termos `aprovado`, hashes revalidados. | — |
| **Cascade semantics** | Definir o que a revogação faz com **dados já compartilhados / vínculos ativos**. | DPO (Angélica) + jurídico | ✅ **Resolvido (2026-06-03)** — [adendo](cascata-revogacao-semantica.md) aprovado + matriz em código. Resta a aplicação nos módulos consumidores. | — |
| **RBAC do art. 19** | Confirmar que a checagem **inline** de papel no `issueAccessReport` é suficiente para go-live, ou antecipar `requirePermission()` (USP-007+). | DPO + Tech Lead | ⚠️ **A confirmar** | aceitação de §5 |
| **UI de emissão** | Definir como a equipe interna dispara o relatório de acesso no go-live. | Bravi PO + Tech Lead | ⚠️ **A definir** | operação do art. 19 |
| **D-001** | Designação formal do DPO. | Diretoria ASONSEG | ✅ **Resolvido (2026-05-29)** — diretora **Angélica** designada DPO. Ver [dpo.md](dpo.md). | — |

> **RP-002** (matriz-conexoes): "DPO não designado a tempo" — mitigado por D-001
> resolvido. O risco residual passa a ser **D-002** (termos) e a **semântica da
> cascata**.

---

## 9. Resultado da revisão

| Campo | Valor |
|---|---|
| Data da revisão | _a preencher_ |
| DPO (encarregada) | Diretora Angélica |
| Jurídico | Lino |
| Tech Lead | Nei |
| Veredito | ☐ Apto a go-live · ☐ Apto com ressalvas · ☐ Bloqueado |
| Pendências remanescentes | _listar itens ⚠️/🔶 não fechados_ |

---

## Referências

- PRD — USP-043 e épico de Conformidade LGPD: [`docs/prd/prd-asonseg-portal-mvp.md`](../prd/prd-asonseg-portal-mvp.md)
- Matriz de conexões (LGP-04/05/06, D-001, D-002, RP-002): [`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md`](../IDSD/ice-portal-asonseg/matriz-conexoes.md)
- ADR-0009 — Consentimentos LGPD por finalidade: [`docs/arch/0009-...md`](../arch/0009-consentimentos-lgpd-por-finalidade.md)
- ADR-0004 — Auditoria imutável append-only: [`docs/arch/0004-...md`](../arch/0004-auditoria-imutavel-append-only.md)
- IDSD ADR-0023 / 0025 / 0026: [`docs/IDSD/architecture/adrs/`](../IDSD/architecture/adrs/)
- Designação do DPO: [`dpo.md`](dpo.md)
