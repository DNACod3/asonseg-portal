# Runbook — Log imutável de auditoria (`withAudit`)

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-001–008, 012, 014, 015, 016, 017, 018, 019, 025, 026, 033, 034, 036, 037, 038, 039, 042, 043, 044 (quase toda escrita sensível)
**ADRs relacionados:** ADR-0023 (append-only), ADR-0010 (negócio — log absoluto)
**Referência no TD:** §4.5 (audit_log), §4.6 (catálogo de eventos)

## Quando usar

Sempre que uma operação sensível persiste ou transiciona dado: autenticação, alteração de permissão, criação/edição/inativação de conteúdo, mudança de status, configuração global, ativação/revogação de consentimento, decisões de moderação, encaminhamentos, export de relatório.

## Quando NÃO usar

Leitura comum (acesso a dado sensível terá auditoria de leitura em V2 — registre apenas **export** de visão consolidada/relatório no MVP). Operações triviais sem valor de rastreabilidade.

## O padrão (passo a passo)

```ts
const data = await withAudit('EVENT_TYPE', async (tx) => {
  // ...escritas de domínio usando tx...
  return resultado
})
// withAudit:
//  1. abre transação (ou usa a corrente)
//  2. executa o callback (escritas de domínio)
//  3. grava 1 linha em audit_log na MESMA transação:
//     { evento, atorPersonId, entidade, entidadeId, detalheMinimizado, createdAt }
//  4. commit atômico — se a auditoria falhar, tudo reverte
```

Use **sempre** um `EVENT_TYPE` do catálogo fechado (TD §4.6): `PERSON_CREATED`, `ROLE_ACTIVATED`, `CONTENT_TRANSITIONED`, `REFERRAL_CREATED`, `CONSENT_GIVEN`, `CONSENT_REVOKED`, `REPORT_EXPORTED`, etc.

## Pontos de atenção (gotchas)

- **`audit_log` é append-only no banco** (`REVOKE UPDATE, DELETE`) — a imutabilidade não é convenção de código, é do DB (ADR-0023). Migrations devem aplicar o REVOKE.
- **Auditoria na MESMA transação** — não grave o log "depois" num segundo passo; se a operação reverte, o log não pode sobrar (e vice-versa). Falha de auditoria = rollback (USP-001/P-006).
- **`detalhe_json` é minimizado** — NUNCA grave CPF/e-mail/telefone completos, conteúdo de CV ou corpo de e-mail no log (USP-044/P-008). Grave IDs e o necessário.
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
