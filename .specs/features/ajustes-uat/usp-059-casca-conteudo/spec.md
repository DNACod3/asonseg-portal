# USP-059 — Casca e Conteúdo (Remediação do UAT) Specification

## Problem Statement

O UAT completo de 2026-07-11 encontrou seis lacunas de casca e conteúdo que degradam a
experiência sem envolver mudança de arquitetura: o 404 do Next aparece em inglês e sem casca;
não há favicon; `/termos` e `/privacidade` (linkados no cadastro) retornam 404; os termos de
consentimento aparecem como Markdown cru na UI; a visão consolidada exibe enums crus
("CANDIDATE"/"ATIVO"); e o literal do badge institucional diverge entre spec e código.
Esta unidade fecha esses pontos preservando as premissas do projeto (casca ISR sem sessão,
View Models, sem dependência nova, sem conteúdo jurídico inventado, PT-BR, sem migração).

## Fonte da Verdade (upstream — adaptar, não re-derivar)

Os requisitos vêm do dossiê de UAT, que já ancora cada item em AC/spec/PRD/protótipo. Os **IDs
de achado do dossiê são canônicos** aqui; ACs locais apenas os detalham em WHEN/THEN testável.

- **Dossiê (upstream):** `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — tabela "Fase 8",
  achados **PUB-3/SOC-3, PUB-4, AUTH-2, AUTH-6/EMP-7, SOC-4, SOC-6** (versão 2026-07-11).
- **ROADMAP:** `.specs/project/ROADMAP.md` — linha USP-059 (Fase 8).
- **Specs vizinhas (referência, não re-decidir):**
  - `.specs/features/fachada-publica/usp-046-casca-navegacao/spec.md` — casca pública, guards CASCA-MN-01..04.
  - `.specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/spec.md` — visão consolidada.
  - `.specs/features/consentimentos-lgpd/usp-043-consentimentos/spec.md` — painel de consentimentos (restyle-only).
  - `.specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/spec.md` — literal do badge (alvo do SOC-6).
  - `.specs/features/ajustes-uat/usp-049-pos-login-hub/spec.md` — criou `ALL_ROLE_LABELS`; deferiu a consolidação de rótulos para esta USP.

## Goals

- [x] Rota inexistente / `notFound()` renderiza página 404 **PT-BR com casca pública** e link de volta à home.
- [x] Documento serve um **favicon** (identidade "A" azul do protótipo) via convenção de metadata do Next.
- [x] `/termos` e `/privacidade` respondem 200 com casca e **placeholder honesto** ("documento em elaboração"), matando o link morto do cadastro **sem inventar texto jurídico**.
- [x] Termos de consentimento são exibidos **renderizados** (headings/negrito/listas/citações/regra/código/parágrafos) e não como Markdown cru, **sem dependência nova**.
- [x] Visão consolidada exibe **rótulos PT-BR** para papéis e status (nenhum enum cru), reusando o mapa canônico.
- [x] A spec USP-037 e o technical-design §3.5 são **alinhados** ao literal canônico do badge (docs-only, sem tocar código).

## Out of Scope

| Item | Motivo |
| ---- | ------ |
| Conteúdo jurídico real de `/termos` e `/privacidade` | Dependência externa **D-002** (jurídico/DPO); gate humano. Só o placeholder honesto é implementado agora. |
| Converter o item "Termos e Privacidade (em breve)" do rodapé em links vivos | Reconciliação de rodapé é **Fase 9 (H-2)**; fora do escopo do achado AUTH-2 (que trata dos links do cadastro). |
| Header client-side por sessão (ex.: 404 pós-login mostra "Entrar/Cadastrar") | **Fase 9 (H-4 / CASCA-MN-01)** — a casca é estática por design. |
| Alterar o código do badge (`job-applicants-list.tsx`) | Código já usa o literal canônico; SOC-6 é **docs-only** (corrige a fonte divergente). |
| Corrigir demais ocorrências do literal curto (glossário PRD :986, USP-025) | Não nomeadas pelo SOC-6; PRD upstream já tem o literal longo em AC-037-5 (:731). |
| Renderizar Markdown completo (H3+, itálico, listas ordenadas, links, tabelas) | Nenhum termo em `legal/consent-terms/` usa esses construtos; renderer cobre apenas o que existe. |
| Migração/DB, novas rotas autenticadas, novos View Models | Premissa Fase 8: sem mudança de arquitetura. |

---

## Assumptions & Open Questions

| # | Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| - | --------------------- | ----- | -------------- | --------- | ---------- |
| A1 | Conteúdo jurídico de `/termos` e `/privacidade` é externo (D-002). A **implementação (placeholder)** NÃO depende dessa decisão. | external (jurídico/DPO) p/ conteúdo; **agent** p/ placeholder | Página com casca + aviso "documento em elaboração / disponível em breve", sem ação de aceite. | Mata o link morto (AUTH-2) sem inventar texto jurídico; o texto real entra depois sem retrabalho de rota. | y (placeholder) |
| A2 | Favicon usa a identidade existente ("A" branco sobre gradiente **azul** `#2563EB→#3B82F6`, Nunito black). | agent | `src/app/icon.svg` (convenção de metadata do Next). SVG carrega o hex de marca literal (é asset, não componente temável). | Reusa a identidade do protótipo (`docs/prototipo/index.html`); não inventa identidade nova. O hex literal fica fora do escopo do guard CASCA-MN-02 (que varre `(public)/_components/**`). | y |
| A3 | Rótulos de `PersonStatus` = `ATIVO`→"Ativa", `INATIVO`→"Inativa". | agent | Espelha o literal já usado em `pessoas/[id]/page.tsx:57-59`. | Consistência entre as duas superfícies de staff; não inventa nova redação. | y |
| A4 | O 404 reusa `SiteHeader` — que exibe "Entrar/Cadastrar" mesmo em 404 pós-login. | agent | Aceito como está; header por sessão é Fase 9 (H-4). | O achado pede reuso da casca pública; header-por-sessão é decisão de produto (H-4). | y |
| A5 | Literal canônico do badge = **"Candidato encaminhado pela ASONSEG"** (PRD/épico AC-037-5, :731). | agent | Alinhar USP-037 spec + TD §3.5 ao literal longo. | Código e testes já usam o literal longo; PRD upstream é canônico; SOC-6 pede "alinhar a spec ao literal do épico". | y |
| A6 | Rótulo de `ContentStatus` no painel reusa `labelContentStatus`/`CONTENT_STATUS_LABELS` de `@/modules/reporting`. | agent | Import `persons → reporting` do helper canônico de rótulo (constante pura, sem acoplamento reverso). | "Reusar mapa canônico, não criar novo"; a alternativa (novo mapa) duplicaria. Troca trivial se a review preferir mapa local. | y |
| A7 | Renderer de termo cobre apenas os construtos usados nos 8 termos: `#`, `##`, `**negrito**`, lista `- `, citação `> `, régua `---`, código inline `` ` ``, parágrafos. | agent | Construtos não suportados degradam para texto inerte (nunca quebram). | Levantamento dos arquivos `legal/consent-terms/*/v1.0.md`; renderer mínimo sem dependência. | y |
| A8 | Rodapé "Termos e Privacidade (em breve)" permanece como texto, não vira link. | agent | Não tocar no rodapé. | AUTH-2 é sobre os links do cadastro (`RegisterPersonForm.tsx:221,225`); rodapé é Fase 9 (H-2) e toca guards da USP-046. | y |
| A9 | 404 usa `app/not-found.tsx` (envolvido pelo root layout), não `global-not-found.tsx`. | agent | `src/app/not-found.tsx`, Server Component, renderiza `SiteHeader`/`main`/`SiteFooter`. | Confirmado via context7: root `not-found.tsx` renderiza dentro do root layout (html/body/fontes/theme-script) e captura rotas inexistentes + `notFound()` não capturado; `global-not-found` ignoraria o layout. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

**Entry-gate note:** nenhum item de owner externo bloqueia a implementação. D-002 (conteúdo jurídico) é externo, mas o placeholder foi desenhado para **não depender** dessa decisão (ver A1). A USP entra em task breakdown.

---

## User Stories

### P2: [PUB-3/SOC-3] Página 404 PT-BR com casca pública ⭐

**User Story**: Como visitante que acessa uma rota inexistente (ou recebe uma negação por papel / redirecionamento quebrado), quero uma página "não encontrada" em português, com a casca do portal e um caminho de volta, para não cair no 404 cru em inglês.

**Why P2**: Toda rota inexistente, negação por papel e `notFound()` do app hoje cai no default do Next ("This page could not be found.") — inglês, sem casca, sem saída.

**Acceptance Criteria**:

1. **PUB3-1** WHEN uma URL não casa com nenhuma rota (ou um segmento chama `notFound()` sem `not-found` mais próximo) THEN o sistema SHALL renderizar `src/app/not-found.tsx` com título e mensagem **em PT-BR** (ex.: "Página não encontrada").
2. **PUB3-2** WHEN a página 404 renderiza THEN ela SHALL montar a **casca pública** reusando `SiteHeader` e `SiteFooter` de `(public)/_components/`, dentro de um único landmark `<main>`.
3. **PUB3-3** WHEN a página 404 renderiza THEN ela SHALL exibir um link/botão **"Voltar para a home"** apontando para `/`.
4. **PUB3-4** WHEN a página 404 renderiza THEN o conteúdo SHALL usar apenas classes de token (padrão do container `(public)`: `mx-auto ... max-w-3xl ... px-4 py-8`) e responder o status HTTP 404.

**Independent Test**: Acessar `/rota-que-nao-existe` e ver a página PT-BR com header/footer e o botão para a home; renderizar `NotFound` em teste de componente e verificar textos PT-BR + presença de `SiteHeader`/`SiteFooter` + link para `/`.

---

### P3: [PUB-4] Favicon (identidade "A")

**User Story**: Como visitante, quero que a aba do navegador mostre o ícone da ASONSEG, para reconhecer o portal e não ver o placeholder/404 de favicon.

**Why P3**: Cosmético, mas o favicon hoje dá 404 (não há `<link rel="icon">` nem asset).

**Acceptance Criteria**:

1. **PUB4-1** WHEN qualquer página do app é servida THEN o `<head>` SHALL conter um `<link rel="icon">` gerado pela convenção de metadata do Next a partir de `src/app/icon.svg`.
2. **PUB4-2** WHEN o favicon é definido THEN ele SHALL usar **apenas** a identidade existente do protótipo: letra "A" branca (Nunito, peso alto) sobre gradiente azul `#2563EB→#3B82F6`, sem inventar identidade visual nova.

**Independent Test**: Rodar o build e inspecionar o `<head>` (ou o HTML servido) por `<link rel="icon" ... type="image/svg+xml">`; abrir `src/app/icon.svg` e confirmar "A" + hex de marca.

---

### P2: [AUTH-2] `/termos` e `/privacidade` — placeholder honesto

**User Story**: Como pessoa no cadastro que clica em "Termos de Uso" ou "Política de Privacidade", quero chegar a uma página real (mesmo que provisória), para o link não ser um beco de 404.

**Why P2**: Âncora LGPD morta: `RegisterPersonForm.tsx:221,225` linka `/termos` e `/privacidade`, ambas 404.

**Acceptance Criteria**:

1. **AUTH2-1** WHEN o usuário acessa `/termos` THEN o sistema SHALL responder 200 com a casca pública e um aviso PT-BR de que o **documento está em elaboração / disponível em breve**.
2. **AUTH2-2** WHEN o usuário acessa `/privacidade` THEN o sistema SHALL responder 200 com a casca pública e o mesmo tipo de aviso PT-BR.
3. **AUTH2-3** WHEN qualquer das duas páginas renderiza THEN ela SHALL **NÃO** carregar/exibir conteúdo de `legal/consent-terms/` nem oferecer qualquer ação de aceite/consentimento — é uma página informativa de placeholder.

**Independent Test**: Acessar `/termos` e `/privacidade` e ver 200 + casca + aviso "em elaboração"; teste de componente confirma o marcador de placeholder e a ausência de controle de aceite.

---

### P3: [AUTH-6/EMP-7] Markdown dos termos renderizado

**User Story**: Como pessoa que lê um termo de consentimento (em `/perfil/papeis`, `/consentimentos` e nos cadastros de candidato/prestador/empresa/CV), quero o texto formatado, para não ver `# Termo…` e `**…**` crus.

**Why P3**: Legibilidade; hoje o corpo do termo é despejado em `<div className="… whitespace-pre-wrap …">{term.body}` sem formatação, em 5 pontos de uso.

**Acceptance Criteria**:

1. **AUTH6-1** WHEN um corpo de termo em Markdown é exibido THEN o sistema SHALL renderizar via um componente `TermMarkdown` (novo, em `shared/ui`) que formata os construtos usados nos termos: H1 (`#`), H2 (`##`), negrito (`**`), lista não-ordenada (`- `), citação (`> `), régua horizontal (`---`), código inline (`` ` ``) e parágrafos separados por linha em branco.
2. **AUTH6-2** WHEN o Markdown do termo é renderizado THEN a marcação de sintaxe (`#`, `**`, `-`, `>`) SHALL **NÃO** aparecer como texto literal para o usuário (deve virar o elemento correspondente).
3. **AUTH6-3** WHEN um construto não suportado aparece no texto THEN o sistema SHALL exibi-lo como texto inerte (parágrafo/linha), sem quebrar a renderização.
4. **AUTH6-4** WHEN o renderer é adotado THEN ele SHALL substituir o despejo cru nos 5 pontos: `candidate-form.tsx`, `provider-form.tsx`, `create-company-form.tsx`, `CvUploadForm.tsx` (`{term.body}`) e `consents-panel.tsx` (`{item.termBody}`).

**Independent Test**: Renderizar `TermMarkdown` com o corpo de um termo real (ex.: `job-application/v1.0.md`) e verificar `<h1>`, `<h2>`, `<strong>`, `<ul><li>`, `<blockquote>`, `<hr>`, `<code>` no output e a ausência de `#`/`**` literais; unit tests 1:1 por construto no parser puro.

---

### P2: [SOC-4] Rótulos PT-BR na visão consolidada

**User Story**: Como assistente social / coordenação / diretoria vendo a visão consolidada de uma Pessoa, quero papéis e status em português, para não ler enums crus como "CANDIDATE" e "ATIVO".

**Why P2**: `consolidated-person-panel.tsx` renderiza `{role}` e `{person.status}` (e status de serviço/vínculo) crus; existe mapa canônico `ALL_ROLE_LABELS` a reusar.

**Acceptance Criteria**:

1. **SOC4-1** WHEN o painel exibe papéis ativos da Pessoa THEN cada badge SHALL mostrar o rótulo PT-BR de `ALL_ROLE_LABELS` (`@/modules/identity`), com fallback ao valor cru apenas se a chave for desconhecida.
2. **SOC4-2** WHEN o painel exibe o status da Pessoa THEN o badge SHALL mostrar o rótulo PT-BR de `PERSON_STATUS_LABELS` (novo, `persons/domain`): `ATIVO`→"Ativa", `INATIVO`→"Inativa".
3. **SOC4-3** WHEN o painel exibe o status de um serviço (ContentStatus) e o status de um vínculo organizacional (CompanyGrantStatus) THEN cada badge SHALL mostrar rótulo PT-BR (reuso de `labelContentStatus` de `@/modules/reporting`; novo `COMPANY_GRANT_STATUS_LABELS` em `companies/domain`).
4. **SOC4-4** WHEN a página `pessoas/[id]` renderiza os papéis/status THEN ela SHALL consumir os **mesmos mapas canônicos** (`ALL_ROLE_LABELS`, `PERSON_STATUS_LABELS`), removendo o `ROLE_LABELS` inline duplicado (dedup deferido pela USP-049).

**Independent Test**: Renderizar o painel com fixture (papel `CANDIDATE`, status `ATIVO`, 1 serviço `ACTIVE`, 1 vínculo `PENDING`) e ver "Candidato(a)", "Ativa" e rótulos PT-BR; nenhum token cru presente.

---

### P3: [SOC-6] Alinhamento do literal do badge (docs-only)

**User Story**: Como mantenedor lendo a spec USP-037 / technical-design, quero o literal do badge institucional consistente com o código, para a fonte da verdade não divergir.

**Why P3**: Divergência de documentação: código e testes usam "Candidato encaminhado pela ASONSEG" (AC-037-5); a spec USP-037 e o TD §3.5 dizem "Encaminhado pela ASONSEG".

**Acceptance Criteria**:

1. **SOC6-1** WHEN a spec USP-037 é lida THEN as ocorrências do literal curto SHALL ser atualizadas para **"Candidato encaminhado pela ASONSEG"** (linhas 29, 56, 89, 96, 142 de `usp-037-encaminhar-vaga/spec.md`), incluindo a correção da racionalização agora incorreta na linha 56.
2. **SOC6-2** WHEN `docs/arch/technical-design.md` §3.5 é lido THEN a nota do diagrama (linha 693) SHALL usar o literal longo canônico.
3. **SOC6-3** WHEN o alinhamento é feito THEN **nenhum arquivo de código** (`src/**`) SHALL ser modificado — o código já é canônico.

**Independent Test**: `grep -rn "Encaminhado pela ASONSEG"` nos dois arquivos-alvo não retorna mais o literal curto; código intocado (`git diff --stat` sem `src/`).

---

## Edge Cases

- **EC-1** WHEN um segmento `(app)` chama `notFound()` para um usuário logado THEN o 404 renderiza com a casca pública (header mostra "Entrar/Cadastrar") — aceito (A4/H-4), sem vazar PII.
- **EC-2** WHEN o corpo do termo está indisponível (`TERM_BODY_UNAVAILABLE`) THEN `TermMarkdown` SHALL renderizar o texto de fallback como parágrafo, sem quebrar.
- **EC-3** WHEN o corpo do termo contém HTML-like (`<script>`, `<b>`) THEN o renderer SHALL exibi-lo como texto inerte (ver CASCA59-MN-04).
- **EC-4** WHEN um papel/status do painel não tem chave no mapa THEN o badge SHALL cair no valor cru (fallback), sem quebrar — mas os valores conhecidos (todos os `Role`/`PersonStatus` atuais) têm rótulo.
- **EC-5** WHEN `/termos` ou `/privacidade` é acessada por usuário logado THEN responde igual (placeholder público), sem exigir sessão.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | ------------------------------------- | -------- | ----------- | ------------- |
| CASCA59-MN-01 | WHEN a página 404 é montada THEN SHALL NOT importar/consumir sessão, `getCurrentPerson`, View Models, `@/shared/lib/prisma` ou Server Actions, nem renderizar PII/dado autenticado. | Vazamento de PII na página de erro; quebra do contrato estático/sem-auth da casca (CASCA-MN-01). | T1 | Guard de import sobre `not-found.tsx` (mesmo estilo de `casca-no-auth-pii.test.ts`). |
| CASCA59-MN-02 | WHEN `/termos` ou `/privacidade` renderiza THEN SHALL NOT apresentar conteúdo jurídico fabricado/oficial, nem oferecer ação de aceite; SHALL exibir o placeholder honesto "em elaboração". | Publicar texto jurídico inventado (risco LGPD/compliance); D-002 é gate humano. | T3 | Teste: marcador de placeholder presente, sem checkbox/botão de aceite, sem corpo de termo carregado. |
| CASCA59-MN-03 | WHEN o Markdown do termo é renderizado THEN SHALL NOT introduzir dependência nova (react-markdown/remark/rehype/marked/markdown-it). | Violação da regra de deps proibidas (CLAUDE.md). | T4 | Guard: `package.json` sem lib de markdown. |
| CASCA59-MN-04 | WHEN o corpo do termo contém HTML THEN o renderer SHALL NOT emitir HTML injetado do conteúdo (sem `dangerouslySetInnerHTML` do corpo); HTML-like renderiza como texto inerte. | Injeção de HTML/script via conteúdo de termo (XSS). | T4 | Teste: input `<script>…`/`<b>…` renderiza como texto literal, sem elemento `<script>`/`<b>` no DOM. |
| CASCA59-MN-05 | WHEN o painel consolidado renderiza badges THEN SHALL NOT exibir tokens de enum crus (`CANDIDATE`, `PROVIDER`, … `ATIVO`, `INATIVO`, `ACTIVE`, `PENDING`, `DRAFT`, …) ao usuário. | Vazar tokens internos de enum a usuários de staff (SOC-4). | T9 | Teste: painel com fixture renderiza rótulos PT-BR; nenhum token cru presente. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PUB3-1 | PUB-3/SOC-3 | Tasks | Implementing |
| PUB3-2 | PUB-3/SOC-3 | Tasks | Implementing |
| PUB3-3 | PUB-3/SOC-3 | Tasks | Implementing |
| PUB3-4 | PUB-3/SOC-3 | Tasks | Implementing |
| PUB4-1 | PUB-4 | Tasks | Implementing |
| PUB4-2 | PUB-4 | Tasks | Implementing |
| AUTH2-1 | AUTH-2 | Tasks | Implementing |
| AUTH2-2 | AUTH-2 | Tasks | Implementing |
| AUTH2-3 | AUTH-2 | Tasks | Implementing |
| AUTH6-1 | AUTH-6/EMP-7 | Tasks | Implementing |
| AUTH6-2 | AUTH-6/EMP-7 | Tasks | Implementing |
| AUTH6-3 | AUTH-6/EMP-7 | Tasks | Implementing |
| AUTH6-4 | AUTH-6/EMP-7 | Tasks | Implementing |
| SOC4-1 | SOC-4 | Tasks | Implementing |
| SOC4-2 | SOC-4 | Tasks | Implementing |
| SOC4-3 | SOC-4 | Tasks | Implementing |
| SOC4-4 | SOC-4 | Tasks | Implementing |
| SOC6-1 | SOC-6 | Tasks | Implementing |
| SOC6-2 | SOC-6 | Tasks | Implementing |
| SOC6-3 | SOC-6 | Tasks | Implementing |
| CASCA59-MN-01 | PUB-3 | Tasks | Implementing |
| CASCA59-MN-02 | AUTH-2 | Tasks | Implementing |
| CASCA59-MN-03 | AUTH-6 | Tasks | Implementing |
| CASCA59-MN-04 | AUTH-6 | Tasks | Implementing |
| CASCA59-MN-05 | SOC-4 | Tasks | Implementing |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 25 total (20 ACs + 5 must-nots), all mapped to tasks in `tasks.md`.

---

## Success Criteria

- [x] `/rota-inexistente` mostra 404 PT-BR com casca e botão para a home (não o texto em inglês do Next).
- [x] `<link rel="icon">` presente no `<head>`; favicon "A" azul visível na aba.
- [x] `/termos` e `/privacidade` = 200 com casca + aviso "em elaboração"; link do cadastro deixa de ser 404.
- [x] Termos exibidos formatados nos 5 pontos; nenhuma sintaxe Markdown crua visível; zero dependência nova.
- [x] Painel consolidado e `pessoas/[id]` exibem papéis/status em PT-BR; nenhum enum cru.
- [x] USP-037 spec + TD §3.5 dizem "Candidato encaminhado pela ASONSEG"; `src/**` intocado.
- [x] Todos os testes (incluindo os 5 negativos de must-not) passam; build/lint/typecheck verdes.
