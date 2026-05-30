# Análise de Reconciliação — Board (GitHub Project #3) × Documentação IDSD

> **Data:** 2026-05-30 · **Autor:** Claude Code · **Status:** ✅ APLICADO (ver §10)
> **Board:** https://github.com/orgs/DNACod3/projects/3 (DNACod3/asonseg-portal) · 221 itens
> **Fonte da verdade:** `docs/IDSD/` — PRD `prd/prd-asonseg-portal-mvp.md`, matriz `ice-portal-asonseg/matriz-conexoes.md`, `.specs/`, ADRs.

## 1. Escopo e decisões desta rodada

- **Itens considerados:** apenas **não finalizados** (Status `Backlog` ou `Ready`). Os 24 itens `Done` (Fase 0 — provisionamento, bootstrap, spikes, seed, termos LGPD v1.0 #224 etc.) ficam **fora de escopo**.
- **Decisões do PO (30/05):**
  1. **Reestruturar para os 13 épicos de domínio** da IDSD (hoje o board usa 8 épicos por *fase*).
  2. **A IDSD manda nas fases** — remapear.
  3. **Milestone = ÉPICO de domínio** (13 milestones, 1:1 com épico). A *fase* IDSD vira **label/metadado**. Filhos herdam o milestone do épico do pai.
  4. Profundidade: **estrutural + spot-check** de critérios/tasks.
- **Regra de milestone (reforçada pelo PO):** todo item novo herda o milestone do pai; todo épico novo ganha um milestone próprio e tudo abaixo dele nasce com esse milestone.

### Achado estrutural central
O board foi construído sobre um modelo **anterior** à rodada IDSD atual: épicos = **fases de entrega** (`[EPIC] Fase 0…6` + `Lançamento`, = os 8 milestones), com as 44 USPs e suas tasks aninhadas por fase. A IDSD atual organiza por **13 épicos de domínio** (matriz §1 / PRD §5.1) dentro de **3 fases** (ROADMAP). Reconciliar = trocar a camada de épico/milestone de *fase* → *domínio*.

---

## 2. Modelo-alvo (IDSD) — 13 épicos de domínio + 2 trilhas operacionais

Cada épico vira **1 milestone**. A coluna *Fase* é só label (ROADMAP IDSD).

| # Épico (milestone-alvo) | USPs | Fase (label) | Prio |
|---|---|---|---|
| **Épico 1 — Identidade, Acesso e Papéis** | USP-001…008, **USP-045** | Fase 1 | Must |
| **Épico 2 — Cadastros Públicos** | USP-009, 010, 011, **012** | Fase 1/2 | Must |
| **Épico 3 — Gestão de Vínculos Pessoa-Empresa** | USP-013, 014, 015 | Fase 2 | Must |
| **Épico 4 — Moderação de Conteúdo** | USP-016, 017, 018, 019 | Fase 2 | Must (019 Should) |
| **Épico 5 — Vagas** | USP-020…024 | Fase 2 | Must |
| **Épico 6 — Candidaturas e Busca de Candidatos** | USP-025…028 | Fase 2 | Must |
| **Épico 7 — Serviços** | USP-029…032 | Fase 2 | Must |
| **Épico 8 — Manifestação de Interesse em Serviço** | USP-033, 034, 035 | Fase 2/3 | Must (034 Should) |
| **Épico 9 — Ficha Social, Encaminhamento e Visão Consolidada** | USP-036…039 | Fase 3 | Must |
| **Épico 10 — Extração de CV via IA Generativa** | USP-040 | Fase 3 | Must |
| **Épico 11 — Indicadores e Relatórios** | USP-041, 042 | Fase 3 | Must |
| **Épico 12 — Conformidade LGPD (Consentimentos)** | USP-043 | Fase 1 | Must |
| **Épico 13 — Notificações por E-mail** | USP-044 | Fase 1 | Must |
| *(ops)* **Fundação Técnica & Infra** | setup, auditoria, hardening | Fase 0/contínua | — |
| *(ops)* **Lançamento / Go-Live** | UAT, runbooks, treinamento, cutover | Go-Live | — |

> As duas trilhas *ops* **não** são épicos de domínio da IDSD, mas são baldes necessários para os itens infra/lançamento que não pertencem a nenhuma USP. Mantêm a regra 1 épico = 1 milestone.
>
> ✅ **Decisão PO (30/05):** adotar as **2 trilhas operacionais** (Fundação Técnica & Infra + Lançamento/Go-Live). Total **15 milestones**. Auditoria #12-15 e hardening #200/201/203/205 → Fundação Técnica & Infra.

---

## 3. Milestones — o que fazer

Hoje há 8 milestones (fase). Alvo: 13 (domínio) + 2 (ops) = **15**.

| Milestone atual | Destino |
|---|---|
| Fase 0 — Setup e Spikes | **Renomear → "Fundação Técnica & Infra"** (21/22 itens já `Done`). |
| Fase 1 — Identidade + Consentimentos | **Dividir** entre Épico 1, Épico 12 (LGPD) e Épico 13 (Notif.) conforme a USP. |
| Fase 2 — Empresas + Vagas + Moderação | **Dividir** entre Épicos 3, 4, 5 (e USP-012 → Épico 2). |
| Fase 3 — Candidaturas + Busca + Extração de CV | **Dividir** entre Épico 2 (USP-009), 6 (025-028) e 10 (USP-040). |
| Fase 4 — Serviços + Manifestações | **Dividir** entre Épico 2 (USP-010/011), 7 (029-032) e 8 (033-035). |
| Fase 5 — Ficha Social… | **Renomear → Épico 9**. |
| Fase 6 — Relatórios + Home + Hardening + LGPD | **Dividir** entre Épico 11 (041/042), Épico 12 (LGPD #209…), Épico 13 (#194…) e "Fundação/Infra" (hardening #200/201/203/205). |
| Lançamento | **Manter → "Lançamento / Go-Live"**. |

**Criar (novos milestones):** Épico 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13 (Épico 9 reaproveita "Fase 5"). → **12 milestones novos**.

---

## 4. Épicos (issues `[EPIC]`) — o que fazer

| Épico-fase atual | Ação |
|---|---|
| #4 `[EPIC] Fase 0` | Reaproveitar como **`[EPIC] Fundação Técnica & Infra`**. |
| #5 `[EPIC] Fase 1` | **Inválido como épico** → converter em **`[EPIC] Épico 1 — Identidade`** (ou fechar e criar novo). |
| #6 `[EPIC] Fase 2` | **Inválido** → substituir por Épicos 3/4/5. |
| #7 `[EPIC] Fase 3` | **Inválido** → substituir por Épicos 2(parc.)/6/10. |
| #8 `[EPIC] Fase 4` | **Inválido** → substituir por Épicos 2(parc.)/7/8. |
| #9 `[EPIC] Fase 5` | Reaproveitar como **`[EPIC] Épico 9`**. |
| #10 `[EPIC] Fase 6` | **Inválido** → substituir por Épicos 11/12/13 + Infra. |
| #11 `[EPIC] Lançamento` | **Manter** como `[EPIC] Lançamento / Go-Live`. |

**Criar (novos épicos `[EPIC]`):** Épico 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13 (Épico 1 e 9 reaproveitam #5 e #9). → **11 épicos novos**.

---

## 5. Ajustes nas issues existentes (re-parent + re-milestone)

> Toda USP muda de épico-pai (fase → domínio) e de milestone (fase → épico). Tasks-filhas herdam o novo milestone. Tabela por USP (issue da US — as tasks acompanham):

| USP | Issue | Milestone atual | → Épico/Milestone-alvo | Observações |
|---|---|---|---|---|
| 001 | #16 | Fase 1 | Épico 1 | — |
| 002 | #52 | Fase 1 | Épico 1 | — |
| 003 | #58 | Fase 1 | Épico 1 | — |
| 004 | #63 | Fase 1 | Épico 1 | **Título** board "Autenticar com e-mail e senha" vs matriz "Login no portal" (PRD §5.2: "Autenticar no portal…"). Ver §6 (tasks). |
| 005 | #68 | Fase 1 | Épico 1 | — |
| 006 | #76 | Fase 1 | Épico 1 | — |
| 007 | #83 | Fase 1 | Épico 1 | Par da nova **USP-045** (reativar). |
| 008 | #91 | Fase 1 | Épico 1 | — |
| **045** | *(criar)* | — | Épico 1 | **NÃO existe no board.** Ver §7. |
| 009 | #31 | **Fase 3** | **Épico 2** | Mudança de fase relevante (era Fase 3 → Cadastros Públicos / Fase 1-2). |
| 010 | #110 | **Fase 4** | **Épico 2** | Idem. |
| 011 | #118 | **Fase 4** | **Épico 2** | Idem. |
| 012 | #124 | Fase 2 | **Épico 2** | Board agrupava com vínculos; PRD §5.1/matriz põem em Cadastros Públicos. |
| 013 | #129 | Fase 2 | Épico 3 | — |
| 014 | #133 | Fase 2 | Épico 3 | — |
| 015 | #139 | Fase 2 | Épico 3 | — |
| 016 | #117 | Fase 2 | Épico 4 | — |
| 017 | #155 | Fase 2 | Épico 4 | — |
| 018 | #158 | Fase 2 | Épico 4 | — |
| 019 | #166 | Fase 2 | Épico 4 | Should — marcar prioridade. |
| 020 | #161 | Fase 2 | Épico 5 | — |
| 021 | #169 | Fase 2 | Épico 5 | — |
| 022 | #172 | Fase 2 | Épico 5 | — |
| 023 | #174 | Fase 2 | Épico 5 | — |
| 024 | #177 | Fase 2 | Épico 5 | — |
| 025 | #51 | Fase 3 | Épico 6 | — |
| 026 | #62 | Fase 3 | Épico 6 | — |
| 027 | #73 | Fase 3 | Épico 6 | — |
| 028 | #77 | Fase 3 | Épico 6 | — |
| 029 | #180 | Fase 4 | Épico 7 | — |
| 030 | #190 | Fase 4 | Épico 7 | — |
| 031 | #195 | Fase 4 | Épico 7 | — |
| 032 | #202 | Fase 4 | Épico 7 | — |
| 033 | #207 | Fase 4 | Épico 8 | — |
| 034 | #216 | Fase 4 | Épico 8 | Should — marcar prioridade. |
| 035 | #219 | Fase 4 | Épico 8 | — |
| 036 | #132 | Fase 5 | Épico 9 | — |
| 037 | #143 | Fase 5 | Épico 9 | — |
| 038 | #149 | Fase 5 | Épico 9 | — |
| 039 | #152 | Fase 5 | Épico 9 | — |
| 040 | #82 | Fase 3 | Épico 10 | — |
| 041 | #179 | Fase 6 | Épico 11 | — |
| 042 | #186 | Fase 6 | Épico 11 | — |
| 043 | #30 | Fase 1 | Épico 12 | Consolidar com #209 (ver §6). |
| 044 | #194 | Fase 6 | Épico 13 | Consolidação de notificações. |

### 5.1 Referências defasadas nos corpos das issues (corrigir em massa)
Spot-check encontrou referências de uma **versão anterior** da documentação:
- **Caminhos de spec inexistentes:** ex. #63 cita `.specs/features/identity-acesso-papeis/spec.md`; #209 cita `.specs/features/consentimentos-lgpd/spec.md`; #194 cita `.specs/features/notificacoes-email/spec.md`. Na IDSD só existe **`.specs/features/usp-004-autenticar-no-portal/`**. → atualizar/remover os links.
- **Numeração de ADR antiga:** os corpos citam ADRs num esquema pré-IDSD (ex. #209 cita "ADR-0009 (LGPD)" e "ADR-0004 (append-only)"). Na IDSD: ADRs de **negócio 0001–0018** (`prd/ADR-*.md`) e **técnicos 0019–0030** (`architecture/adrs/`). LGPD = ADR-0013 (negócio); append-only = ADR-0023 (técnico); revogação cascata = ADR-0025; anti-abuso/lockout = ADR-0029; revalidação sessão = ADR-0030. → re-citar contra o índice IDSD.

---

## 6. Issues inválidas / a reconciliar

| Item | Situação | Recomendação |
|---|---|---|
| #5, #6, #7, #8, #10 (`[EPIC] Fase 1/2/3/4/6`) | Épicos por fase deixam de existir no modelo de domínio. | Converter/fechar — ver §4. |
| #209 "Revisão LGPD com DPO + painel de revogação" (US sintética, Fase 6) | **Sobrepõe** USP-043: seu #211 (painel + revogação) dobra com #39 (painel) e #37 (revokeConsent); seu #212 (direito de acesso) dobra com #42 (relatório art.19). O delta real é a **cascata de revogação (ADR-0025, DEC-015)** e a **revisão final do DPO**. | ✅ **Decisão PO (30/05) — FUNDIR e eliminar duplicata:** manter **#37/#39/#42** como base do Épico 12; **rebaixar #209** a uma task "cascata de revogação (ADR-0025) + revisão DPO"; **fechar #211/#212** como duplicatas (migrando qualquer delta — ex. a cascata — para as tasks-base); **#214** vira task de docs/DPO no Épico 12. |
| #200 "Hardening de segurança" + #201/#203/#205 (Fase 6) | Não é USP de domínio. | Mover para trilha **Fundação Técnica & Infra**. |
| #12/#13/#14/#15 "Fundação de Auditoria" (Fase 1) | Infra transversal (módulo `audit`), não é USP. | Mover para **Fundação Técnica & Infra** (ou manter ligado a Épico 12, já que sustenta LGPD/append-only). A decidir. |
| #194/#196/#198 (USP-044 consolidação) | Válidos, mas referenciam tasks de e-mail por-feature (#69, #146, #213). | Mover para **Épico 13**; manter as tasks de e-mail por-feature nos seus épicos de origem. |

> **Nenhuma USP foi removida da IDSD** — todas as 44 do board continuam válidas. A única "invalidez" é estrutural (épicos por fase) + a sobreposição LGPD.

---

## 7. Itens faltantes (criar)

1. **USP-045 — Reativar Pessoa (fluxo inverso da USP-007)** — Épico 1 / milestone "Épico 1".
   - Criada na fase de arquitetura IDSD (2026-05-29; matriz §1 + nota). **Não existe no board.**
   - ⚠️ A camada ICE (intent/expectations) e o quebra em tasks **ainda não foram gerados** (pendência da `po-bravi-idsd`). → criar a **US (shell)** agora com o milestone do Épico 1; tasks ficam TBD até a IDSD detalhar.
2. **12 milestones novos** (Épicos 1-8, 10-13 — ver §3).
3. **11 épicos `[EPIC]` novos** (Épicos 2-8, 10-13 — ver §4).
4. **Tasks de USP-004 mais granulares (opcional, ver §6 abaixo):** a IDSD detalha **13 tasks (T-00…T-12)** para USP-004; o board tem **3** (#64/#65/#66). Faltam, p.ex.: migration `auth_attempts` separada (T-01), catálogo `AUTH_*` (T-02), `LockoutGate` domínio puro (T-03), revalidação de sessão no middleware ADR-0030 (T-08), página `/trocar-senha` 1º acesso (T-09), teste anti-timing no CI (T-10), job de retenção `auth_attempts` Vercel Cron (T-11), carga sintética p/ D-001 (T-12). **Atenção:** USP-004 já está em implementação (commits de schema Credential, middleware stub, bcrypt) — várias T-tasks já estão parcialmente feitas; reconciliar sem recriar trabalho.

> **Tasks dos demais 43 USPs:** a IDSD **só gerou tasks para USP-004**. Para as outras USPs não há quebra em tasks na IDSD — logo as tasks atuais do board **não podem ser consideradas inválidas** por ausência de contraparte; ficam como estão (apenas re-milestone/re-parent).

---

## 8. Inconsistências encontradas DENTRO da própria IDSD (corrigir na doc)

- **USP-012 — épico divergente:** PRD §5.1 e matriz §1 → **Épico 2 (Cadastros Públicos)**; `ROADMAP.md` → Épico 3 (Vínculos). Adotado **Épico 2** (PRD+matriz). → corrigir tabela do ROADMAP.
- **USP-004 — título divergente:** matriz/ROADMAP "Login no portal" vs PRD §5.2 "Autenticar no portal com e-mail e senha". → padronizar.
- **Modelo de fases:** ROADMAP (3 fases + Go-Live) vs coluna técnica da matriz (Fase 1/2/3 com USP-009-012 em Fase 2) — pequenas divergências de janela. Como milestone = épico, isso só afeta o **label de fase**; usar o ROADMAP como referência.

---

## 9. Plano de aplicação (Fase 2 — após OK)

1. Criar os **12 milestones** de domínio (+ renomear "Fase 0"→Infra, "Fase 5"→Épico 9, "Lançamento"→Go-Live).
2. Criar/converter os **13 épicos `[EPIC]`** de domínio (+ 2 ops).
3. Re-parent + re-milestone das **44 USPs** e suas tasks (herdam o milestone do épico).
4. Criar **USP-045** (shell) no Épico 1.
5. Consolidar **LGPD** (Épico 12): reconciliar #209/#211/#212/#214 vs #37/#39/#42.
6. Mover infra/hardening (#12-15, #200/201/203/205) → Fundação Técnica & Infra.
7. Limpeza de corpos: spec paths e citações de ADR (§5.1).
8. (Opcional) Detalhar tasks da USP-004 conforme `tasks.md` (§7.4), sem recriar o que já foi implementado.
9. Marcar prioridade **Should** em USP-019 e USP-034.

> **Pendências de negócio que ainda bloqueiam (matriz §gate):** D-002 (8 termos LGPD — em aprovação jurídica) e a semântica da cascata de revogação (DPO). Não impedem a reorganização do board.

---

## 10. Log de aplicação (2026-05-30) — ✅ EXECUTADO

**Doc IDSD corrigida:** ROADMAP §Épicos (USP-012 → Épico 2; USP-013 a 015 → Épico 3) + §Fase 1; matriz §1 (título USP-004 → "Autenticar no portal com e-mail e senha").

**Board (GitHub Project #3 · DNACod3/asonseg-portal):**
- **Milestones (15):** renomeados os 8 de fase → Fundação Técnica & Infra, Épico 1, Épico 5, Épico 6, Épico 7, Épico 9, Épico 11, Lançamento / Go-Live; **criados 7** (Épicos 2, 3, 4, 8, 10, 12, 13).
- **Épicos (15 `[EPIC]`):** renomeados #4→Infra, #5→Épico 1, #6→Épico 5, #7→Épico 6, #8→Épico 7, #9→Épico 9, #10→Épico 11, #11→Go-Live; **criados** #231 (Ep2), #232 (Ep3), #233 (Ep4), #234 (Ep8), #235 (Ep10), #236 (Ep12), #237 (Ep13). Todos auto-adicionados ao board (Status=Backlog).
- **Re-parent (20 subárvores):** USP-009/010/011/012→Ep2; 013/014/015→Ep3; 016/017/018/019→Ep4; 033/034/035→Ep8; 040→Ep10; 043→Ep12; 044→Ep13; #12 (auditoria) e #200 (hardening)→Infra. **58 tasks-filhas** re-milestone junto.
- **USP-045 — Reativar Pessoa:** criada (#238) como shell no Épico 1 (sub-issue do #5), milestone Épico 1. ICE/tasks pendentes da `po-bravi-idsd`.
- **LGPD consolidado (Épico 12):** base mantida em USP-043 #30 (#33/#35/#37/#39/#42); **#209 rebaixado a task** "USP-043: cascata de revogação (ADR-0025) + revisão final LGPD com DPO" (sub-issue de #30); **#211 e #212 fechados** como duplicatas (de #39/#37 e #42); #214 (checklist DPO) mantido sob #209.
- **Ajustes:** título #63 padronizado; USP-019 (#166) e USP-034 (#216) já constavam "P2 (Should)".

**Validação:** 45 USPs (001-045) cada uma no épico/milestone correto; 0 itens sem milestone; 0 milestones "Fase" remanescentes; 229 itens (221 + 7 épicos + USP-045; #211/#212 fechados).

### Segunda rodada (2026-05-30) — pendências mecânicas APLICADAS ✅
- **Limpeza de corpos:** **55 issues** corrigidas. Caminhos `.specs/features/<slug>/…` (inexistentes) → `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` (0 dangling restantes). ADRs do esquema antigo remapeados (só os inequívocos): append-only `0004→0023`, LGPD `0009→0013`, CAPTCHA/Turnstile `0014→0029`, backup `0006→0019`. Os que já batiam (0008 retenção, 0013 LGPD, 0015 moderação, 0018 CV) foram preservados.
- **Bodies dos épicos reaproveitados (#4-#11):** reescritos com identidade de domínio (USPs, fase-label, fonte IDSD, DoD); trilhas ops (#4 Infra, #11 Go-Live) com template próprio.
- **Tasks da USP-004 (T-00..T-12):** criadas as 3 forward-looking faltantes — #239 (/trocar-senha, T-09), #240 (retenção `auth_attempts`, T-11), #241 (carga sintética D-001, T-12), como sub-issues de #63 (milestone Épico 1). #63 ganhou o **mapa de rastreabilidade** T-00..T-12 (itens de plataforma agrupados em #64; T-00/T-02/T-08/T-10 já entregues em commits). Nota de agrupamento adicionada a #64. **Não recriei** tasks já implementadas em código (evita duplicar trabalho em andamento).

> Total no board após 2ª rodada: **232 itens** (229 + 3 tasks USP-004). Issues abertas com referência a spec/ADR defasada: **0**.
