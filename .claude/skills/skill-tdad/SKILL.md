---
name: skill-tdad
description: >-
  Gera testes-fonte (os "facts": cenários Gherkin .feature em PT-BR, specs Vitest red,
  esqueletos Playwright E2E e matriz de rastreabilidade AC→teste) a partir dos critérios
  de aceitação de uma User Story do Portal ASONSEG, ANTES de a feature ser implementada
  (TDD/BDD). Usa PRD, ADRs de negócio e técnicas, architecture-document, technical-design
  e project-guideline como fonte da verdade, e materializa a Seção 23 (EARS → Fact) e o
  princípio P1: todo critério em prosa vira artefato máquina-verificável. Acione sempre que
  o pedido envolver derivar/criar/gerar/escrever testes, facts, cenários BDD ou specs a
  partir de ACs, critérios de aceite, cláusulas EARS (WHEN/IF/WHERE/WHILE/SHALL) ou User
  Stories (USP-NNN, histórias). Exemplos que devem acionar: "gera os facts da USP-009",
  "EARS → fact da US de inativar pessoa", "cenários BDD + testes red dos critérios de
  aceite", "preparar a USP pro Kickoff Gate", "testes-fonte derivados dos EARS", "transformar
  critérios em testes red antes de codar", "escrever .feature em pt-br com tag por AC",
  "fact máquina-verificável de cada AC", e a fase Tasks da bravi-spec-driven que precisa
  popular os campos Tests/Gate de cada task. Acione mesmo sem citar "skill-tdad" e mesmo em
  pedidos curtos ou informais. NÃO use para: implementar a feature, rodar ou depurar testes
  já existentes, depurar CI, checar cobertura, escrever a spec/os ACs em si, especificar
  requisitos, revisar PR, projetar arquitetura de módulo, montar dataset de eval, ensinar
  conceitos de teste, nem para testar E2E uma feature que já está implementada/no ar.
license: CC-BY-4.0
metadata:
  author: cfassula
  version: 0.2.0
---

# skill-tdad — EARS → Fact (testes como fonte da verdade)

Esta skill converte os **critérios de aceitação de uma User Story** em **facts**: artefatos
máquina-verificáveis que ancoram o comportamento esperado *antes* de qualquer linha de
implementação. É a operacionalização concreta da **Seção 23 (EARS → Fact)** e dos
**Princípios Fact-Driven (Seção 20, P1–P5)** do `project-guideline.md`.

**Por que isso importa.** No Portal ASONSEG o desenvolvimento é assistido por IA e o código é
regenerável (P5). O que define que "o produto continua sendo o mesmo produto" não é o código
— é a suite de facts. Um critério em prosa "WHEN o CPF é inválido THEN the system SHALL bloquear"
é interpretável; um teste que passa ou falha não é. Cada upgrade de modelo reinterpreta linguagem
natural de forma sutilmente diferente — facts executáveis blindam o squad contra regressões
silenciosas. Por isso um critério **sem fact não está pronto** e não passa no Kickoff Gate (Seção 22).

## Quando esta skill roda

- **Acionada pela `bravi-spec-driven` na fase Tasks** — depois que o `spec.md` da feature tem os
  ACs em EARS, esta skill gera os facts que populam os campos `Tests`/`Gate` de cada task. O
  desenvolvimento então segue TDD: os testes existem (red) antes da implementação.
- **Standalone** — sobre uma US do PRD: "gera os facts da USP-001", "EARS → fact da US de login".

Em ambos os casos o resultado é o mesmo: os 4 artefatos abaixo, rastreáveis ao AC de origem.

## Fonte da verdade (leia antes de gerar)

Nunca invente comportamento. Os facts derivam **exclusivamente** dos documentos do projeto.
Carregue só o que a US toca (não leia tudo):

