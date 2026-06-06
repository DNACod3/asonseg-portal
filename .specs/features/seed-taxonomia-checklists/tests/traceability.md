# Rastreabilidade EARS → Fact — US #111 Seed de taxonomia e checklists

Fonte: issue #111 (Épico #4 — Fase 0). Gerado por skill-tdad. Cobertura: 2/2 ACs com fact.

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| AC-111-1 | QUANDO…ENTÃO (WHEN…SHALL) + invariante | seed popula regions/job_areas/service_categories, idempotente | integração (banco efêmero) | `@ac-111-1` (popular + idempotência) | `prisma/__tests__/seed.integration.test.ts::popula-taxonomia` / `::idempotente` | Red |
| AC-111-2 | QUANDO…ENTÃO (WHEN…SHALL) | checklist de empresa-fantasma DEVE existir como doc verificável | teste estrutural de doc | `@ac-111-2` (existe + critérios) | `tests/docs/checklist-empresa-fantasma.test.ts::existe` / `::criterios` | Red |

## Facts (bloco para o corpo do issue #111 — Kickoff Gate, §22/§23)

- AC-111-1 (populado) → `prisma/__tests__/seed.integration.test.ts::popula-taxonomia`
- AC-111-1 (is_suggestion=false / region ativa) → mesmo arquivo, casos `it.todo` a preencher
- AC-111-1 (idempotência) → `prisma/__tests__/seed.integration.test.ts::idempotente`
- AC-111-2 (existência) → `tests/docs/checklist-empresa-fantasma.test.ts::existe`
- AC-111-2 (conteúdo: CNPJ/razão social/endereço + aprovar/rejeitar) → `…::criterios`
- Entregável-fonte do AC-111-2 → `docs/operacao/checklist-empresa-fantasma.md` (a criar)

## Não aplicável (justificado)

- **Casos obrigatórios de Server Action (§12)** — N/A: US de infra/seed, sem Server Action.
- **E2E Playwright** — N/A: não é fluxo de usuário nem um dos Top 8 (architecture-document §6).
- **Schema Zod / View Model / eval LLM / property-based** — N/A nesta US (idempotência é
  coberta por teste de exemplo executando o seed 2×; property-based seria sobre-engenharia aqui).

## Lacunas / decisões pendentes

- 🚧 **Lista canônica da taxonomia inicial** (quais bairros, áreas de vaga e categorias) vem do
  protótipo refinado com a diretoria — **D-007 / QP-010, pendente pré go-live**. Os facts hoje
  asseguram "não-vazio + idempotente + is_suggestion=false"; quando a lista existir, fixar os
  nomes canônicos no `it.todo` correspondente. **Não bloqueia o Kickoff Gate** (há fact stub),
  mas bloqueia o "verde" final do AC-111-1.
- 🚧 **Caminho definitivo do doc de checklist** (`docs/operacao/checklist-empresa-fantasma.md`
  é proposta) — confirmar com Tech Lead/diretoria na fase Execute.

Status: `Red` (gerado, falhando) → `Green` (implementado) → `Verified`. Tudo entregue em **Red**.
