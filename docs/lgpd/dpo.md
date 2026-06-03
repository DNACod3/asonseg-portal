# Encarregado pelo Tratamento de Dados (DPO) — ASONSEG

> Designação do Encarregado pela Proteção de Dados (DPO — *Data Protection
> Officer*) do Portal ASONSEG, conforme **LGPD (Lei 13.709/2018), art. 41**.
> Atende a decisão **D-001** da [matriz de conexões](../IDSD/ice-portal-asonseg/matriz-conexoes.md).

---

## 1. Designação (D-001)

| Campo | Valor |
|---|---|
| **Encarregada (DPO)** | Diretora **Angélica** |
| **Data da designação** | 2026-05-29 |
| **Instância** | Diretoria da ASONSEG |
| **Status** | ✅ **Resolvido** (D-001) |
| **Base legal** | LGPD art. 5º, VIII e art. 41 |

> A designação de D-001 está registrada na matriz de conexões:
> *"D-001 — Designação formal do DPO · Diretoria ASONSEG · RESOLVIDO (2026-05-29):
> diretora Angélica designada DPO."*

A nomeação **desbloqueia** as USPs que dependiam de DPO designado (USP-036, 037,
039, 042, 043 e a inativação por titular da USP-007), que passam a depender apenas
de **D-002** (revisão jurídica dos termos — ver §4).

## 2. Identidade e canal do titular

- [ ] **Identidade do encarregado publicada** ao titular (nome/cargo e canal de
      contato), conforme art. 41, §1º — _a publicar antes do go-live_ (ex.: página
      pública de privacidade / rodapé do portal).
- [ ] **Canal de atendimento ao titular** definido (e-mail/forma de contato) para
      requisições de acesso, correção e revogação.

> Implementação no portal: a publicação do nome e canal do encarregado é tarefa de
> conteúdo institucional (fora do código da USP-043). Registrar aqui o canal
> definido quando publicado.

## 3. Responsabilidades do encarregado

Conforme LGPD art. 41, §2º, e a operação do Portal ASONSEG:

1. **Aceitar reclamações e comunicações** dos titulares, prestar esclarecimentos e
   adotar providências.
2. **Receber comunicações da ANPD** e adotar providências.
3. **Orientar** funcionários e a equipe da ASONSEG quanto às práticas de proteção
   de dados.
4. **Autorizar e supervisionar** operações sensíveis sobre dados pessoais que o
   portal condiciona à DPO, em especial:
   - **Direito de acesso (art. 19)** — emissão do relatório consolidado do titular
     (papéis internos `SOCIAL_ASSISTANT` / `BOARD` / `COORDINATOR`; ver
     [checklist §5](checklist-revisao-lgpd.md#5-direito-de-acesso-do-titular--art-19-lgp-06)).
   - **Inativação a pedido do titular** (USP-007) e demais fluxos sobre dado
     sensível (`SOCIAL_ASSISTANCE` — art. 11).
   - **Semântica da cascata de revogação** (ADR-0025) — decisão sobre o destino de
     dados já compartilhados/vínculos ativos (ver §4).
5. **Aprovar versões dos termos** de consentimento em conjunto com o jurídico
   (D-002) — uma nova versão de termo só entra em produção após aprovação registrada.

## 4. Revisão jurídica dos termos (D-002) — concluída ✅

| Campo | Valor |
|---|---|
| **Decisão** | D-002 — revisão jurídica e aprovação dos 8 termos de consentimento |
| **Responsável** | Jurídico + DPO (Angélica) |
| **Status** | ✅ **Resolvido (2026-06-03)** — os 8 termos v1.0 estão `status: aprovado`; hashes revalidados no `TERMS_REGISTRY` (teste de integridade verde) |
| **Bloqueia** | — |

Termos revisados e aprovados (v1.0) em
[`legal/consent-terms/`](../../legal/consent-terms/README.md):

| # | Finalidade | Termo | Base legal | Atenção |
|---|---|---|---|---|
| 1 | `PORTAL_ACCESS` | [v1.0](../../legal/consent-terms/portal-access/v1.0.md) | art. 7º, V + I | — |
| 2 | `JOB_APPLICATION` | [v1.0](../../legal/consent-terms/job-application/v1.0.md) | art. 7º, I | — |
| 3 | `SERVICE_OFFERING` | [v1.0](../../legal/consent-terms/service-offering/v1.0.md) | art. 7º, I | — |
| 4 | `SERVICE_HIRING` | [v1.0](../../legal/consent-terms/service-hiring/v1.0.md) | art. 7º, I + V | — |
| 5 | `COMPANY_REPRESENTATION` | [v1.0](../../legal/consent-terms/company-representation/v1.0.md) | art. 7º, I + IX | — |
| 6 | `SOCIAL_ASSISTANCE` | [v1.0](../../legal/consent-terms/social-assistance/v1.0.md) | **art. 11, I (sensível)** | dado sensível — termo deve ser explícito |
| 7 | `CV_AI_EXTRACTION` | [v1.0](../../legal/consent-terms/cv-ai-extraction/v1.0.md) | art. 7º, I | nomear o provedor de IA (Anthropic Claude); troca exige nova versão + re-aceite |
| 8 | `SOCIAL_REFERRAL_TO_JOB` | [v1.0](../../legal/consent-terms/social-referral-to-job/v1.0.md) | art. 7º, I + IX | — |

**Procedimento de aprovação** (não quebrar a integridade por hash):

1. Jurídico revisa e ajusta o texto. Qualquer alteração de texto gera **nova
   versão** (`vN+1.md`) — termos já aceitos são imutáveis (ADR-0009).
2. Ao aprovar, alterar o header do termo de `status: aguardando-revisao-juridica`
   para `status: aprovado` (ou equivalente acordado).
3. **Recalcular e atualizar o hash** em `TERMS_REGISTRY`
   ([`domain/terms-registry.ts`](../../src/modules/consents/domain/terms-registry.ts)) —
   o aceite é bloqueado (`TERM_HASH_MISMATCH`) se o conteúdo divergir do hash registrado.
4. Registrar a aprovação (data + responsáveis) neste documento (§5).

## 5. Registro de aprovações

| Item | Data | DPO | Jurídico | Observações |
|---|---|---|---|---|
| Designação do DPO (D-001) | 2026-05-29 | Angélica | — | Registrado na matriz de conexões |
| Revisão dos 8 termos (D-002) | 2026-06-03 | Angélica | _a preencher_ | ✅ 8 termos v1.0 `aprovado`; hashes revalidados no `TERMS_REGISTRY` |
| Semântica da cascata (ADR-0025) | 2026-06-03 | Angélica | _a preencher_ | ✅ Aprovada — [adendo](cascata-revogacao-semantica.md) + matriz em código [`revocation-cascade.ts`](../../src/modules/consents/domain/revocation-cascade.ts) |

---

## Referências

- Checklist de revisão LGPD: [`checklist-revisao-lgpd.md`](checklist-revisao-lgpd.md)
- Matriz de conexões (D-001, D-002, RP-002): [`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md`](../IDSD/ice-portal-asonseg/matriz-conexoes.md)
- ADR-0009 — Consentimentos LGPD por finalidade: [`docs/arch/0009-...md`](../arch/0009-consentimentos-lgpd-por-finalidade.md)
- ADR-0025 — Cascata de revogação (semântica pela DPO): [`docs/IDSD/architecture/adrs/0025-...md`](../IDSD/architecture/adrs/0025-cascata-de-revogacao-de-consentimento.md)
- Termos versionados: [`legal/consent-terms/README.md`](../../legal/consent-terms/README.md)