| Documento | Para quê |
|---|---|
| `docs/prd/prd-asonseg-portal-mvp.md` | A US e seus ACs em EARS (a matéria-prima principal). Também premissas, glossário, RNFs |
| `docs/prd/ADR-00NN-*.md` | ADRs de **negócio** — regras de domínio que o AC pressupõe (ex.: pessoa unificada, beneficiário como papel, consentimento por finalidade) |
| `docs/arch/00NN-*.md` | ADRs **técnicas** — restrições de implementação (auth/RBAC, auditoria append-only, visibilidade conservadora, máquina de estados, abstração LLM) |
| `docs/arch/project-guideline.md` | **Canônico.** Seções 4 (Server Action), 5 (View Models), 12 (Testes), 20–23 (Fact-Driven). Formato de fact, casos obrigatórios, tipos de fact aceitáveis |
| `docs/arch/technical-design.md` | Schema Prisma, contratos de integração, diagramas de sequência — para nomear entidades/campos corretos no teste |
| `docs/arch/architecture-document.md` | Os Top 8 fluxos E2E críticos (Seção 6) — define quando um AC merece teste Playwright |
| `.specs/features/[feature]/spec.md` | Quando acionada pela spec-driven: os ACs já normalizados em WHEN/THEN/SHALL e os IDs de requisito |

Se o AC referencia uma regra que você não encontra nos documentos, **não adivinhe**: marque o fact
como `@pendente-decisão` no Gherkin e registre a lacuna na seção "Lacunas" da matriz. Adivinhar
propaga erro por design → tasks → implementação.

## O processo

### 1. Identifique a US e extraia os ACs

Localize a User Story (USP-NNN) e copie **verbatim** cada critério de aceitação. Os ACs do PRD
seguem EARS. Reconheça os padrões — cada um pede um tipo diferente de fact:

| Cláusula EARS | Significado | Vira |
|---|---|---|
| `WHEN <evento> THE SYSTEM SHALL <resposta>` | comportamento disparado por evento (event-driven) | cenário **happy path** + teste |
| `IF <condição> THEN THE SYSTEM SHALL <resposta>` | comportamento condicional / desvio (unwanted behavior) | cenário de **borda/erro** + teste |
| `WHERE <estado/feature> THE SYSTEM SHALL <resposta>` | comportamento dependente de estado (state-driven) | cenário com **pré-condição** (Background ou Dado) |
| `WHILE <estado> THE SYSTEM SHALL <resposta>` | comportamento contínuo enquanto em um estado | cenário com invariante — candidato a **property-based test** |
| `THE SYSTEM SHALL <requisito>` (ubíquo) | requisito sempre válido | assertion incondicional ou schema Zod |

Detalhe da taxonomia e da decisão "qual tipo de fact" em
[references/ears-taxonomy.md](references/ears-taxonomy.md).

### 2. Classifique cada AC num tipo de fact

Os tipos aceitáveis (Seção 23.2) e onde o fact **vai morar quando for implementado** (você só
referencia esse path; não cria arquivo em `src/` ainda):

| Tipo de fact | Quando | Path-alvo (referência) |
|---|---|---|
| Teste unit/integration (Vitest) | regra de negócio, Server Action, fluxo entre módulos | `modules/<m>/__tests__/` |
| Teste E2E (Playwright) | um dos Top 8 fluxos críticos ponta-a-ponta | `e2e/` |
| Schema Zod | validação de fronteira (input/output de Action) | `modules/<m>/schemas/` |
| Métrica de eval suite | comportamento LLM (cv-extraction) | `modules/<m>/evals/baseline.json` |
| Property-based test (`fast-check`) | invariante sobre conjunto de entradas | `modules/<m>/__tests__/properties/` |
| View Model tipado | regra de visibilidade entre papéis | `modules/<m>/views/` |

