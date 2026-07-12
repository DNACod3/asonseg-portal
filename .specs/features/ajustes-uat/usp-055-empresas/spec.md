# USP-055 — Empresas (remediação UAT: 2ª Empresa, tipos completos, CPF específico) — Specification

> **Fonte da verdade (upstream — adapt, don't re-derive):** dossiê de UAT
> `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`, tabela **Fase 8**, achados
> **MOD-2** (P1), **EMP-4** (P2) e **EMP-8** (P3). Os IDs de achado do dossiê são as âncoras
> canônicas; os `EMP055-NN` abaixo são IDs locais de rastreio das ACs, cada um mapeado ao
> achado de origem. Não se re-deriva o dossiê nem as specs de origem — elas são referenciadas:
> - USP-012 (cadastro de Empresa): `.specs/features/cadastros-publicos/usp-012-cadastro-empresa/spec.md`
> - USP-013 (adicionar responsável): `.specs/features/vinculos-pessoa-empresa/usp-013-adicionar-responsavel/spec.md`
> - USP-015 (editar Empresa): `.specs/features/vinculos-pessoa-empresa/usp-015-editar-empresa/spec.md`

## Problem Statement

O UAT de 2026-07-11 encontrou três defeitos objetivos no fluxo de Empresas, todos corrigíveis
sem mudar arquitetura nem premissas técnicas: (1) uma Pessoa que **já é responsável** de uma
Empresa não consegue cadastrar uma **segunda** Empresa — a criação incondicional do consentimento
`COMPANY_REPRESENTATION` estoura a unique parcial de consent ativo e vira "erro interno" genérico
(MOD-2); (2) o formulário de **editar Empresa** só exibe **2** dos **5** valores do enum
`CompanyType`, deixando Empresas `SA`/`LUCRO_*` sem seleção visível (EMP-4); (3) a busca de
responsável mostra **"Dados inválidos."** genérico para CPF mal formatado, em vez de uma mensagem
de campo específica (EMP-8).

## Goals

- [ ] MOD-2: uma Pessoa com consentimento `COMPANY_REPRESENTATION` ativo cadastra uma 2ª Empresa
      (CNPJ distinto) com **sucesso**, reaproveitando o consentimento existente — sem "erro interno",
      sem duplicar consent ativo, preservando atomicidade + auditoria.
- [ ] EMP-4: os formulários de Empresa (editar **e** criar) exibem os **5** tipos do enum
      `CompanyType` com rótulos PT-BR canônicos, a partir de **uma única fonte** de rótulos.
- [ ] EMP-8: um CPF mal formatado na busca de responsável produz **mensagem de campo específica**
      (reusando o texto canônico do projeto), não "Dados inválidos.".
- [ ] Zero regressão nas suítes de `create-company`, `editCompanySchema`/company-form e
      `add-responsible`; sem dependência nova; sem migração.

## Out of Scope

Explicitamente excluído para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Cadastro **público** de Empresa por não-autenticado | Fora do MVP (USP-012 é autenticado); inalterado. |
| Mudança da unique parcial `consents_active_purpose_unique` ou do modelo append-only de consent | Premissa inviolável — a correção é idempotência na app, não no schema. |
| Redefinir/estender o enum `CompanyType` ou seus valores | Enum já estabelecido (USP-010/ADR-0031); só se dão rótulos PT-BR de exibição. |
| Regra de re-verificação de Empresa ao editar identidade (D-015-E) | Já entregue na USP-015; intocada. |
| Fluxo de duas etapas (buscar→confirmar) do add-responsible | SPEC_DEVIATION já aceita na USP-013 (single-step sem PII); inalterado. |
| Migração de dados / nova coluna | Nenhuma necessária; premissa "sem migração". |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui (modo autônomo — ambiguidades viram assumptions
de dono `agent`).

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --------------------- | ----- | -------------- | --------- | ---------- |
| A1 — Corrigir os radios de tipo **também no form de criar** Empresa, não só no de editar (dossiê ancora EMP-4 só ao editar) | agent | Fonte única `COMPANY_TYPE_OPTIONS` usada por **ambos** os forms | O create-form tem o defeito idêntico (`create-company-form.tsx` só 2 radios → Empresa `SA`/`LUCRO_*` **não pode ser criada**); fonte única previne re-divergência. Dentro das premissas (sem dep/migração, PT-BR, enum já existe). | n |
| A2 — Rótulos PT-BR dos 5 valores | agent | MEI → "MEI (Microempreendedor Individual)"; SIMPLES_NACIONAL → "Simples Nacional"; LUCRO_PRESUMIDO → "Lucro Presumido"; LUCRO_REAL → "Lucro Real"; SA → "Sociedade Anônima (S.A.)" | Expansões canônicas dos valores do enum de regime fiscal/tipo societário (USP-010/ADR-0031) — não são semântica inventada. | n |
| A3 — EMP-8 corrige-se **client-side** (validação de campo antes do submit) | agent | Reusa mensagens canônicas: "CPF inválido (formato ou dígito verificador)" (CPF-shaped) e "E-mail inválido" (email-shaped); action/servidor inalterados (defesa em profundidade) | O dossiê pede "mensagem Zod específica **no campo**"; a mensagem de CPF é a mesma do `cpfSchema` de `identity/schemas/registerPerson.ts`. | n |
| A4 — MOD-2: a releitura do consent ativo ocorre **dentro** da tx `withAudit` (antes de decidir criar) | agent | Espelha `ensureClientRole` (Passo 4): `findFirst({purpose:'COMPANY_REPRESENTATION', revokedAt:null})` na tx → cria só se ausente | Fecha corrida de duplo submit e mantém atomicidade; padrão de consent idempotente já usado no projeto. | n |
| A5 — Classificador CPF/e-mail usado no client vira **client-safe** (módulo-local em `companies/domain`) | agent | Relocar `classifyIdentifier` + checagem pura de CPF p/ `companies/domain/responsible-identifier.ts`; re-exportar do schema p/ back-compat | Importar o barrel `@/modules/identity` num Client Component arrasta código server/Prisma p/ o bundle (hazard documentado, AD-019 / memória "barrel arrasta Prisma p/ client"); carve-out client/server é precedente (duplicação de `EDUCATION_LEVELS`). | n |

**Owner** — todos os itens são `agent` (discricionários, dentro das premissas). Nenhum item de dono
**externo** pendente → o **Entry Gate** (tasks.md §0) está **livre**; a feature entra em task breakdown.

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Cadastrar 2ª Empresa sendo já representante (MOD-2) ⭐ MVP

**User Story**: Como uma Pessoa que **já é responsável** de uma Empresa, quero cadastrar **outra**
Empresa (CNPJ distinto), para representar mais de uma organização no portal.

**Why P1**: Defeito funcional que trava um caso de uso legítimo com um erro genérico enganoso;
âncora MOD-2 (P1). É a causa-raiz de "erro interno" no cadastro de Empresa.

**Acceptance Criteria**:

1. WHEN uma Pessoa com consentimento `COMPANY_REPRESENTATION` **ativo** submete o cadastro de uma
   Empresa de **CNPJ distinto** e válido THEN o sistema SHALL cadastrar a Empresa, criar o grant
   `RESPONSIBLE` `ACTIVE` e **reaproveitar** o consentimento ativo existente (sem criar um novo),
   retornando `ok`. `[EMP055-01]`
2. WHEN a Pessoa **não** possui consentimento `COMPANY_REPRESENTATION` ativo (1ª Empresa) THEN o
   sistema SHALL criar o consentimento como hoje, dentro da mesma transação auditada. `[EMP055-02]`
3. WHEN o cadastro é concluído (1ª ou 2ª Empresa) THEN o sistema SHALL preservar as invariantes da
   USP-012: hash do termo validado (U12-MN-02), unicidade de CNPJ (U12-MN-03), atomicidade
   `withAudit(COMPANY_CREATED)`. `[EMP055-03]`
4. WHEN ocorre corrida de duplo submit (duas 2ªs Empresas concorrentes) THEN o sistema SHALL não
   deixar mais de um consentimento `COMPANY_REPRESENTATION` ativo para a mesma Pessoa (releitura na
   tx + índice parcial como rede). `[EMP055-04]`

**Independent Test**: Integração — pessoa cadastra Empresa A (ganha consent ativo), depois cadastra
Empresa B (CNPJ distinto): resultado `ok`, 2 Empresas, 2 grants `RESPONSIBLE` ativos, **exatamente 1**
consent `COMPANY_REPRESENTATION` ativo, nenhum `INTERNAL`.

---

### P2: Selecionar qualquer um dos 5 tipos de Empresa (EMP-4)

**User Story**: Como responsável editando (ou cadastrando) uma Empresa, quero ver e selecionar
**todos** os tipos válidos (inclusive `SA`, `LUCRO_PRESUMIDO`, `LUCRO_REAL`), para classificar
corretamente a organização.

**Why P2**: Empresas `SA`/`LUCRO_*` ficam sem seleção visível (EMP-4); no create, sequer podem ser
criadas com o tipo certo.

**Acceptance Criteria**:

1. WHEN o formulário de **editar** Empresa renderiza o controle "Tipo" THEN o sistema SHALL exibir
   os **5** valores do enum `CompanyType` como radios selecionáveis, com os rótulos PT-BR de A2.
   `[EMP055-05]`
2. WHEN o formulário de **cadastrar** Empresa renderiza o controle "Tipo" THEN o sistema SHALL exibir
   os mesmos **5** valores/rótulos (fonte única), mantendo `SIMPLES_NACIONAL` como default de criação.
   `[EMP055-06]`
3. WHEN a Empresa em edição tem tipo `SA` (ou `LUCRO_*`) THEN o sistema SHALL pré-selecionar esse
   radio a partir de `defaultValues.type`, sem rebaixar o tipo ao salvar. `[EMP055-07]`
4. WHEN um novo valor for adicionado ao enum `CompanyType` no futuro THEN o sistema SHALL falhar um
   teste de completude do mapa de rótulos (guard enum↔UI), evitando divergência silenciosa. `[EMP055-08]`

**Independent Test**: RTL — renderizar `EditCompanyForm` (e `CreateCompanyForm`) e afirmar que os 5
`value`s de radio estão presentes; teste de completude do domínio afirma que o mapa cobre o enum.

---

### P3: Mensagem específica de CPF na busca de responsável (EMP-8)

**User Story**: Como responsável adicionando outro responsável, quero uma mensagem clara quando digito
um CPF mal formatado, para corrigir o campo sem adivinhar o que está errado.

**Why P3**: "Dados inválidos." genérico é UX ruim; âncora EMP-8 (P3).

**Acceptance Criteria**:

1. WHEN o campo "CPF ou e-mail" recebe um valor **sem "@"** que não é CPF válido (formato/dígito) e o
   form é submetido THEN o sistema SHALL exibir a mensagem de campo canônica
   **"CPF inválido (formato ou dígito verificador)"**, sem chamar a action. `[EMP055-09]`
2. WHEN o campo recebe um valor **com "@"** que não é e-mail válido THEN o sistema SHALL exibir
   **"E-mail inválido"** no campo. `[EMP055-10]`
3. WHEN o campo recebe um CPF/e-mail **válido** THEN o sistema SHALL prosseguir e chamar
   `adicionarResponsavel` normalmente (comportamento atual preservado). `[EMP055-11]`

**Independent Test**: RTL — digitar `123` (CPF inválido) e submeter: aparece a mensagem canônica no
campo e `adicionarResponsavel` **não** é chamada; digitar e-mail válido chama a action.

---

## Edge Cases

- WHEN a 2ª Empresa reusa um consent `COMPANY_REPRESENTATION` cujo termo ativo foi aceito numa
  **versão anterior** THEN o sistema SHALL manter o consent existente (reuso), sem regravar
  versão/hash — a validação de hash do passo 3b valida apenas o payload enviado contra o termo do
  servidor, não altera a decisão de reuso.
- WHEN o consentimento `COMPANY_REPRESENTATION` da Pessoa está **revogado** (`revokedAt != null`)
  THEN a releitura na tx não o considera ativo → cria um novo consent (caminho de 1ª Empresa).
- WHEN o CNPJ da 2ª Empresa colide com um já existente THEN vale U12-MN-03 (CONFLICT, sem 2ª Empresa
  de mesmo CNPJ) — ortogonal ao reuso de consent.
- WHEN o campo de identificador vem só com espaços THEN a validação `.min(1)` (após trim implícito na
  classificação) segue exigindo conteúdo; mensagem "Informe um CPF ou e-mail." preservada.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | ------------------------------------- | -------- | ----------- | ------------- |
| EMP055-MN-01 | WHEN uma Pessoa com consent `COMPANY_REPRESENTATION` ativo cadastra uma 2ª Empresa THEN o sistema SHALL NOT criar um 2º consent `COMPANY_REPRESENTATION` ativo para a mesma Pessoa (nem falhar com `INTERNAL` por violar a unique parcial) | 2ª Empresa cair em "erro interno"; violar o invariante ≤1 consent ativo por finalidade; consent duplicado | T3 | `create-company.int.test.ts` — 2ª Empresa p/ pessoa c/ consent ativo → `ok`; exatamente 1 consent ativo; 2 empresas + 2 grants; nunca `INTERNAL` |
| EMP055-MN-02 | WHEN o controle "Tipo" de criar/editar Empresa é renderizado THEN o sistema SHALL NOT omitir qualquer valor do enum `CompanyType` (todo valor deve ter radio selecionável) | Empresa `SA`/`LUCRO_*` sem seleção; divergência enum↔UI | T1 (guard de completude), T4 + T5 (radios) | Domínio: teste afirma que o mapa cobre 1:1 o enum; RTL: os 5 `value`s presentes em ambos os forms |

**Invariantes preservadas (regressão, já com testes verdes na USP-012 — a correção MOD-2 NÃO pode
rebaixá-las):** `U12-MN-02` (hash divergente → zero consent gravado), `U12-MN-03` (CNPJ duplicado →
CONFLICT, exatamente 1 Empresa). O design insere a releitura de consent **após** a validação de hash
(passo 3b) e **sem** tocar a pré-checagem de CNPJ (passo 4).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| EMP055-01 | P1 (MOD-2) | Tasks (T3) | Pending |
| EMP055-02 | P1 (MOD-2) | Tasks (T3) | Pending |
| EMP055-03 | P1 (MOD-2) | Tasks (T3) | Pending |
| EMP055-04 | P1 (MOD-2) | Tasks (T3) | Pending |
| EMP055-05 | P2 (EMP-4) | Tasks (T4) | Pending |
| EMP055-06 | P2 (EMP-4) | Tasks (T5) | Pending |
| EMP055-07 | P2 (EMP-4) | Tasks (T4) | Pending |
| EMP055-08 | P2 (EMP-4) | Tasks (T1) | Pending |
| EMP055-09 | P3 (EMP-8) | Tasks (T6) | Pending |
| EMP055-10 | P3 (EMP-8) | Tasks (T6) | Pending |
| EMP055-11 | P3 (EMP-8) | Tasks (T6) | Pending |
| EMP055-MN-01 | Must-Not | Tasks (T3) | Pending |
| EMP055-MN-02 | Must-Not | Tasks (T1, T4, T5) | Pending |

**ID format:** `EMP055-NN` (local); âncoras upstream = achados do dossiê MOD-2 / EMP-4 / EMP-8.
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 13 requisitos (11 ACs + 2 must-nots), todos mapeados a tasks; 0 sem mapa.

---

## Success Criteria

- [ ] Pessoa com consent `COMPANY_REPRESENTATION` ativo cadastra 2ª Empresa (CNPJ distinto) → `ok`,
      1 consent ativo, 2 empresas, 2 grants — verificado por int test.
- [ ] `EditCompanyForm` e `CreateCompanyForm` exibem os 5 tipos com rótulos PT-BR — verificado por RTL.
- [ ] CPF mal formatado no add-responsible → mensagem "CPF inválido (formato ou dígito verificador)"
      no campo, action não chamada — verificado por RTL.
- [ ] `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
      verdes; sem dep nova; sem migração; suítes de create-company/edit/add-responsible preservadas.
