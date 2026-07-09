# USP-034 — Cancelar manifestação de interesse (spec)

> **Adapter de spec.** Fonte: épico `manifestacao-interesse-servico/spec.md` (P2 "Cancelar
> manifestação") + PRD USP-034 (AC-034-1). Indexa; não re-deriva.

**Fase:** 4 · **Unidade:** U3 · **Épico:** `manifestacao-interesse-servico`
**Módulo dono:** `@/modules/services` · **NET-NEW.**
**Sizing:** **Large** (piso — must-not de ownership/privacidade; parte do agregado de escrita).
**Deps:** USP-033 (modelo `ServiceInterest` + write path). **Prioridade PRD:** Should Have.

## Problem statement

O cliente precisa retirar uma manifestação que fez, para que sua lista de interesses e a
lista de manifestações ativas do prestador reflitam a realidade. Soft-cancel (`cancelledAt`),
espelhando `cancelApplication` de `jobs`.

## Acceptance Criteria (rastreio)

| ID | Critério (EARS) | Origem |
|---|---|---|
| **AC-034-1** | QUANDO o cliente cancela uma manifestação ENTÃO o sistema DEVE marcá-la como "cancelada" (`cancelledAt` preenchido). | épico P2-1 / PRD AC-034-1 |
| **AC-034-2** | QUANDO uma manifestação é cancelada ENTÃO ela DEVE deixar de aparecer na lista de manifestações ativas do prestador (USP-035). | épico P2-2 |
| **AC-034-3** | QUANDO o cliente cancela uma manifestação já cancelada ENTÃO o sistema DEVE tratar de forma **idempotente**, sem alterar o estado e sem novo registro de auditoria. | épico Edge |

## Must-nots

| ID | Proibição | Sensor |
|---|---|---|
| **SVC034-MN-01** | Um cliente **não** cancela manifestação de **terceiro** — e a existência dela **não** vaza (owner + existência foldados ⇒ `NOT_FOUND`, nunca `FORBIDDEN`). | teste: interesse de outra Pessoa ⇒ NOT_FOUND, linha intacta |
| **SVC034-MN-02** | Cancelamento **não** revoga o consentimento `SERVICE_HIRING` nem desativa o papel `CLIENT` (retirar interesse ≠ retirar base legal). | teste: após cancelar, consent/`CLIENT` seguem ativos ⇒ re-manifestar funciona |

## Edge cases

- Manifestação inexistente ou de outra Pessoa ⇒ `NOT_FOUND` (SVC034-MN-01).
- Já cancelada ⇒ idempotente `ok` (AC-034-3), sem tx auditada (padrão `revokeConsent`).
- Corrida de duplo-cancelamento ⇒ `updateMany where cancelledAt:null` decide (o 2º vê count 0 ⇒ idempotente).

## Success criteria

- [ ] Cliente cancela manifestação própria ativa ⇒ `cancelledAt` preenchido + audit `INTEREST_CANCELLED`.
- [ ] Manifestação cancelada some da lista do prestador e do bloco de contato do cliente no detalhe.
- [ ] Re-manifestar após cancelar cria nova linha ativa (índice parcial permite).

## Divergência declarada do precedente

`cancelApplication` (jobs) retorna `PRECONDITION_FAILED` ao recancelar; o **épico exige
idempotência** (AC-034-3), então `cancelInterest` retorna `ok` idempotente. Divergência
intencional, documentada.
