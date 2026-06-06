# Template da Matriz de Conexões (`matriz-conexoes.md`)

Arquivo único na raiz do projeto. Função: ser o **índice de lookup** que o harness de dev consulta para alimentar contexto sob demanda. Sem ela, o agente que desenvolve uma US abre o PRD+TD inteiros e cai no "muro" que ICE existe para evitar.

A matriz é gerada esquelética pela skill **po-bravi** (com USPs, ADRs de negócio, métricas, riscos, dependências, premissas estruturais e Q-abertas). Colunas técnicas (schemas, skills/runbooks, ADRs técnicos) são preenchidas depois pela skill **architecture-planning**.

## Estrutura em 4 seções

### Seção 1 — Índice compacto

Tabela narrow, scaneável de cima a baixo. Uma linha por USP:

```
| USP | Título | Épico | Prioridade |
|---|---|---|---|
| US-001 | Auto-cadastro de Pessoa | 1 — Identidade | Must |
| US-002 | Cadastro pela AS | 1 — Identidade | Must |
| … | … | … | … |
```

Serve como TOC. Quando o leitor humano quer escanear "que USPs estão no Épico 5", abre essa seção.

### Seção 2 — Cards de conexão por USP

Para cada USP, um card com upstream, downstream, ADRs, métricas, riscos, deps, Q-abertas. Estrutura fixa:

```
### US-NNN — <título>

- **Upstream:** US-XXX, US-YYY
- **Downstream:** US-AAA, US-BBB, … (ou "todas as USPs autenticadas" quando aplicável)
- **ADRs:** ADR-0001, ADR-0013, …
- **Métricas:** MP1, MP4
- **Riscos:** RP-005, RP-009
- **Premissas:** PR-001, PR-003
- **Deps/Q-abertas:** D-002, D-009, QP-003
```

Anotações opcionais quando úteis (ex.: "⚠️ Conflito conhecido: AC-037-2 vs ADR-0013 — ver F1 do Intent USP-037").

**Critério de qualidade:** se a USP referencia um ADR/risco/dep, a Seção 3 deve mostrar a relação reversa. Sem essa simetria, há erro de mapeamento.

### Seção 3 — Lookups inversos

Cinco tabelas/listas. Cada uma é uma chave que pode ser consultada pelo harness ou pelo humano:

**3.1 ADR → USPs**

```
| ADR | Título | USPs que referenciam |
|---|---|---|
| ADR-0013 | Consentimentos por finalidade | US-001, US-006, US-009, US-037, US-040, US-043, … |
| ADR-0017 | Visibilidade conservadora | US-001, US-016, US-021, US-027, … |
```

**3.2 Risco → USPs**

```
| Risco | USPs vetoras |
|---|---|
| RP-005 — Empresa-fantasma | US-012 (entrada), US-015 (vetor pós-verificação), US-017 (principal), US-020 |
| RP-008 — LLM sem ZDR | US-040 (principal), US-009 indireto, US-027, US-036, US-039, US-043 |
```

**3.3 Dependência → USPs (em produção)**

```
| Dep | Owner | USPs bloqueadas |
|---|---|---|
| D-001 — DPO designado | Diretoria | US-036, US-037, US-039, US-040, US-042, US-043 |
| D-002 — Termos por finalidade | Diretoria + jurídico | US-001, US-006, US-009, … |
```

**3.4 Q-aberta → USPs**

```
| Q-aberta | USPs afetadas |
|---|---|
| QP-001 — Verificação de identidade na reivindicação | US-003 |
| QP-002 — Provedor IA | US-040, US-009 |
```

**3.5 Métrica → USPs**

```
| Métrica | USPs que contribuem |
|---|---|
| MP1 — Candidatos com perfil ativo | US-001, US-009, US-016 (aprova), US-040 (acelera) |
| MP10 — Tempo médio de moderação | US-016 |
```

**3.6 Premissa → USPs (ledger)**

A defesa da matriz contra o pivot upstream. Cada premissa estrutural assumida pelo projeto, com seu valor atual e as USPs escritas sobre ela. Quando o valor muda, esta tabela é o blast radius — regenera-se só as USPs listadas.

```
| Premissa | Valor atual | USPs dependentes |
|---|---|---|
| PR-001 — Alvo de deploy | GCP Cloud Run | US-007, US-012, US-019, US-031 |
| PR-002 — Provedor de IA | Claude (via API) | US-009, US-040 |
| PR-003 — Modelo de consentimento | Por finalidade (ADR-0013) | US-001, US-006, US-037, US-043 |
| PR-004 — Volume esperado | ~5k usuários simultâneos pico | US-007, US-019 |
```

Premissa ≠ dependência (3.3): dependência é coisa externa aguardada de um terceiro; premissa é fato assumido como verdadeiro sobre o qual a USP foi escrita. Quando a premissa cai, a USP fica **errada em silêncio**, não bloqueada.

### Seção 4 (opcional) — Views derivadas

Quando o projeto é grande o suficiente pra valer, adiciona views derivadas:

**4.1 USPs de alta concentração de risco** — quem toca ≥ 3 ADRs ou ≥ 2 riscos ou ≥ 2 deps bloqueantes. Onde priorizar análise prévia.

**4.2 USPs fundacionais** — quem é upstream de muita coisa. Onde mexer custa caro.

**4.3 Clusters de USPs que se movem juntas** — agrupamento que define como o plano de fases pode ser fatiado.

**4.4 USPs bloqueadas em produção por decisão pendente** — mesmo com código pronto, gate humano impede merge. Lista mais útil pro sponsor.

## Convenção de nomes

- **USPs**: o ID original do PRD (`US-NNN` ou `USP-NNN`). Não renumere.
- **ADRs**: prefixo numérico `ADR-NNNN`. Se o projeto usa ADRs herdados de outro PRD (Frente 4 reusando ADR-0001), marque a origem: "ADR-0001 (Frente 4)".
- **Métricas/Riscos/Deps/Q-abertas**: usar exatamente os IDs do PRD. Não inventar novos IDs aqui.

## Quando criar entradas novas

A matriz reflete o PRD; ela não inventa. Mas há dois casos legítimos em que ela acrescenta:

1. **Risco novo identificado durante a derivação ICE** (não estava no §13 do PRD). Marcar como "(proposto)" e abrir uma issue para o PO confirmar no próximo CHANGELOG do PRD.

2. **Métrica nova proposta** (ex.: MP11 — % de validações de CV com correção, em USP-040). Mesma regra: marcar "(proposta)" e confirmar com sponsor.

Anti-padrão: criar IDs sem âncora no PRD silenciosamente. A matriz fica desincronizada do PRD em poucos dias.

## Checklist de qualidade

- [ ] Seção 1 lista todas as USPs do PRD, na mesma ordem dos épicos
- [ ] Cada USP tem um card próprio na Seção 2
- [ ] Cada referência em um card está reciprocada na Seção 3
- [ ] Todo ADR/risco/dep/Q-aberta do PRD aparece em ao menos um lookup inverso (se não aparece, ou é irrelevante e deveria sair do PRD, ou está faltando referência em algum card)
- [ ] Riscos com impacto Alto têm pelo menos uma USP-vetor identificada na Seção 3.2
- [ ] Toda premissa estrutural assumida (deploy, IA, consentimento, volume, integração) está na Seção 3.6 com valor atual e USPs dependentes
- [ ] Métricas com meta "a definir" estão marcadas como tal
- [ ] Quando há views derivadas (Seção 4), o critério da view está escrito
