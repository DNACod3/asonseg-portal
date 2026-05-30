# ADR-0022 — Visibilidade por View Models e anonimização na serialização

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** segurança, privacidade, autorização

## Contexto e Problema

O ADR-0017 (negócio) exige visibilidade conservadora: dado pessoal oculto por padrão, revelado só após ação afirmativa, com matriz de campos por papel do consultante. Os intents marcam como `(arquitetural-estrutural)` que a anonimização **não pode ser só no template** (USP-022/F2) e que a autorização de campos sensíveis precisa de **guard centralizado testável por papel** (USP-036/F3, USP-039/F1). Os must-not confirmam:

- USP-021/P-001 e USP-022/P-002: nome real da Empresa não pode vazar para anônimo por **nenhum canal** — descrição, requisitos, alt de imagem, meta tags OG/Twitter, JSON-LD, schema.org, URL canônica, payload da API.
- USP-027/P-006, USP-035/P-005: lista não pode vazar dados de outros candidatos/clientes (cross-leakage por query mal isolada).
- USP-036/P-003, USP-039/P-001/P-003, USP-042/P-007: ficha social só AS/diretoria — inclusive no JSON serializado e sem permitir inferência indireta.

Risco central: revelar dado por um **canal lateral** (serializer, metadados SEO, query não isolada) que o template não mostra mas o HTML/JSON expõe.

## Drivers de Decisão

- Minimização e reciprocidade do ADR-0017 como invariante, não como detalhe de UI.
- Defesa que cubra TODOS os canais de saída (HTML, JSON, SEO/OG, logs).
- Testabilidade automática "papel X não vê campo Y".

## Opções Consideradas

### Opção A — View Models por papel, montados na camada de leitura (server), + anonimização no serializer
- **Descrição:** Nenhuma query de Pessoa→Pessoa retorna a entidade crua. Funções `viewCandidateForEmployer`, `viewProviderForClient`, `viewPersonConsolidated`, etc. montam um objeto **só com os campos permitidos** para aquele papel. A anonimização (ex.: Empresa→setor para anônimo) acontece ao montar o View Model, antes de chegar a qualquer renderer ou serializer — cobrindo API/SEO/OG por construção.
- **Prós:** Um ponto de verdade por (recurso × papel); cobre todos os canais; testável isoladamente.
- **Contras:** Mais código de mapeamento; disciplina para nunca devolver entidade crua.

### Opção B — Filtragem no template/componente
- **Descrição:** Buscar a entidade completa e esconder campos na renderização.
- **Contras:** Vaza por API/JSON-LD/OG (must-not explícito); frágil; não testável fora do render. Rejeitada.

### Opção C — RLS no Postgres
- **Descrição:** Row-level security no banco.
- **Contras:** CLAUDE.md fixa **autorização na camada de app (sem RLS)**; RLS não resolve filtragem de *campos* nem anonimização derivada. Rejeitada para o MVP.

## Decisão

Adotamos a **Opção A**: **View Models por papel** como única forma de uma Pessoa enxergar dados de outra; acesso direto ao Prisma só quando a Pessoa vê os próprios dados. A anonimização e o recorte de campos acontecem **na montagem do View Model** (camada de query/serialização do servidor), nunca no template. Um **guard centralizado** (`requirePermission` + checagem de papel) protege campos sensíveis sociais, aplicado inclusive no serializer da visão consolidada (USP-039).

## Consequências

**Positivas:**
- Vazamento por canal lateral fechado por construção; satisfaz P-001/P-002 de USP-021/022 e os guards de USP-036/039/042.
- Testes "papel X não vê campo Y" cobrem cada View Model.

**Negativas (trade-offs aceitos):**
- Boilerplate de mapeamento por papel — encapsulado no runbook `runbook-view-model-visibility`.

**Neutras / a monitorar:**
- Acesso a dado sensível deve ser logado (ADR-0023) — evolução de auditoria de leitura prevista para V2.

## Referências

- ADR-0017 (negócio), ADR-0023 (auditoria de acesso), `runbook-view-model-visibility`.
- USPs servidas: USP-021, USP-022, USP-027, USP-028, USP-030, USP-031, USP-035, USP-036, USP-039, USP-041, USP-042.
