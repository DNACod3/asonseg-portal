# Runbook — Gate de consentimento LGPD por finalidade

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-001, 003, 006, 009, 010, 011, 012, 025, 029, 033, 036, 037, 040, 043
**ADRs relacionados:** ADR-0013 (negócio), ADR-0023 (append-only), ADR-0025 (cascata/on-read)
**Referência no TD:** §4.5 (consents), §7.4 (LGPD)

## Quando usar

Sempre que uma operação está vinculada a uma das 8 finalidades de consentimento (ativar papel, candidatar-se, manifestar interesse, salvar ficha social, encaminhar, extrair CV). Cobre dois momentos: **coletar** o aceite (ao ativar) e **verificar** (a cada operação ligada à finalidade).

## Quando NÃO usar

Operações sem vínculo a finalidade LGPD (ex.: login, busca pública anônima). Não use para autorização por papel (isso é `requirePermission`).

## O padrão (passo a passo)

**Coletar (no momento de ativar papel/funcionalidade):**
```ts
// dentro da transação da Server Action (runbook-server-action, passo 6)
await tx.consents.create({ data: {
  personId, finalidade: Finalidade.X,
  versaoTermo: TERMOS[Finalidade.X].versaoVigente,
  aceiteEm: now(), ip: ctx.ip, status: 'ativo',
  hashIntegridade: chain(prevHash, payload),   // hash encadeado (ADR-0023)
}})
```

**Verificar (em toda operação ligada à finalidade):**
```ts
await requireActiveConsent(personId, Finalidade.X)
// lança/retorna CONSENT_REQUIRED se não há consentimento 'ativo' da finalidade
// verificação ON-READ — não confia só em efeito assíncrono (ADR-0025)
```

**Revogar (USP-043):**
```ts
await withAudit('CONSENT_REVOKED', async (tx) => {
  await tx.consents.create({ data: { ...novo, status:'revogado', revogacaoDe: anteriorId }})
  await aplicarCascata(tx, personId, Finalidade.X)   // matriz finalidade→efeitos
})
```

## Pontos de atenção (gotchas)

- **Revogação é INSERT, nunca UPDATE/DELETE** — `consents` é append-only (ADR-0023). "Des-revogar" é um novo aceite.
- **Versão "major" do termo exige re-aceite** — se o termo mudou de major (ex.: trocou o provedor LLM — USP-040/P-003), o papel fica desativado até re-aceitar; "minor" preserva o aceite (USP-043/P-003).
- **A semântica da cascata é da DPO** (diretora Angélica + jurídico — owner confirmado; a definir antes da USP-043) — o que acontece com candidaturas ativas ao revogar a finalidade 2 ainda não está decidido. Implemente a **matriz parametrizável**; não chute a semântica.
- **Verificação on-read é obrigatória** — não basta aplicar efeitos no momento da revogação; toda operação ligada à finalidade revalida (senão abre janela "papel ativo sem consentimento" — USP-043/P-002).
- **Coleta na MESMA transação da ativação** — papel nunca fica ativo sem o consentimento persistido (USP-001/P-002).
- **Finalidades são enum fechado (8)** — não adicione finalidade sem decisão de produto + jurídico (USP-043/P-008).

## Verificação

- [ ] Aceite persistido na mesma transação da ativação do papel
- [ ] `requireActiveConsent` presente em toda operação ligada à finalidade (on-read)
- [ ] Revogação cria novo registro (append-only), nunca muta o anterior
- [ ] Cascata aplicada via matriz parametrizável (semântica do DPO)
- [ ] Mudança "major" de termo força re-aceite
- [ ] Finalidade dentro do enum fechado de 8

## Referências

- ADR-0013, ADR-0023, ADR-0025; project-guideline §12
- TD §4.5 (consents), §7.4
- USPs servidas: ver cabeçalho
