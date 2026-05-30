# Runbook — Server Action sensível (sequência canônica)

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-001, 002, 003, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 019, 020, 023, 025, 026, 029, 032, 033, 034, 036, 037, 038, 040, 043 (toda mutação sensível)
**ADRs relacionados:** ADR-0020 (transação/outbox), ADR-0021 (unicidade), ADR-0023 (auditoria)
**Referência no TD:** §4.4 (contratos), §4.3 (fluxos)

## Quando usar

Sempre que uma Server Action **escreve** dado de domínio (cria/edita/transiciona) e/ou tem efeito colateral (e-mail). É o esqueleto de toda mutação sensível do portal.

## Quando NÃO usar

Leituras puras (use `queries/` + View Model — ver `runbook-view-model-visibility`). Mudança de status de conteúdo moderável (use `transitionContent` — `runbook-moderation-transition`). Operação sem efeito de domínio (ex.: validar CAPTCHA isolado).

## O padrão (passo a passo)

```ts
// modules/<dominio>/actions/<verbo>.action.ts
'use server'
export async function <verbo>(input: unknown): Promise<ActionResult<T>> {
  // 1. Validar entrada com Zod
  const parsed = <Verbo>Schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'VALIDATION' }

  // 2. Identidade SEMPRE da sessão (nunca do payload)
  const { pessoaId } = await getSession()           // anti-IDOR (USP-006/P-002)

  // 3. Autorização
  await requirePermission(pessoaId, 'portal:<permissao>')   // FORBIDDEN se faltar

  // 4. Consentimento (quando a operação é vinculada a finalidade LGPD)
  await requireActiveConsent(pessoaId, Finalidade.X)        // CONSENT_REQUIRED se faltar

  // 5. Pré-condições de negócio (ex.: vaga ativa, Empresa tem ≥1 responsável)
  // ... checagens de domínio puras ...

  // 6. Transação única + auditoria + outbox
  try {
    const data = await withAudit('EVENT_TYPE', async (tx) => {
      const row = await tx.<entidade>.create({ data: ... })  // escritas
      await tx.outbox.create({ data: { tipo: 'email.x', payload } }) // e-mail post-commit
      return row
    })
    return { ok: true, data }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'CONFLICT' }  // 409 (ADR-0021)
    throw e   // inesperado → error handler global (logado sem PII)
  }
}
```

A ordem é fixa: **Zod → permissão → consentimento → pré-condições → transação(withAudit+outbox)**. Nunca pule um passo aplicável.

## Pontos de atenção (gotchas)

- **Nunca `throw` para erro de negócio** — retorne `ActionResult`. `throw` só para inesperado.
- **`pessoaId` vem da sessão, nunca do `input`** — senão um usuário ativa papel/age em nome de outra Pessoa (IDOR — USP-006/P-002).
- **E-mail vai no `outbox` DENTRO da transação**, despachado pós-commit. Disparar SMTP dentro da transação gera e-mail órfão em rollback (USP-044/P-003).
- **`withAudit` participa da MESMA transação** — se a auditoria falha, tudo reverte. Auditoria não pode ser silenciosa (USP-001/P-006).
- **Unicidade é do banco** — não confie em "consulta-depois-insere"; capture a violação e devolva `CONFLICT` (ADR-0021).
- **Múltiplas escritas = uma transação só** — não faça `create` solto seguido de outro `create` sem `tx`.

## Verificação

- [ ] Entrada validada por Zod antes de qualquer lógica
- [ ] `pessoaId` derivado da sessão, não do payload
- [ ] `requirePermission` presente (quando há autorização)
- [ ] `requireActiveConsent` presente (quando vinculado a finalidade LGPD)
- [ ] Escritas + `withAudit` + `outbox` na mesma transação
- [ ] Violação de unicidade → `CONFLICT` (409 determinístico)
- [ ] Retorna `ActionResult`, nunca faz `throw` de erro de negócio
- [ ] Teste cobre: happy path, validação, permissão negada, consentimento ausente, concorrência (quando aplicável)

## Referências

- ADR-0020, ADR-0021, ADR-0023; project-guideline §5, §7.1, §8.2
- TD §4.4, §4.3
- USPs servidas: ver cabeçalho
