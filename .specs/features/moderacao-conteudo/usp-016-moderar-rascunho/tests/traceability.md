# USP-016 — Moderar rascunho — Matriz de rastreabilidade (AC → fact)

Fonte: `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-016.md` + issue #117 (ACs verbatim) + ADR-0011/ADR-0024.
Status dos facts: **Red** (gerados via skill-tdad, 2026-06-10). Cobertura em escopo: **11/11** requisitos com fact.

| Req (ICE) | AC / texto verbatim | Tipo de fact | Cenário BDD (`@tag`) | Teste (path-alvo) | Sub | Status |
|---|---|---|---|---|---|---|
| **E-001** | Acessar a fila → listar `IN_MODERATION` ordenados por data de envio, com indicador de tipo | unit + componente + E2E | `@e-001` | `moderation/queries/__tests__` + `tests/unit` (`fila`) | #123 | 🔴 Red |
| **E-002** | Aprovar → `ACTIVE` via `transitionContent` + e-mail ao autor | integração + E2E | `@e-002` | `moderation/__tests__/transition-content.int` + `decide.int` | #122/#123 | 🔴 Red |
| **E-003** | Devolver → exigir motivo significativo + `AWAITING_ADJUSTMENTS` + e-mail com motivo | integração | `@e-003` | `moderation/__tests__/decide.int` | #122/#123 | 🔴 Red |
| **E-004** | Rejeitar → exigir motivo + `REJECTED` + e-mail com motivo | integração | `@e-004` | `moderation/__tests__/decide.int` | #122/#123 | 🔴 Red |
| **AC5** | Decisão registra audit log na mesma transação | integração | `@ac-5` | `moderation/__tests__/transition-content.int` | #122 | 🔴 Red |
| **AC6** | Transição validada pela máquina de estados; nunca update direto no Prisma | unit | `@ac-6` | `moderation/domain/__tests__/transition-rules` | #121/#122 | 🔴 Red |
| **P-003** | Motivo ≥ 20 chars significativos; rejeita vazio/`x`/`—`/`ok`/`ajustar` | schema Zod + unit | `@p-003` | `moderation/schemas/decision` + `tests/unit` | #123 | 🔴 Red |
| **P-005** | Autor do conteúdo não pode ser o moderador — item não aparece na fila dele | unit (query) | `@p-005` | `moderation/queries/__tests__/moderation-queue` | #123 | 🔴 Red |
| **P-006** | Toda moderação passa pelo registro de auditoria — `transitionContent` única via | integração | `@p-006` | `moderation/__tests__/transition-content.int` | #122 | 🔴 Red |
| **P-007** | Sem permissão correspondente → não pode moderar | integração | `@p-007` | `moderation/__tests__/decide.int` | #123 | 🔴 Red |
| **L-001** | Listagem ≤ 2s p95; submit ≤ 2s p95 | NFR (`take`+`select`) | — | `it.todo` em `tests/unit` | #123 | 🔴 Red (todo) |
| **L-003** | Log imutável (append-only) com decisor/item/decisão/motivo/data | integração | `@ac-5` | coberto por AC5 + `audit_log` REVOKE | #122 | 🔴 Red |

## Casos obrigatórios de Server Action (project-guideline §12)

| Caso | Onde | Status |
|---|---|---|
| Happy path | `@e-002`/`@e-003`/`@e-004` | 🔴 Red |
| Validação Zod | `@p-003` (motivo) | 🔴 Red |
| Permissão recusada | `@p-007` | 🔴 Red |
| Concorrência | `@ac-6 @concorrencia` (2ª decisão falha) | 🔴 Red |
| Consentimento ausente | N/A — decisão de moderação não é finalidade LGPD | — |

## Lacunas / decisões pendentes (não bloqueiam o Red; bloqueiam Execute/go-live)

| ID | Lacuna | Destino |
|---|---|---|
| **GAP-1** | 4 eventos de auditoria (`CONTENT_APPROVED`/`_RETURNED_FOR_ADJUSTMENTS`/`_REJECTED`/`_SUBMITTED_TO_MODERATION`) | adicionar ao catálogo `@/modules/audit/events` (#122) |
| **GAP-2** | ✅ Verificado (2026-06-10): enum **não existe** no schema | #121 é owner; USP-009/#36 e demais reusam |
| **GAP-8** | ⚠ Nenhum model de conteúdo existe (só `Company`); `transitionContent` lê/escreve `status` inexistente | `ContentStatusRepository` (port) + 1 adapter mínimo/fixture (#122) |
| **GAP-3** | Port de notificação — adapter real + templates | **USP-044** (stub no-op nesta US) |
| **GAP-4** | Hook de Empresa verificada (flag `isVerified`) | **USP-017** (stub no-op nesta US) |
| **GAP-5** | E-005/P-001 alerta de fila (>10 ou >48h) | **Diferido** — sem SLA no MVP (TD §8.3) |
| **GAP-6** | ✅ Resolvido (2026-06-10): #123=8h, pai #117=20h (Σ=4+8+8) | — |
| **GAP-7** | IDs do catálogo de permissões de moderação (D-006) | constante nomeada + TODO até D-006 fechar |

## Cross-US (fora do escopo da USP-016)

| Item | AC | Destino |
|---|---|---|
| Painel de verificação de Empresa "não verificada" | P-002 | **USP-017** (`@cross-us @usp-017`) |
| Atalho para inativar conteúdo publicado | P-004 | **USP-018** (`@cross-us @usp-018`) |
| Entrega real de e-mail (Resend + templates) | E-002/E-003/E-004 (canal) | **USP-044** |
