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
- **AC-066-4** (E-005) — Abrir conteúdo de candidato (`CANDIDATE_PROFILE`) registra `SENSITIVE_FIELD_VIEWED`
  (ator = moderador, `entityId` = `contentId`, momento) ao **servir** o conteúdo, **fail-closed**: se a
  gravação de auditoria falhar, o conteúdo não é entregue. Reusa o padrão audit-on-read de
  `src/modules/jobs/queries/list-job-applicants.ts` (`withAudit`/`recordAuditEvent`) — não abre write-path de
  status (P-005). _(Refinado do "mesma transação da leitura" original: E-005 exige o registro do acesso, não
  atomicidade read-inside-tx; o precedente do repo audita ao servir, não dentro da leitura.)_
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

## 6. Premissas registradas (modo autônomo)

Ambiguidades resolvidas como premissas (dono = `agent` em todas → **não** disparam o Entry Gate). Confirmável pelo
dono do intent no UAT; nenhuma bloqueia o desenvolvimento.

| Premissa / decisão | Dono | Default escolhido | Racional | Confirmada? |
|---|---|---|---|---|
| **Carga sob demanda** (não em lote no render) reconcilia E-001 + P-004 | agent | Server Action `openModerationContent` disparada ao "Ver conteúdo" do item; `page.tsx` nunca carrega conteúdo | Diverge do precedente `VerificationPanel` (carrega no render da página) **porque P-004 proíbe** carga em lote de conteúdo; on-demand também satisfaz P-002 (row restrita nunca entra no payload Flight da página) | n |
| **E-002 "Empresa"** = identidade pública da Empresa (razão social / nome fantasia) | agent | Exibir o nome da Empresa como no detalhe público; CNPJ/dados de verificação seguem no `VerificationPanel` da USP-017 (bloco separado, P-002 daquela USP) | "Como será publicado" = nome público; não duplicar o painel de verificação de Empresa | n |
| **E-003 "área de atendimento"** = `Service.region.name` (+ `availabilityDescription`) | agent | Mapear a região (single-region MVP) como área de atendimento e exibir `availabilityDescription` (dias/horários); reusar a seleção de campos de `viewServiceDetail` | O schema não tem campo literal "área de atendimento"; a região é o proxy geográfico e o que o detalhe público mostra | n |
| **`ContentKind.CV`** (kind isolado) sem model real — **REVISADA (A2/PR#294)** | agent | Conteúdo de candidato (incl. arquivo de CV via `cvStoragePath`) é servido pela leitura de `CANDIDATE_PROFILE`; kind `CV` isolado → sem reader registrado → E-006 gracioso **na leitura**. A premissa original não previu a consequência no gate de Aprovar (P-001): `contentState !== 'loaded'` para QUALQUER kind travava "Aprovar" para sempre num item `CV` (nenhum reader ⇒ sempre `NOT_FOUND` ⇒ sempre `error`, nunca `loaded`). Revisão: novo `CONTENT_KINDS_WITH_READER` (`moderation/domain/`) — só kinds com reader real exigem `contentState==='loaded'` antes de Aprovar; `CV` não exibe painel "Ver conteúdo" (não há corpo de conteúdo além do `title`, já visível no card) e Aprovar não é mais bloqueado por um carregamento que nunca aconteceria | `_moderation_fixture` vazio em prod (precedente USP-056); não há item `CV` real na fila hoje — mas a invariante "nenhum item que a fila lista pode ficar permanentemente não-aprovável" precisa valer independente disso | n |
| **Audit-on-read fail-closed** em vez de "mesma tx da leitura" | agent | `withAudit('SENSITIVE_FIELD_VIEWED', …)` ao servir conteúdo de candidato; falha ⇒ não entrega | E-005 exige o registro do acesso, não atomicidade read-inside-tx; alinha ao precedente `list-job-applicants.ts` | n |
| **ctx do audit**: `actorPersonId` obrigatório; `ip`/`userAgent` best-effort — **REVISADA (A4/PR#294)** | agent | `ip`/`userAgent` deixam de ser "se houver helper, senão omitir" e passam a **sempre** ser capturados via `headers()`/`clientIp` (mesmo preâmbulo do precedente `list-job-applicants.ts`), antes do `withAudit` | ADR-0004 passo 2 lista a captura de `actor_ip` como obrigatória, não best-effort; a mitigação do Risco 1 do ADR-0005 para a URL assinada de CV é literalmente "audit log com IP", e `audit_log` é append-only — sem o IP, o contexto não é recuperável depois | n |
| **Painel de conteúdo só no bloco `canModerate`** (USP-056) | agent | Renderizar o `ModerationContentPanel` dentro do ramo `canModerate`; kinds fora da permissão do viewer mantêm a nota "sem permissão" (nenhum "Ver conteúdo") | Defesa em profundidade: gate de UI (USP-056) + gate autoritativo `requirePermission` na action (P-002) | n |
| **Leitura dos 3 readers escopada a `IN_MODERATION`** — **REVISADA (A1/PR#294)** | agent | Os readers de JOB/SERVICE/CANDIDATE_PROFILE originalmente liam por `id`/`personId` sem filtro de status ("o item já chega `IN_MODERATION` pela fila"). Revisão: `findFirst` com `status`/`publicationStatus: IN_MODERATION` explícito em cada reader (índices já existentes) — fora do estado ⇒ `null` ⇒ `NOT_FOUND` (E-006), mesmo contrato de antes | A Server Action é um endpoint: `contentId` vem do cliente e só é validado como UUID. Sem o filtro, qualquer portador da permissão do kind lia conteúdo (PII+URL assinada de CV no caso de candidato) de item fora do que a fila jamais listaria — minimização (ADR-0010/LGPD) violada mesmo com o gate de permissão correto | n |
| **E-002 "jornada"** sem campo literal no schema — **nova (B2/PR#294)** | agent | `Job` não tem campo de jornada (horário/carga horária). Exibir o mais próximo já disponível: `workRegime` ("Regime" — presencial/remoto/híbrido) + `contractType` ("Tipo de contrato" — CLT/PJ/MEI), já renderizados em `JobDetails` | Não há dado de "jornada" (ex.: "Seg-sex, 8h-17h") em nenhum campo de `Job`; criar um campo novo seria migração fora do contrato inviolável da task (sem entidade/migração nova). `workRegime`/`contractType` são o substituto mais próximo do que a spec original nomeou | n |

## 7. Must-nots (rastreabilidade — IDs canônicos do ICE)

Cada proibição vira um AC negativo com teste negativo próprio. IDs = `P-001..P-005` do ICE (não se cunha ID paralelo).

| ID | WHEN … THEN system SHALL NOT | Previne | Task dona | Teste negativo |
|---|---|---|---|---|
| **P-001** | oferecer "Aprovar" para item cujo conteúdo não foi carregado e exibido | F1 (moderação vira carimbo) | T9 | carga falha/ausente ⇒ Aprovar desabilitado; devolver/rejeitar seguem |
| **P-002** | carregar/transmitir conteúdo de `ContentKind` fora da permissão do viewer | F2 (vazamento de PII) | T6 | moderador só-`JOB` pede `CANDIDATE_PROFILE` ⇒ **sem campo de PII no payload** serializado |
| **P-003** | exibir versão truncada/resumida/cacheada sem sinalizar | F3 (preview ≠ publicado) | T7 | conteúdo longo ⇒ texto integral acessível na saída |
| **P-004** | carregar conteúdo integral de todos os itens no render da fila | F4 (fila degradada) | T9 (+T8) | render de N itens ⇒ 0 leituras de conteúdo / 0 URLs assinadas |
| **P-005** | alterar status a partir da tela de detalhe por via ≠ `transitionContent` | F1 (burlar a FSM) | T6 | abrir conteúdo não muda `status`/`publicationStatus` |

## 8. Rastreabilidade de requisitos

| Requisito (ICE) | AC | Task(s) | Status |
|---|---|---|---|
| E-001 | AC-066-1 | T6, T8, T9 | Pending |
| E-002 (JOB) | AC-066-1 | T2, T7 | Pending |
| E-003 (SERVICE) | AC-066-2 | T3, T7 | Pending |
| E-004 (CANDIDATE_PROFILE/CV + URL assinada) | AC-066-3 | T4, T7 | Pending |
| E-005 (`SENSITIVE_FIELD_VIEWED`) | AC-066-4 | T6 | Pending |
| E-006 (falha ⇒ aviso + aprovar off) | AC-066-5 | T8, T9 | Pending |
| P-001 | AC-066-5 | T9 | Pending |
| P-002 | AC-066-6 | T6 | Pending |
| P-003 | AC-066-8 | T7 | Pending |
| P-004 | AC-066-7 | T9, T8 | Pending |
| P-005 | — | T6 | Pending |

**Cobertura:** 11 requisitos ICE, todos mapeados a task (0 órfãos). Fundação (tipo/port T1; adapters T2–T4; dispatcher+container T5) sustenta E-002..E-005.

## 9. Gate de entrada

✅ **Liberado.** Sem dependência externa bloqueante: intent com dono definido, expectations fechadas, nenhuma
Q-aberta, todas as premissas §6 com dono `agent`. Não há `Blocked by` ativo (deps USP-016/USP-056 já em master).
