# USP-066 — Ver conteúdo integral do rascunho na fila de moderação — Specification

- **Issue:** _(a criar no board — protocolo OpenWolf)_ · **Épico:** Épico 4 — Moderação de Conteúdo
- **Prioridade:** P1 (Must) · **Feature pai:** `moderacao-conteudo`
- **Origem:** **Não** vem do PRD. Lacuna descoberta em staging (2026-08-15), classificada como
  **`falta-de-spec`** — PF-002 em `docs/qualidade/pontos-falhos-processo.md`
- **Spec ICE:** `docs/IDSD/ice-portal-asonseg/` — card `matriz-conexoes.md` (USP-066),
  `intents/intent-USP-066.md`, `expectations/expectations-USP-066.md`
- **Sizing:** **Large** (piso obrigatório do modo ICE — USP ICED **e** com must-nots). Design + Tasks
  obrigatórios; não pode ser rebaixada para Quick/Medium.

---

## 1. Modo ICE — esta spec é um adapter, não uma re-derivação

Os requisitos **são** os IDs do ICE (`E-001..E-006`, `P-001..P-005`). Esta seção não os reescreve: aponta
para eles. Nada que não seja alcançável a partir do card da USP-066 entra no escopo.

| Requisito | Fonte | Resumo |
|---|---|---|
| E-001 | expectations-USP-066 | Abrir item da fila exibe o conteúdo integral, antes da decisão, sem sair da fila |
| E-002 | expectations-USP-066 | `JOB`: título, descrição, requisitos, salário, jornada, localidade, Empresa |
| E-003 | expectations-USP-066 | `SERVICE`: título, descrição, categoria, área de atendimento, fotos |
| E-004 | expectations-USP-066 | `CANDIDATE_PROFILE`/`CV`: escolaridade, formação, experiência, habilidades, cursos + CV por URL assinada (TTL 5 min) |
| E-005 | expectations-USP-066 | Visualização de campo sensível registra `SENSITIVE_FIELD_VIEWED` |
| E-006 | expectations-USP-066 | Falha ao carregar ⇒ aviso claro + **aprovar desabilitado** (devolver/rejeitar seguem) |
| P-001 | expectations-USP-066 | ❌ "Aprovar" ativo sobre conteúdo não carregado/exibido |
| P-002 | expectations-USP-066 | ❌ Carregar/transmitir conteúdo de `ContentKind` fora da permissão — restrição no `select`, não na renderização |
| P-003 | expectations-USP-066 | ❌ Preview truncado/resumido/cacheado sem sinalizar |
| P-004 | expectations-USP-066 | ❌ Carregar conteúdo integral de todos os itens no render da fila |
| P-005 | expectations-USP-066 | ❌ Alterar status por via que não `transitionContent` |

## 2. Baseline a preservar (não pode regredir)

A USP-016 e a USP-017 estão implementadas e verdes. Esta USP **adiciona leitura**; não toca a decisão.

- Máquina de estados: `transitionContent`, `ContentKind`/`ContentStatus`, `TRANSITIONS` — intactos (P-005).
- `viewModerationQueue` (ordem por data de envio, autor≠moderador, `take`/`select`) — a query da **lista**
  não ganha campos de conteúdo (P-004).
- `VerificationPanel` da USP-017 e o gate de checklist (P-001 da USP-016) — inalterados.
- Gating de ação por `ContentKind` da USP-056 (`viewerModeratableKinds`) — reaproveitado, agora também
  para **leitura** (P-002).
- Suíte existente de `src/modules/moderation/**/__tests__/` permanece verde.

## 3. Contexto que restringe o desenho

Três fatos do repo que o desenho **não** pode ignorar:

1. **`content_items` do TD §4.5 nunca foi implementado.** O status mora na própria entidade (padrão
   `CandidateProfile`). Não existe tabela única de conteúdo para ler — a leitura é por tipo, via adapter
   registrado no `shared/container`, como já faz `DispatchingContentStatusRepository`.
2. **Anonimizar no View Model não basta (RSC/Flight).** Se a row crua for carregada e filtrada só na view,
   o campo restrito vaza no payload Flight. P-002 exige `select` condicionado ao papel no Prisma.
3. **ADR-0010 convenção 1:** ver dado de outra Pessoa é sempre via `viewXForY()`, nunca Prisma direto no
   componente/rota.

## 4. Critérios de aceite (mapeados 1:1 ao ICE)

- **AC-066-1** (E-001, E-002) — Moderador com permissão para `JOB` abre um item de vaga na fila e vê os
  campos de E-002 renderizados, sem navegar para outra rota.
- **AC-066-2** (E-003) — Idem para `SERVICE`, incluindo as fotos submetidas.
- **AC-066-3** (E-004) — Idem para `CANDIDATE_PROFILE`/`CV`, com link de CV por URL assinada de TTL 5 min.
- **AC-066-4** (E-005) — Abrir conteúdo de candidato grava `SENSITIVE_FIELD_VIEWED` com moderador,
  `contentId` e momento, na mesma transação da leitura.
- **AC-066-5** (E-006, P-001) — Com a carga de conteúdo falhando, o item mostra aviso e o botão "Aprovar"
  fica desabilitado; "Devolver" e "Rejeitar" seguem habilitados.
- **AC-066-6** (P-002) — Moderador sem permissão para `CANDIDATE_PROFILE` não recebe nenhum campo de PII
  desse tipo **no payload serializado** — asserção sobre o payload, não sobre a tela.
- **AC-066-7** (P-004) — Renderizar a fila com N itens não dispara N leituras de conteúdo nem N gerações de
  URL assinada; a carga é sob demanda ao abrir o item.
- **AC-066-8** (P-003) — Conteúdo longo permanece integralmente acessível (truncar exige "ver mais" explícito).

## 5. Fora de escopo

- Edição do conteúdo pelo moderador (o caminho continua sendo devolver para ajustes — USP-016 E-003).
- Diff entre versões do rascunho (não há versionamento de conteúdo no MVP).
- Preview de conteúdo já publicado (USP-018).

## 6. Gate de entrada

✅ **Liberado.** Sem dependência externa bloqueante: intent com dono definido, expectations fechadas, nenhuma
Q-aberta. Não há `Blocked by` ativo.
