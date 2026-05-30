# Runbook — Busca pública: paginação, match e expiração on-read

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-020, 021, 022, 024, 028, 030, 041, 042
**ADRs relacionados:** ADR-0026 (on-read), ADR-0022 (View Models), ADR-0019 (ISR/cache)
**Referência no TD:** §4.4 (buscas), §4.5 (jobs/services)

## Quando usar

Listagens e buscas: vagas, serviços, busca ativa de candidatos, relatórios, e a home com indicadores. Qualquer query sobre coleção que cresce.

## Quando NÃO usar

Leitura de registro único por id (use query direta + View Model). Agregação trivial sem coleção (ex.: contar 1 entidade).

## O padrão (passo a passo)

```ts
// 1. Paginação SEMPRE
const rows = await prisma.job.findMany({
  where: {
    status: 'ativo',
    validade: { gte: hojeSP() },        // EXPIRAÇÃO ON-READ (ADR-0026)
    ...filtros,                          // todos os filtros simultâneos
  },
  select: { /* só os campos do View Model */ },
  orderBy: { publishedAt: 'desc' },      // mais recente primeiro
  take: PER_PAGE, skip: (page-1)*PER_PAGE,
})
// 2. Mapear para View Model por papel (anônimo vs autenticado) — runbook-view-model-visibility
// 3. Match textual case-insensitive SEM acento sobre os campos definidos
```

- **On-read**: a busca filtra `status='ativo' AND validade >= hoje` (TZ `America/Sao_Paulo`) — vaga vencida nunca aparece, mesmo se o job de expiração atrasou.
- **Cache**: busca pública e home com cache **TTL 600s** (ISR) + **revalidação on-demand** na aprovação/expiração.
- **Relatórios de janela longa**: pré-agregação (ex.: mensal) ou paginação para não estourar o p95.

## Pontos de atenção (gotchas)

- **Nunca `findMany` sem `take`** — coleção que cresce sem paginação degrada e vaza volume.
- **On-read é a fonte da verdade da visibilidade**, não o status persistido — não confie só no job (USP-021/P-003, USP-024).
- **Match sem acento** — normalize (ex.: `unaccent`/normalização) para "padaria" achar "padária"; é match exato robusto, **não** busca semântica (FTS/semântica → V2 — decisão consciente).
- **Filtros simultâneos** — todos os filtros aplicados juntos (AND), não o último que ganhou.
- **Anonimização vem depois, no View Model** — a query traz o necessário; o recorte por papel é do View Model (não exponha a entidade crua).
- **Cache não pode ter TTL > janela acordada** — conteúdo inativo/expirado/revogado não pode reaparecer por cache velho (USP-030/P-004).
- **Conteúdo com consentimento revogado some on-read** — mesma técnica do filtro de validade (ADR-0025).

## Verificação

- [ ] `take` presente (paginação obrigatória)
- [ ] `select`/`include` explícitos (sem `SELECT *`); sem N+1
- [ ] Filtro on-read (status ativo + validade/consentimento) independente do job
- [ ] Match case-insensitive sem acento sobre os campos definidos
- [ ] Resultado mapeado para View Model por papel
- [ ] Cache curto com invalidação on-demand; TTL ≤ janela acordada
- [ ] Relatório de janela longa pré-agregado/paginado

## Referências

- ADR-0026, ADR-0022, ADR-0019, ADR-0025; project-guideline §7.3, §14
- TD §4.4, §4.5
- USPs servidas: ver cabeçalho
