# Runbook — Log imutável de auditoria (`withAudit`)

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-001–008, 012, 014, 015, 016, 017, 018, 019, 025, 026, 033, 034, 036, 037, 038, 039, 042, 043, 044, 045 (quase toda escrita sensível)
**ADRs relacionados:** ADR-0023 (append-only), ADR-0010 (negócio — log absoluto)
**Referência no TD:** §4.5 (audit_log), §4.6 (catálogo de eventos)

## Quando usar

Sempre que uma operação sensível persiste ou transiciona dado: autenticação, alteração de permissão, criação/edição/inativação de conteúdo, mudança de status, configuração global, ativação/revogação de consentimento, decisões de moderação, encaminhamentos, export de relatório.

## Quando NÃO usar

Leitura comum (acesso a dado sensível terá auditoria de leitura em V2 — registre apenas **export** de visão consolidada/relatório no MVP). Operações triviais sem valor de rastreabilidade.

## O padrão (passo a passo)

Assinatura: `withAudit(event, fn, ctx?)`. O callback recebe `(tx, audit)` — `tx` é o
client transacional e `audit` é um **recorder mutável** onde se anota
`entityType`/`entityId`/`before`/`after`/`justification` (before/after só existem
depois de a operação rodar). O `ctx` (3º arg) carrega ator e origem da request.

```ts
const data = await withAudit(
  'EVENT_TYPE',
  async (tx, audit) => {
    // ...escritas de domínio usando tx...
    audit.entityType = 'job'
    audit.entityId = job.id
    audit.after = job            // PII minimizada automaticamente (ver gotchas)
    // audit.justification = '...' // obrigatória em revogação/rejeição/inativação
    return resultado
  },
  { actorUserId, actorPersonId, ip, userAgent }, // ctx opcional
)
// withAudit:
//  1. abre transação (prisma.$transaction)
//  2. executa o callback (escritas de domínio) e coleta o recorder
//  3. valida justificativa obrigatória (JUSTIFICATION_REQUIRED_EVENTS)
//  4. grava 1 linha em audit_log na MESMA transação:
//     { action, actorUserId, actorPersonId, entityType, entityId,
//       before, after, context, ip, userAgent, justification, occurredAt }
//  5. commit atômico — se a auditoria falhar (ou faltar justificativa), tudo reverte
```

Use **sempre** um `event` do catálogo fechado (`@/modules/audit/events`, TD §4.6):
`PERSON_CREATED_PUBLIC`, `ROLE_GRANT_ACTIVATED`, `CONTENT_APPROVED`, `CONSENT_GRANTED`,
`CONSENT_REVOKED`, `ACCESS_REPORT_ISSUED`, etc. — nunca string solta.

## Pontos de atenção (gotchas)

- **`audit_log` é append-only no banco** (`REVOKE UPDATE, DELETE`) — a imutabilidade não é convenção de código, é do DB (ADR-0023). Migrations devem aplicar o REVOKE.
- **Auditoria na MESMA transação** — não grave o log "depois" num segundo passo; se a operação reverte, o log não pode sobrar (e vice-versa). Falha de auditoria = rollback (USP-001/P-006).
- **`before`/`after`/`context` são minimizados** — NUNCA grave CPF/e-mail/telefone completos, conteúdo de CV ou corpo de e-mail no log (USP-044/P-008). Grave IDs e o necessário. O `withAudit` aplica uma rede de segurança (`normalizeJson`): mascara como `[REDACTED]` as chaves do baseline LGPD (`SENSITIVE_FIELDS` do logger — senha, token, cpf, e-mail, telefone…) em qualquer profundidade, e normaliza `Date`→ISO / `BigInt`→string. A redação é defensiva: a tabela é imutável por 1 ano, então não confie só nela — atribua ao recorder apenas o necessário.
- **Operação em batch audita cada item** — moderar em massa registra uma linha por decisão, não uma agregada (USP-016/P-006).
- **Operação via API direta também audita** — não há rota que pule o `withAudit`.
- **`ator` obrigatório** — toda linha identifica quem fez (ex.: AS que cadastrou Pessoa — USP-002/P-005).

## Verificação

- [ ] Evento pertence ao catálogo fechado (TD §4.6)
- [ ] `withAudit` envolve as escritas na mesma transação
- [ ] `audit_log` tem `REVOKE UPDATE, DELETE` (migration)
- [ ] `detalhe_json` sem PII sensível
- [ ] Batch registra cada decisão individualmente
- [ ] `ator` preenchido

## Referências

- ADR-0023, ADR-0010; project-guideline §10.1, §11.1
- TD §4.5, §4.6
- USPs servidas: ver cabeçalho
