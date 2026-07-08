# USP-012 — Cadastro de Empresa — Refactor (Fase 2) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-012 já
> vivem em `.specs/features/cadastros-publicos/spec.md` (história "P1: Cadastro de Empresa pela
> Pessoa-responsável", requisitos **CAD-11..CAD-15** + Edge Cases) e no PRD (`docs/prd/prd-asonseg-portal-mvp.md`,
> USP-012, Épico 2). A USP **já está implementada e mergeada** (action `createCompany`, schema `Company`,
> `domain/cnpj.ts`, `CreateCompanyForm`). Este documento **não re-deriva** os ACs — os IDs `CAD-11..15`
> permanecem canônicos. Ele especifica os **deltas de refactor da Fase 2**: (1) adoção do Design System
> (AD-014/AD-015) na UI, e (2) o item ausente (rota que renderiza o formulário). IDs locais (`U12-*`)
> cobrem só o que o épico não descreve.
>
> **Alinhamento com AD-015 (Fase 1):** restyle é **style-only, comportamento preservado**, ancorado nos
> testes existentes verdes como testes negativos; mudanças que tocam comportamento são documentadas como
> decisão com justificativa.

## Problem Statement

O cadastro de Empresa (USP-012) está entregue e correto no backend (`createCompany` — sequência canônica
completa: Zod → sessão → consent `PORTAL_ACCESS` → validação de hash do termo → CNPJ único → `withAudit`
atômico criando `Company` `isVerified=false` + grant `RESPONSIBLE` `ACTIVE` + `Consent`
`COMPANY_REPRESENTATION`). Porém: (1) o `CreateCompanyForm` usa Tailwind solto (`bg-blue-600`,
`text-gray-*`, constantes `inputClass`/`labelClass`/`errorClass`) fora do Design System extraído do
protótipo (AD-014), destoando da linguagem visual da Fase 1; e (2) **nenhuma rota renderiza o formulário**
— o `CreateCompanyForm` é exportado pelo barrel mas não é consumido por nenhuma página em `src/app`, e o
redirect de sucesso (`/empresa/${companyId}`) aponta para rota inexistente. Este refactor aplica o DS
(só estilo, fluxo preservado) e materializa a rota de cadastro que falta para que a USP seja exercível
ponta-a-ponta.

## Goals

- [ ] Reestilizar o `CreateCompanyForm` com os primitivos/tokens do DS (AD-014) — `Input`/`Label`/`Textarea`/`Button`,
      `FormCard`, `LgpdBox` — com paridade visual ao protótipo em light/dark, **sem alterar comportamento**
      (RHF/Zod, gate afirmativo do checkbox de consentimento, campos ocultos versão+hash do termo, `createCompany`).
- [ ] Materializar a rota `(app)/empresa/cadastrar/page.tsx` (Server Component `force-dynamic`) que carrega o
      termo `COMPANY_REPRESENTATION` server-side e renderiza o formulário, envolta em `FormHeader`/`StepIcon`/`FormCard`.
- [ ] Corrigir o alvo do redirect de sucesso para uma rota existente (evitar 404 pós-cadastro).
- [ ] Preservar as garantias de negócio: `isVerified=false` na criação (proteção RP-005 empresa-fantasma),
      CNPJ único (dígito verificador + duplicidade), integridade do termo por hash, e consentimento LGPD atômico.
- [ ] Manter verdes todos os testes existentes da USP-012 e cobrir os deltas com teste novo (RTL do formulário
      + guarda estática de paridade DS).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar a sequência canônica de `createCompany` ou o modelo de dados `Company`/grant/consent | Entregues e cobertos por testes; refactor é **só de estilo** + wiring de rota. |
