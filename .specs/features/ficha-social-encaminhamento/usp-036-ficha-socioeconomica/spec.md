# USP-036 — Cadastrar ficha socioeconômica da Pessoa (Specification)

> **Fonte da verdade (upstream, não re-derivar).** Esta USP adapta a spec de épico
> `.specs/features/ficha-social-encaminhamento/spec.md` (história P1 "Cadastrar ficha
> socioeconômica da Pessoa", AC-036-1..4 + edge cases). Os IDs de rastreabilidade
> **`SOC-01` e `SOC-02`** do épico são canônicos aqui — não invento um conjunto paralelo.
> ACs alinhadas ao PRD `docs/prd/prd-asonseg-portal-mvp.md` §"Épico 9 / USP-036"
> (AC-036-1/2/3) e ao PROJECT.md §LGPD ("criptografia em repouso de dados sensíveis").
> Contratos técnicos pré-definidos: `docs/arch/technical-design.md` §Fase 5
> (tabela `socioeconomic_records`, View Model `viewPersonForSocialAssistant`).

**Unidade:** U1 da Fase 5 · **Epic:** `ficha-social-encaminhamento` · **Deps:** USP-002 · **Gate:** —
**Módulo dono:** `persons` (dado social escopado à Pessoa, mantido pela AS).

---

## Problem Statement

A ASONSEG não tem hoje um registro estruturado da situação socioeconômica das Pessoas
que atende. A assistente social (AS) precisa cadastrar e editar uma ficha mínima (renda
aproximada, benefício social recebido, situação de moradia, composição familiar declarada)
para dar contexto ao acompanhamento social e às decisões de encaminhamento (USP-037+).
Esses são **dados pessoais sensíveis (LGPD)** — exigem criptografia em repouso, acesso
restrito a AS/diretoria e log de toda alteração e acesso.

## Goals

- [ ] AS cadastra, edita e visualiza a ficha socioeconômica mínima de uma Pessoa (os 4 campos declarados).
- [ ] Dados socioeconômicos tratados como sensíveis: criptografia em repouso, acesso restrito a `SOCIAL_ASSISTANT`/`BOARD`, e log append-only de alterações (autor + data).
- [ ] A leitura da ficha é servida por um serializer/View Model reutilizável pela USP-039 (visão consolidada), que omitirá os campos sensíveis para o coordenador.

## Out of Scope

| Feature | Reason |
|---|---|
| Entidade Família estruturada (vínculos modelados) | Fora do MVP → Release 2 (ADR-0012). Composição familiar é só texto/número declarado. |
| Encaminhamento da Pessoa para vaga (USP-037) | Unidade seguinte da mesma fase; USP-036 entrega só a ficha. |
| Visão consolidada `viewPersonForSocialAssistant` (USP-039) | Downstream; USP-036 entrega o serializer da ficha que a 039 comporá, não o painel. |
| Model `Referral` / resultado do encaminhamento (USP-037/038) | Downstream. |
| Triagem/classificação social automatizada | Ficha é registro declarado, mantido manualmente. |
| Criptografia de coluna/aplicacional (pgcrypto/AES app-side) | Arquitetura difere ("se decidido", arch-doc §4.3) — decisão de arquitetura/diretoria, não desta USP. Ver Assumptions #1. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|---|
| 1 | **Criptografia em repouso (AC-036-4) = encriptação gerenciada da plataforma Supabase (disco), NÃO coluna/aplicacional.** | agent (upgrade é decisão de **arquitetura/diretoria**) | Confiar na encriptação-at-rest gerenciada do Supabase, exatamente como `candidate_profiles` (ADR-0012, §"payload sensível") — coluna `String`/enum em claro no nível SQL, cifrada no disco pela plataforma. | Único precedente **implementado**; arch-doc §4.3 deixa coluna/app-level explicitamente **deferido** ("se decidido", e só p/ CPF); TD/guideline/ADR-0009 nunca prescrevem coluna. Introduzir pgcrypto/chave nova seria abordagem net-new fora do escopo da USP. **A implementação NÃO depende disso** (é totalmente implementável no precedente) → **não abre Entry Gate**. **Gap residual flagado** (ver Must-Nots e Risks no design): valores legíveis em claro a qualquer leitor autorizado do DB / dump pré-cifra de backup. Controles compensatórios que ESTA USP entrega: acesso restrito (MN-01) + auditoria de acesso/alteração (MN-02). | n |
| 2 | **Base legal / consentimento do titular para a ficha.** O passo `requireActiveConsent` da sequência canônica é **N/A** para o cadastro da ficha pela AS. | agent (base legal confirmável por **DPO/diretoria**) | Não exigir consentimento ativo do titular para a AS cadastrar/editar a ficha. Base = legítimo interesse / mandato institucional (PROJECT.md §LGPD; finalidade `SOCIAL_ASSISTANCE` existe mas governa auto-ativação de papel, não o registro pela AS). | Edge case do épico permite Pessoa **sem credencial** ser referenciada em ficha social; exigir consentimento ativo bloquearia o caso de uso central (Pessoa sem e-mail/senha não consegue aceitar). Protege via acesso restrito + auditoria + cripto. Não bloqueia implementação. | n |
| 3 | **Mecanismo RBAC = guarda de papel inline (`SOCIAL_ASSISTANT`/`BOARD`), NÃO `PermissionId` delegável.** | agent | Guarda de domínio `canManageSocioeconomicRecord(roles)` (espelha `canRegisterAssisted` de `register-person-by-assistant.ts`). | A ficha é capacidade **intrínseca ao papel** (AS/diretoria), não delegável a voluntário (diferente de `REFER_PERSON_TO_JOB`). Pôr no catálogo `PermissionId` implicaria delegabilidade indevida. Precedente direto: registro assistido usa exatamente esse gate p/ as mesmas 2 roles. | y |
| 4 | **Diretoria (`BOARD`) pode ver E editar a ficha (não só ver).** | agent | `BOARD` tem o mesmo acesso da AS (ver+editar). | AC-036-3 lista AS+diretoria como autorizados a **acessar**; a spec nunca nega edição à diretoria; modelar permissão view-only separada p/ BOARD adiciona complexidade que a USP não pede. | y |
| 5 | **Renda aproximada = enum de faixa (`IncomeBracket`), não valor decimal livre.** | agent | Enum `{ NO_INCOME, UP_TO_1_MW, FROM_1_TO_2_MW, FROM_2_TO_3_MW, ABOVE_3_MW, UNDECLARED }`. | "aproximada" ⇒ faixa; evita renda exata; habilita relatórios (MP). Alternativa (decimal livre) descartada por precisão desnecessária. | y |
| 6 | **Situação de moradia = enum `HousingSituation`.** | agent | `{ OWNED, RENTED, GRANTED, FAMILY, HOMELESS, OTHER }` (própria/alugada/cedida/familiar/situação de rua/outra). | Conjunto finito conhecido; estruturado é mais consultável que texto livre. | y |
| 7 | **Benefício social e composição familiar = texto declarado (nullable).** | agent | `socialBenefit String?` (nome/descrição do benefício; null = não recebe/não declarado); `familyComposition String?` (texto/número, `maxlen`). | Épico é explícito: composição familiar é "texto/número declarado, sem entidade Família". Benefício mantido simples (sem taxonomia — sem triagem no MVP). | y |
| 8 | **Auditoria de acesso à ficha (leitura) via `SENSITIVE_FIELD_VIEWED`.** | agent | Registrar `SENSITIVE_FIELD_VIEWED` ao decifrar/retornar os campos sensíveis na leitura. | Problem statement do épico exige "log de toda alteração **e acesso**"; precedente USP-035 (audit-on-read). | y |

**Open questions:** none — todas resolvidas ou registradas acima. Nenhum item com owner **externo** de que a implementação **dependa** → **Entry Gate fechado** (ver `tasks.md` §0). Assumptions #1 e #2 são flagadas ao dono no retorno do Planner por serem LGPD-adjacentes, mas não bloqueiam (default = precedente/edge case).

---

## User Story

### P1: Cadastrar ficha socioeconômica da Pessoa ⭐ MVP

**User Story**: Como **assistente social**, quero cadastrar e editar dados socioeconômicos da
Pessoa (renda aproximada, benefício social recebido, situação de moradia, composição familiar
declarada) para que eu mantenha o registro social mínimo para encaminhamento e acompanhamento.

**Why P1**: Prioridade *Must* no PRD (USP-036). Registro social mínimo que habilita o
acompanhamento institucional e dá contexto à decisão de encaminhamento (USP-037+).

**Acceptance Criteria** (SOC-01 = AC-1,AC-2; SOC-02 = AC-3,AC-4):

1. **[SOC-01]** WHEN a AS (papel `SOCIAL_ASSISTANT` ou `BOARD`) acessa o cadastro social de uma Pessoa THEN o sistema SHALL exibir os campos: renda aproximada, benefício social recebido, situação de moradia e composição familiar declarada (texto/número).
2. **[SOC-01]** WHEN a AS edita a ficha a qualquer momento THEN o sistema SHALL persistir a alteração (upsert, 1 ficha por Pessoa) e registrar log append-only da alteração incluindo autor (`actorPersonId`) e data (via `withAudit(SOCIAL_SHEET_CREATED|SOCIAL_SHEET_UPDATED)`).
3. **[SOC-02]** WHEN uma Pessoa sem papel `SOCIAL_ASSISTANT` nem `BOARD` (ex.: `COORDINATOR`, `VOLUNTEER`, `CANDIDATE`) tenta acessar os dados sociais THEN o sistema SHALL impedir o acesso (`FORBIDDEN`) e não retornar nenhum campo sensível.
4. **[SOC-02]** WHEN a ficha socioeconômica é persistida THEN o sistema SHALL armazená-la com criptografia em repouso — satisfeita pela **encriptação gerenciada da plataforma Supabase** (mesmo tratamento de `candidate_profiles`, ADR-0012). *Verificação = referência de configuração/ADR (infra), não teste de código — ver nota no `tasks.md`.*

**Independent Test**: Logado como AS, abrir o cadastro social de uma Pessoa, preencher os quatro
campos, salvar e reabrir confirmando a persistência e o registro de log (autor+data no `audit_log`);
em seguida, logar como voluntário comum e confirmar que o acesso aos dados sociais é negado.

---

## Edge Cases

- WHEN a AS edita a ficha de uma Pessoa **inativa** (`PersonStatus.INATIVO`) THEN o sistema SHALL persistir normalmente, preservar o histórico (audit_log append-only, sem delete) e manter a restrição de acesso por papel — status da Pessoa **não** é pré-condição da edição da ficha.
- WHEN a Pessoa **não possui credencial** (cadastro sem e-mail/senha pela AS) THEN o sistema SHALL permitir que ela seja referenciada em ficha social normalmente (sem exigir consentimento do titular — Assumption #2).
- WHEN a composição familiar é informada THEN o sistema SHALL aceitá-la apenas como texto/número declarado, **sem** vincular a entidade Família estruturada.
- WHEN um `COORDINATOR` tenta acessar a ficha (dado sensível) fora do escopo AS/diretoria THEN o sistema SHALL negar (nesta USP a ficha é acessível só a AS/BOARD). *Forward-compat: a omissão desses campos no View Model consolidado p/ coordenador é entregue na USP-039 via `viewPersonForSocialAssistant` (que comporá o serializer desta USP).*
- WHEN campos são enviados vazios/parciais THEN o sistema SHALL aceitar (todos os 4 campos são opcionais); Zod valida formato/limites quando presentes.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo que asserta que o resultado proibido não ocorre (ver `validate.md` §6b).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **SOC-036-MN-01** | WHEN um viewer sem papel `SOCIAL_ASSISTANT`/`BOARD` requisita a ficha (leitura ou escrita) THEN o sistema SHALL NOT retornar, selecionar ou expor no payload (RSC/Flight incluso) qualquer campo sensível da ficha (renda, benefício, moradia, composição). | Exposição LGPD de dado socioeconômico a coordenador/voluntário/candidato/etc. (confidencialidade). Defesa em profundidade: guarda de rota + guarda de papel na action/query + serializer estruturalmente sem os campos. | T3, T5, T6, T8 | Como `COORDINATOR`/`VOLUNTEER`: (a) `getSocioeconomicRecord` → `FORBIDDEN`, resultado não contém campo sensível; (b) `saveSocioeconomicRecord` → `FORBIDDEN`, nenhuma linha persistida; (c) guarda de rota nega. |
| **SOC-036-MN-02** | WHEN a ficha é criada ou editada THEN o sistema SHALL NOT persistir a alteração sem um registro de auditoria append-only contendo autor (`actorPersonId`) e data (i.e., nenhuma escrita fora de `withAudit`). | Modificação não-rastreável de dado social sensível (accountability/integridade LGPD). | T5 | Após `saveSocioeconomicRecord` OK, existe exatamente 1 linha nova em `audit_log` (`SOCIAL_SHEET_*`) com `actorPersonId` = operador e timestamp; a escrita e a auditoria estão na mesma tx (rollback conjunto). |

> **Nota sobre AC-036-4 (cripto em repouso):** é um controle de **plataforma/config**, não de código — não vira must-not com teste negativo (não há ciphertext app-side a asseverar). Sua "verificação" é a referência ADR-0012/§4.3 + config Supabase. O gap residual (leitor autorizado do DB vê claro) é mitigado por MN-01 (acesso) e MN-02 (rastreabilidade), não por cripto de coluna.

---

## Requirement Traceability

| Requirement ID | Story | AC | Phase | Status |
|---|---|---|---|---|
| SOC-01 | USP-036 | AC-036-1, AC-036-2 | Done | ✅ Verified |
| SOC-02 | USP-036 | AC-036-3, AC-036-4 | Done | ✅ Verified (AC-036-4 satisfeita-por-plataforma) |
| SOC-036-MN-01 | USP-036 (must-not, adição local) | — | Done | ✅ Verified |
| SOC-036-MN-02 | USP-036 (must-not, adição local) | — | Done | ✅ Verified |

**IDs canônicos:** `SOC-01`/`SOC-02` vêm do épico (upstream) — reusados, não duplicados. Os
`SOC-036-MN-*` são **adições locais** (tradução das proibições de sensibilidade que o formato
upstream não expressa como AC negativa).

**Coverage:** 4 requisitos · 4 mapeados a tasks · 0 sem mapeamento.

---

## Success Criteria

- [ ] AS consegue cadastrar, editar e reabrir a ficha (4 campos) de uma Pessoa (inclusive inativa e sem credencial), com log de alteração (autor+data) no `audit_log`.
- [ ] Qualquer papel fora de `SOCIAL_ASSISTANT`/`BOARD` tem acesso negado (`FORBIDDEN`) e nenhum campo sensível vaza (MN-01 verde).
- [ ] Toda escrita da ficha passa por `withAudit` (MN-02 verde); nenhuma escrita silenciosa.
- [ ] Dados armazenados com criptografia em repouso (plataforma Supabase, ADR-0012) — gap residual documentado.
- [ ] Leitura da ficha auditada via `SENSITIVE_FIELD_VIEWED`.
- [ ] Serializer/View da ficha pronto p/ a USP-039 compor `viewPersonForSocialAssistant`.
