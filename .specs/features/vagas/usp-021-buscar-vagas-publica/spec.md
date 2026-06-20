# USP-021 — Buscar vagas (pública) — Spec

> **Modo ICE (thin adapter).** Esta spec NÃO re-deriva requisitos. Ela RESOLVE o card
> da USP-021 na matriz de conexões e aponta para os artefatos ICE que são a fonte da verdade.
> Board: US **#169** (Épico #6 — Vagas) · subtasks **#274** (T1, schema), **#170** (T2, query+view), **#171** (T3, UI) · seq-21 · Fase 2 · Estimate **22h** (revisada de 12h, AD-011).

## Entrada (card da matriz)

`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → **USP-021 — Buscar vagas (pública)**

- **Upstream:** USP-016 (vaga aprovada e ativa) ✅, USP-024 (vagas expiradas ocultas) — filtro on-read entregue aqui.
- **Downstream:** USP-022 (detalhe), USP-025 (candidatura).
- **ADRs negócio:** ADR-0015 (lista só conteúdo moderado), ADR-0017 (visibilidade conservadora — anonimização anônimo vs. autenticado).
- **ADRs técnicos:** ADR-0022 (anonimização no serializer/View Model), ADR-0026 (expiração on-read), ADR-0019 (ISR/cache).
- **Runbooks:** runbook-search-pagination, runbook-view-model-visibility.
- **Schemas (TD §4.5):** `jobs` (filtro on-read: `ACTIVE` + validade ≥ hoje + Empresa verificada). `content_items` **não existe** (status na entidade — ver design §0).
- **Endpoint (TD §4.4):** `jobs.buscarVagas` (query read-only, ISR + cache curto). Sem Server Action (leitura pública).
- **Eventos (TD §4.6):** — (busca não emite evento; só leitura).
- **Métricas:** — (vetor de descoberta; suporta MP6 downstream).
- **Riscos:** RP-009 (volume de tráfego anônimo em pico).
- **Deps/Q-abertas:** — (a lacuna de schema é resolvida em AD-011, não é Q-aberta da matriz).

## Requisitos (fonte da verdade — não copiar, resolver)

A spec real são os arquivos ICE — IDs preservados verbatim:

- **Intent:** `docs/IDSD/ice-portal-asonseg/intents/intent-USP-021.md`
- **Expectations:** `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-021.md`

### Escopo testável que entra NESTA US (#169 / #170–#171 + migração)

| ID | Resumo | Em escopo? |
| --- | --- | --- |
| **E-001** | Lista só vagas `ACTIVE` (fora: moderação/pausada/arquivada/expirada/rascunho), ordenadas por `publishedAt` desc | ✅ sim |
| **E-002** | Múltiplos filtros simultâneos em **AND lógico** (área, escolaridade, contrato, regime, faixa salário, região) | ✅ sim |
| **E-003** | Busca textual **case-insensitive sem acento** sobre título + descrição + requisitos | ✅ sim |
| **E-004 / P-001** | Anônimo: Empresa anonimizada por setor **em todos os campos** (HTML/JSON/SEO/OG) — anonimização no serializer | ✅ sim |
| **E-005** | Autenticado: nome real da Empresa | ✅ sim |
| **P-003** | On-read oculta vaga com validade vencida **mesmo se o job (USP-024) atrasou** | ✅ sim |
| **P-004** | Endpoint público NÃO expõe dados restritos por ADR-0017 (nome p/ anônimo, dados pessoais, contato) | ✅ sim |
| **P-005** | Vaga de Empresa **não verificada** NÃO aparece na busca pública | ✅ sim |
| **P-002** | Layout não despeja 6 filtros numa barra opressiva — 2-3 prioritários visíveis (área + regime/local), resto expansível | ✅ sim (UI) |
| **L-001** | Listagem ≤ 2s p95 no volume estimado, mesmo em pico (RP-009) | ✅ sim (índices + ISR) |
| **L-002** | Resultado **paginado** (`take` obrigatório) | ✅ sim |
| **L-004 / ADR-0019** | ISR + cache curto + revalidação on-demand ao publicar/moderar/expirar vaga | ✅ sim (reusa adapter de cache da moderação) |
| **L-003** | Rate limiting por IP no endpoint público (RP-009) | ⚠️ parcial — reusar `RATE_LIMIT_*` existente se houver; senão registrar gap (ver design §6) |
| **D-001..D-005** | Critérios de pronto do dono (UAT) | ⛔ validação de aceite (pós-merge), não codificável aqui — exceto D-002/D-004 cobertos por teste de View Model/on-read |

> **Fronteira da US:** query de busca + View Models por papel (anônimo/autenticado) + UI pública ISR + a **extensão de schema** (AD-011) que torna os 6 filtros possíveis. Detalhe de vaga é USP-022; expiração automática por job é USP-024 (aqui só o filtro on-read).

## Lacuna de schema resolvida (AD-011 — kickoff 2026-06-20)

O `Job` da USP-020 divergiu do TD §4.5: faltam `educationLevelRequired`, `contractType`, `salaryMin/Max`, `salaryVisible`, `regionId`+`Region`. **Decisão do dono:** estender o schema agora ao contrato do TD §4.5 (ver `design.md §1`) e reabrir o `JobForm` da USP-020 para coletar os novos campos. Sem isso, E-002 (6 filtros) e o edge `salaryVisible` não são implementáveis. Detalhe e trade-offs em STATE.md AD-011.

## Gates / Q-abertas herdadas (não bloqueiam dev nem merge)

- **D-003 (carga ≤ 2s p95, 100 anônimos):** validação de performance pós-merge (não pré-merge). Mitigado por índices (`@@index([status, validUntil])`, `@@index([areaId, regionId, status])`) + ISR (ADR-0019).
- **D-005 (usabilidade com voluntários):** UAT de campo do dono do intent — pós-merge.
- **P-005 (Empresa verificada):** depende de `Company.isVerified` (USP-017, já implementado) — filtro on-read inclui `company.isVerified = true`.

## Definition of Done (US #169)

- [ ] E-001, E-002, E-003, E-004/P-001, E-005, P-003, P-004, P-005, L-002, L-004 cobertos por testes (facts do skill-tdad).
- [ ] Migração de schema (AD-011) aplica em DB limpo + seed backfillado; `JobForm` da USP-020 atualizado sem regressão.
- [ ] Subtasks do board fechadas e PRs merged (squash).
- [ ] Sem regressão em `npm run typecheck` / `lint` / testes (unit + int + E2E).