| Painel/home da Empresa (`/empresa/[empresaId]`) e listagem (`/empresa`) | Rotas de dashboard fora do escopo desta USP; ver Risks (redirects órfãos). |
| Fluxo "solicitar inclusão como responsável" para CNPJ duplicado (AC CAD-13, 2ª metade) | O backend já bloqueia o duplicado com orientação; a UI de "solicitar inclusão" é feature adjacente (V2 / não implementada). Ver Assumptions. |
| Validação manual da Empresa (verificação positiva) | Ocorre na moderação da 1ª vaga (USP-017); aqui só a marca inicial `isVerified=false`. |
| Extração/edição de dados fiscais MEI além do já modelado (`type`) | `type` (MEI/SIMPLES_NACIONAL/…) já coletado; sem novos campos. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| A rota de cadastro de Empresa não existe hoje; o `CreateCompanyForm` está órfão (só exportado pelo barrel). | agent | Materializar `(app)/empresa/cadastrar/page.tsx` como parte desta USP (item ausente do plano "como se novo"). | Verificado: `grep` por `CreateCompanyForm` em `src/app` = 0; sem página, a USP-012 não é exercível ponta-a-ponta nem restilizável como "tela". | y |
| O redirect de sucesso do form (`/empresa/${companyId}`) e o `router.push('/empresa')` do `RemoveResponsibleDialog` apontam para rotas inexistentes (404). | agent | Redirecionar o sucesso do cadastro para `/empresa/${companyId}/responsaveis` (rota existente); o `/empresa` do dialog fica como risco documentado (não é desta USP). | Preserva o fluxo (leva o novo responsável à gestão da Empresa recém-criada) sem inventar um dashboard fora de escopo. | y |
| O consentimento do termo `COMPANY_REPRESENTATION` na USP-012 é **checkbox afirmativo single-step** dentro do form (não o split página-separada da USP-043). | agent | Preservar o checkbox afirmativo (restilizado com `accent-primary` dentro do `LgpdBox`); o servidor continua validando versão+hash do termo. | Diverge do padrão de split da Fase 1 (AD-015) apenas porque o cadastro de Empresa é **uma única etapa** (não um role+consent em duas transações). A garantia LGPD (aceite versionado íntegro) é mantida server-side. Documentado como decisão de consistência. | y |
| A UI de "solicitar inclusão como responsável" para CNPJ duplicado (2ª metade de CAD-13) não existe. | agent | Fora de escopo desta rodada; o backend já retorna `CONFLICT` com mensagem orientadora. Registrar como Deferred. | Feature adjacente (notificar responsáveis atuais) sem backend próprio; introduzi-la excede o mandato de restyle. | y |
| Server Component de página segue o padrão do repo: gate de restyle é typecheck+lint+build, sem `page.test.tsx`. | agent | Não criar teste de página para a nova `cadastrar/page.tsx`; cobertura concentra-se no Client Component + guarda estática. | Consistente com a decisão da Fase 1 (AD-015) e com o repo (só `login`/`redefinir-senha` têm teste de página). | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Restyle do cadastro de Empresa para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como Pessoa que cadastra uma Empresa, quero que o formulário de cadastro tenha a mesma
identidade visual do restante do portal, para que a experiência seja coesa e profissional.

**Why P1**: Consistência visual é o objetivo central da Fase 2 (mesma diretriz da Fase 1, AD-015).

**Acceptance Criteria**:

1. QUANDO o `CreateCompanyForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Textarea`/`Button`
   do barrel `@/shared/ui`, sem classes de paleta crua (`bg-blue-600`, `text-gray-*`, `focus:ring-blue-*`,
   `border-gray-300`) nem as constantes locais `inputClass`/`labelClass`/`errorClass`.
2. QUANDO o formulário é reestilizado ENTÃO o sistema DEVE **preservar** RHF+Zod (`createCompanySchema`), os
   campos ocultos `companyRepresentationTermVersion`/`companyRepresentationTermHash`, o gate afirmativo do
   checkbox de consentimento (submit desabilitado até marcar), e a chamada a `createCompany` — sem mudança de fluxo.
3. QUANDO o termo de representação é exibido ENTÃO o sistema DEVE compô-lo dentro de um `LgpdBox`, mantendo a
   área rolável do corpo do termo e o checkbox afirmativo versionado.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens
   (`data-theme`), sem hex cru.

**Independent Test**: Renderizar `CreateCompanyForm` (RTL) e confirmar labels/inputs/checkbox/botão preservados
e uso dos primitivos; submeter sem marcar o consentimento e confirmar que `createCompany` não é chamado; abrir
o cadastro no browser em light/dark e confirmar paridade com o protótipo; suíte da USP-012 permanece verde.

---

### P1: Materializar a rota de cadastro de Empresa ⭐ MVP

**User Story**: Como Pessoa autenticada, quero acessar uma página de cadastro de Empresa, para que eu possa
de fato cadastrar uma Empresa e me tornar responsável.

**Why P1**: Sem a rota, a USP-012 é código morto (form + action existem, mas nenhuma navegação os alcança).

**Acceptance Criteria**:

1. QUANDO uma Pessoa autenticada acessa `/empresa/cadastrar` ENTÃO o sistema DEVE carregar o termo
   `COMPANY_REPRESENTATION` (versão + hash íntegros, server-side via `loadTerm`) e renderizar o
   `CreateCompanyForm` com esses dados.
2. QUANDO uma Pessoa **não autenticada** acessa `/empresa/cadastrar` ENTÃO o sistema DEVE redirecionar para
   login (via `requireActivePerson`/`getCurrentPerson`, padrão das rotas `(app)`).
3. QUANDO o cadastro é concluído com sucesso ENTÃO o sistema DEVE redirecionar para uma rota **existente**
   (`/empresa/${companyId}/responsaveis`), sem 404.

