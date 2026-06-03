# Termos de consentimento LGPD — versionados

Termos de consentimento por finalidade, **fonte da verdade no Git** (ADR-0009).
O catálogo de finalidades (`ConsentPurpose`) e o sistema que consome estes textos
são da Fase 1 (módulo `consents`, issues #30/#37). O hash SHA-256 de cada arquivo
é registrado no banco no momento do aceite, garantindo integridade.

## Status

> ✅ **v1.0 — revisão jurídica concluída (D-002).** As 8 finalidades estão com
> `status: aprovado` no header. A aprovação está registrada em
> [`docs/lgpd/dpo.md`](../../docs/lgpd/dpo.md) e revisada no
> [checklist de go-live](../../docs/lgpd/checklist-revisao-lgpd.md). Conforme
> `technical-design.md §5` (entregável de Fase 0). Qualquer alteração futura de
> texto exige **nova versão** (`vN+1.md`) + novo hash no `TERMS_REGISTRY`.

## As 8 finalidades do MVP

| # | `ConsentPurpose` | Diretório | Quando é solicitado |
|---|---|---|---|
| 1 | `PORTAL_ACCESS` | [`portal-access/`](portal-access/v1.0.md) | Auto-cadastro / 1º login após reivindicação |
| 2 | `JOB_APPLICATION` | [`job-application/`](job-application/v1.0.md) | Ao ativar o papel de candidato |
| 3 | `SERVICE_OFFERING` | [`service-offering/`](service-offering/v1.0.md) | Ao ativar o papel de prestador |
| 4 | `SERVICE_HIRING` | [`service-hiring/`](service-hiring/v1.0.md) | Na 1ª manifestação de interesse (cliente) |
| 5 | `COMPANY_REPRESENTATION` | [`company-representation/`](company-representation/v1.0.md) | Ao cadastrar a 1ª empresa |
| 6 | `SOCIAL_ASSISTANCE` | [`social-assistance/`](social-assistance/v1.0.md) | Atendimento social (dado sensível — art. 11) |
| 7 | `CV_AI_EXTRACTION` | [`cv-ai-extraction/`](cv-ai-extraction/v1.0.md) | Antes do 1º upload de CV (provedor: Anthropic Claude) |
| 8 | `SOCIAL_REFERRAL_TO_JOB` | [`social-referral-to-job/`](social-referral-to-job/v1.0.md) | No fluxo da assistente social |

## Convenções de versionamento

- Um diretório por finalidade; um arquivo `vN.M.md` por versão.
- Cada arquivo tem header YAML com `version` (`<purpose>@vN.M`), `purpose`,
  `effective_date`, `legal_basis` e `status`.
- **Termos aceitos são imutáveis:** uma revisão jurídica cria uma **nova versão**
  (`vN+1.md`); consentimentos anteriores permanecem válidos na versão aceita.
- A troca de provedor de IA (finalidade 7) exige nova versão + re-aceite
  (ADR-0009 / ADR-0012).

Ver `docs/arch/0009-consentimentos-lgpd-por-finalidade.md`.
