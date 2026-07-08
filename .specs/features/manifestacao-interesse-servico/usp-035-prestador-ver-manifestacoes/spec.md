# USP-035 — Prestador ver manifestações de interesse (spec)

> **Adapter de spec.** Fonte: épico `manifestacao-interesse-servico/spec.md` (P1 "Prestador ver
> manifestações") + PRD USP-035 (AC-035-1). Indexa; não re-deriva.

**Fase:** 4 · **Unidade:** U3 · **Épico:** `manifestacao-interesse-servico`
**Módulo dono:** `@/modules/services` · **NET-NEW.**
**Sizing:** **Large** (piso — must-nots de privacidade/ownership; espelha AD-018).
**Deps:** USP-033 (modelo + write path), USP-010 (papel PROVIDER). **Prioridade PRD:** Must Have.

## Problem statement

O prestador precisa ver quem manifestou interesse nos seus serviços — nome, contato, data e
serviço referenciado — para retomar o contato. É o análogo de "empregador vê candidatos"
(USP-027 / AD-018): leitura sensível de PII de terceiro, controlada por View Model e por
escopo de propriedade, com auditoria de acesso.

## Acceptance Criteria (rastreio)

| ID | Critério (EARS) | Origem |
|---|---|---|
| **AC-035-1** | QUANDO o prestador abre seu painel ENTÃO o sistema DEVE listar as manifestações **ativas** com nome do cliente, contato, data e serviço referenciado. | épico P1-1 / PRD AC-035-1 |
| **AC-035-2** | QUANDO o prestador visualiza os dados do cliente ENTÃO os campos DEVEM vir por **View Model** (visibilidade por papel do observador), nunca por consulta direta ao Prisma no template. | épico P1-2 |

## Must-nots

| ID | Proibição | Sensor |
|---|---|---|
| **SVC035-MN-01** | Um prestador **nunca** vê manifestações de serviços que **não são dele** (escopo `service.authorPersonId == viewer.id`). | teste: prestador B não vê interesse no serviço de A |
| **SVC035-MN-02** | A query **não** carrega PII do cliente além de nome+contato (cpf/nascimento/endereço estruturalmente ausentes do `select` — defesa RSC/Flight). | teste de não-vazamento no payload |
| **SVC035-MN-03** | Manifestações **canceladas** não aparecem na lista (`where cancelledAt: null`). | teste: cancelada ausente |

## Edge cases

- Prestador sem manifestações ⇒ lista vazia (estado vazio na UI).
- Pessoa sem papel PROVIDER acessa a rota ⇒ `notFound()` (guard de página, padrão do repo).
- Serviço do prestador foi arquivado/pausado mas tem manifestação ativa ⇒ ainda aparece (o vínculo é com a manifestação, não com o status atual do serviço) — decisão: **listar** (o prestador ainda quer contatar quem o procurou). Documentado.

## Success criteria

- [ ] Prestador vê, num painel "manifestações recebidas", uma linha por manifestação ativa com nome, contato (telefone/e-mail), data e serviço.
- [ ] Manifestações canceladas e de outros prestadores não aparecem.
- [ ] Acesso à lista audita a visualização do contato do cliente (SENSITIVE_FIELD_VIEWED), espelhando AD-018.