**Casos obrigatórios para todo AC que toca Server Action sensível** (Seção 12 do guia) — gere um
cenário/teste para cada um que se aplica, mesmo que o AC não os liste explicitamente:
happy path · falha de validação Zod · permissão recusada (`requirePermission`) · consentimento
ausente (`requireActiveConsent`, quando a finalidade se aplica) · concorrência (quando há corrida).
A sequência canônica da Server Action (validar → `requirePermission` → `requireActiveConsent` →
pré-condições → `withAudit`) define exatamente o que cada caso ancora.

### 3. Gere os 4 artefatos

Tudo fica em `.specs/features/[feature]/tests/` (não em `src/` nem `e2e/` ainda — são a **fonte
da verdade**; a implementação os move/conecta depois, conforme P1: o fact existe antes do código):

```
.specs/features/[feature]/
├── spec.md                         # já existe (spec-driven) ou crie um stub apontando a US
└── tests/
    ├── bdd/
    │   └── usp-NNN-<slug>.feature   # Gherkin PT-BR, 1 arquivo por US
    ├── unit/
    │   └── usp-NNN-<slug>.spec.ts   # Vitest red (it.todo / expect que falha)
    ├── e2e/
    │   └── usp-NNN-<slug>.e2e.ts    # Playwright red — só se a US for fluxo Top 8
    └── traceability.md              # matriz AC → cenário BDD → teste → status
```

Templates e convenções de cada artefato:
- Gherkin PT-BR (Funcionalidade/Cenário/Dado/Quando/Então, tags `@ac-NNN`) →
  [references/templates.md](references/templates.md#gherkin-ptbr)
- Vitest red (estrutura `describe`/`it`, os 5 casos obrigatórios, como deixar falhando) →
  [references/templates.md](references/templates.md#vitest-red)
- Playwright E2E red → [references/templates.md](references/templates.md#playwright-e2e)
- Matriz de rastreabilidade → [references/templates.md](references/templates.md#matriz)

**Regra de ouro do "red":** todo teste gerado deve **falhar por ausência de implementação, nunca
por erro de sintaxe ou import quebrado**. Use `it.todo(...)` para casos ainda sem corpo e
`expect(implementMe()).toBe(...)` com um stub `function implementMe(){ throw new Error('not implemented') }`
para casos com assertion definida. O objetivo é um arquivo que roda no Vitest e reporta "red"
limpo — pronto para a implementação preencher.

### 4. Monte a matriz de rastreabilidade

Toda linha conecta **um AC** a **um ou mais facts**, com o path-alvo e o status. Cobertura é
verificável: nenhum AC pode ficar sem fact (P1). ACs sem fact viram **bloqueio de Kickoff Gate** —
liste-os explicitamente na seção "Lacunas". Veja o formato em
[references/templates.md](references/templates.md#matriz).

### 5. Entregue para o gate

Feche com um resumo curto: quantos ACs, quantos facts gerados por tipo, cobertura (X/Y ACs com
fact), e a lista de lacunas/decisões pendentes. Quando acionada pela spec-driven, devolva também
os paths-alvo para que ela popule os campos `Tests`/`Gate` das tasks. Esse bloco "## Facts" é o
artefato que o Kickoff Gate (Seção 22) exige no corpo do issue.

## Convenções não-negociáveis (resumo)

- **PT-BR** em tudo: nomes de cenário, descrições, nomes de teste. Sem i18n no MVP.
- **Rastreabilidade dupla**: cada cenário Gherkin tem tag `@ac-NNN`; cada `it`/`describe` cita o AC
  no nome. Assim a matriz é regenerável a partir dos próprios arquivos.
- **Verbatim do PRD**: o texto do AC na matriz é cópia fiel — não parafraseie um contrato.
- **Não enfraquecer**: nunca gere um fact mais fraco que o AC permite (ex.: testar só o happy path
  de um AC que descreve um erro). Enfraquecimento de fact é mudança de contrato (P4).
- **Não implementar**: esta skill para no "red". Implementar a feature é trabalho da fase Execute.