**Independent Test**: Autenticar, abrir `/empresa/cadastrar`, submeter CNPJ válido + razão social + nome
fantasia + setor + aceite do termo, e verificar Empresa persistida, vínculo `RESPONSIBLE` `ACTIVE` criado,
`isVerified=false`, e navegação para a página de responsáveis da Empresa criada.

---

## Edge Cases (preservados do backend existente — não regredir no restyle)

- QUANDO o CNPJ tem formato/dígito verificador inválido ENTÃO o sistema DEVE bloquear (Zod / `isValidCnpj`).
- QUANDO o CNPJ já está cadastrado ENTÃO o sistema DEVE bloquear com `CONFLICT` e mensagem orientadora.
- QUANDO o CNPJ vem com máscara/pontuação ENTÃO o sistema DEVE normalizar antes de validar (`normalizeCnpj`).
- QUANDO o hash do termo enviado não bate com o do servidor ENTÃO o sistema DEVE bloquear (`VALIDATION`).
- QUANDO o consentimento `PORTAL_ACCESS` não está ativo ENTÃO o sistema DEVE bloquear (`CONSENT_REQUIRED`).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** remover o gate afirmativo do checkbox nem os campos ocultos do termo.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U12-MN-01 | QUANDO uma Empresa é criada ENTÃO o sistema NÃO DEVE gravá-la com `isVerified=true`. | Empresa-fantasma publicando sem validação manual (RP-005) — a verificação positiva é só na 1ª vaga (USP-017). | T3 (action preservada) | `create-company.int.test.ts` — Empresa criada tem `isVerified=false`. |
| U12-MN-02 | QUANDO o hash do termo `COMPANY_REPRESENTATION` enviado não corresponde ao versionado no servidor ENTÃO o sistema NÃO DEVE persistir o `Consent`. | Fabricação de registro de consentimento LGPD com hash/versão arbitrários. | T3 | `create-company.int.test.ts` / schema test — hash divergente → `VALIDATION`, zero `Consent`. |
| U12-MN-03 | QUANDO um CNPJ já cadastrado é submetido ENTÃO o sistema NÃO DEVE criar uma segunda Empresa com o mesmo CNPJ. | Duplicidade de identidade jurídica (integridade + corrida P2002). | T3 | `create-company.int.test.ts` — CNPJ duplicado → `CONFLICT`, sem 2ª linha. |
| U12-MN-04 | QUANDO o `CreateCompanyForm`/página de cadastro é reestilizado ENTÃO o sistema NÃO DEVE reter utilitários de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `focus:ring-blue-*`) nem hex cru. | "Fundação construída mas não provada" — smoke de que o DS de fato substitui o ad-hoc (espelha DS-MN-03). | T1, T2 | `ds-empresa-cadastro-parity.test.ts` — arquivos restilizados sem paleta crua. |

> **Nota:** U12-MN-01..03 são prova de **preservação** — o backend já as garante; os testes de integração
> existentes (verdes) são os testes negativos. O restyle NÃO pode enfraquecê-las (as tasks de restyle tocam
> só markup/classe). U12-MN-04 é o must-not de estilo, com guarda estática nova.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAD-11 (upstream, canônico) | USP-012 | Verified (entregue) | Preservado |
| CAD-12 (upstream, canônico) | USP-012 | Verified (entregue) | Preservado |
| CAD-13 (upstream, canônico) | USP-012 | Verified (entregue) | Preservado (2ª metade — "solicitar inclusão" — Deferred) |
| CAD-14 (upstream, canônico) | USP-012 | Verified (entregue) | Preservado |
| CAD-15 (upstream, canônico) | USP-012 | Verified (entregue) | Preservado |
| U12-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U12-WIRE-01 (local) | P1 Rota | Tasks | Pending |
| U12-MN-01..04 (local) | P1 | Tasks | Pending |

**ID format:** upstream `CAD-NN` canônico; local `U12-STYLE/WIRE-NN` e must-nots `U12-MN-NN`.

**Coverage:** 12 itens (5 upstream preservados, 7 locais); 7 locais mapeados a tasks.

---

## Success Criteria

- [ ] `CreateCompanyForm` e a nova página de cadastro usam exclusivamente primitivos/tokens do DS; paridade visual light/dark.
- [ ] Nenhuma mudança de comportamento: sequência canônica de `createCompany`, `isVerified=false`, hash do termo, CNPJ único, consent atômico — todos preservados.
- [ ] `/empresa/cadastrar` existe, exige sessão, e o sucesso navega para rota existente (sem 404).
- [ ] Todos os testes existentes da USP-012 permanecem verdes; deltas cobertos por RTL do form + guarda estática de paridade DS.
