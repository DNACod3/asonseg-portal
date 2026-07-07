# ADR-0017 (Técnico) — Nota de conformidade da fundação (Fase 0 — Fundação)

- **Status:** Aceito
- **Data:** 2026-07-06
- **Decisores:** Bravi Arquiteto/Tech Lead
- **Tags:** conformidade | fundacao | debito-documentado

## Contexto e Problema

A fundação do Portal (`src/shared`, template de módulos, regra de barrel, raiz
`src/` fechada, `prisma/`) foi construída incrementalmente ao longo das Fases
1-2. A unidade **Fase 0 — Fundação** (`.specs/features/fase-0-fundacao/`)
reconciliou o código com `CLAUDE.md`/`docs/arch/project-guideline.md` via
refactor + guardas estáticas (T-A1/T-A2/T-A3/T-A4) e, no processo, encontrou
mismatches entre o que os docs canônicos prescrevem literalmente e decisões
que já existiam (deliberadas, mas não centralizadas num único registro) ou que
são deferimentos aceitos para USPs futuras. Esta nota concilia cada um, para
que "está diferente do guideline" pare de ser lido como drift não-intencional.

## Exceções à regra de barrel (`@/modules/<x>`, nunca `@/modules/<x>/<subpath>`)

A regra (lint `no-restricted-imports` + guarda estática
`src/shared/__tests__/no-deep-module-imports.test.ts`, F0-MN-02) tem **dois**
carve-outs documentados, ambos com `// eslint-disable-next-line
no-restricted-imports` + comentário de justificativa no próprio ponto de
import — a guarda trata isso como exceção revisada, nunca como violação:

1. **Composition root (`src/shared/container.ts`)** — préexistente, fora de
   `src/modules/**`. Resolve os bindings porta→adapter de todos os módulos;
   importar pelo barrel criaria um ciclo `barrel → container → barrel`. ~20
   deep-imports documentados (linhas 61-129).
2. **Fronteira client/server em Client Components (`persons/components/
   {candidate-form,provider-form}.tsx`)** — descoberto e confirmado durante a
   T-A1 desta unidade. Os 3 imports de `@/modules/identity/actions/
   activate-additional-role` e `@/modules/identity/domain/role-activation`
   **não podem** ser roteados pelo barrel `@/modules/identity`: o barrel
   reexporta `./server/session` (→ `supabase/server.ts` → `next/headers`) e,
   via `./ports/captchaVerifier`, `container.ts` (→
   `next-cache-invalidation.ts` → `next/cache`) — código server-only que o
   Next se recusa a empacotar no bundle do cliente. **Verificado
   empiricamente**: substituir o deep-import pelo barrel quebra `npm run
   build` (`Failed to compile` — "You're importing a component that needs
   'next/headers'/'revalidatePath'..."). O arquivo de origem do import tem
   `'use server'`, então o import direto vira um stub RPC client-safe — a
   mesma mecânica que o composition root evita do outro lado da fronteira.

**Regra geral daqui para frente:** um deep-import de módulo só é aceito se (a)
for o composition root, ou (b) for um Client Component importando uma Server
Action/tipo puro que o barrel não consegue expor sem arrastar código
server-only — e em ambos os casos o ponto de import carrega o
`eslint-disable-next-line no-restricted-imports` + comentário explicando o
porquê. Qualquer outro caso é violação e a guarda F0-MN-02 falha.

## Localização real dos ADRs

O guideline (`project-guideline.md` §"Checklist de PR", linha 676/707) cita
`docs/adr/NNNN-<titulo>.md` como destino de novos ADRs. **Não existe**
`docs/adr/` no repositório — os 16 ADRs técnicos vivem em `docs/arch/0001..
0016-*.md`, ao lado de `architecture-document.md`, `project-guideline.md` e
`technical-design.md`. Esta nota (0017) segue a localização **real**
(`docs/arch/`), não o texto do guideline. O guideline será corrigido para
apontar `docs/arch/` numa próxima passada de manutenção de docs — não é um
gap de código desta unidade, é dívida de doc registrada aqui para não se
perder.

## `runbooks/` ausente

O guideline (§19) especifica uma pasta `runbooks/` na raiz do repo com 9
runbooks operacionais nomeados (`restore-from-backup.md`,
`inspect-empresa-fantasma.md`, etc.). Essa pasta **não existe** — os runbooks
reais de Fase 0 vivem em `docs/infra/*` (provisionamento por serviço) e,
agora, em `docs/infra/fase-0-provisioning-runbook.md` (T-C1, índice único).
Dívida documentada, não bloqueia esta unidade: os runbooks operacionais
citados pelo guideline (restore, reivindicação de credencial, LGPD, troca de
LLM/CAPTCHA, upgrade de modelo) pertencem às USPs/fases que os motivam
(ex.: `troca-de-provedor-llm.md` → USP-040; `restore-from-backup.md` →
drill B2/ADR-0006, referenciado em `docs/arch/dr-restore-drill.md`). Migrar
para `runbooks/` (ou consolidar a nomenclatura) fica para quando o segundo
runbook real de operação nascer — hoje só o de provisionamento (T-C1) existe.

## Módulos ausentes/skeletais (deferidos às USPs donas)

Os 11 módulos canônicos citados em `CLAUDE.md` são
`identity | persons | companies | consents | moderation | jobs | services |
referrals | cv-extraction | audit | reporting`. Nesta unidade:

| Módulo | Estado | Deferimento |
| ------ | ------ | ----------- |
| `services` | Ausente (sem pasta) | USP-029+ cria a infra quando a implementar (AD-005/AD-009: "a US que precisa primeiro cria a infra") |
| `referrals` | Ausente | USP-033+ |
| `cv-extraction` | Ausente | USP-040 (ADR-0012 — abstração de LLM); migrations/adapters nascem junto com a US |
| `reporting` | Skeletal (sem `queries/domain/components`) | USPs de relatório da Fase 5+ completam a estrutura |
| `persons` | Skeletal (sem `queries/`) | Completa-se conforme as USPs de leitura de Pessoa (ex.: USP-011) precisarem |

**Não fazemos scaffolding prematuro** dessas pastas nesta unidade: colidiria
com as migrations e o desenho de porta/adapter que cada USP dona vai definir.
Isso é o mesmo racional de AD-005/AD-009 já registrado em
`.specs/project/STATE.md`.

## Referências

- `.specs/features/fase-0-fundacao/spec.md` (A-01, A-02, A-07)
- `.specs/features/fase-0-fundacao/design.md` (Risks & Concerns)
- `CLAUDE.md`, `docs/arch/project-guideline.md`
- `src/shared/container.ts`, `src/modules/persons/components/{candidate-form,provider-form}.tsx`
- `src/shared/__tests__/no-deep-module-imports.test.ts` (F0-MN-02)
