# Roadmap

**Current Milestone:** Lançamento (UAT + cutover)
**Status:** UAT completo de execução realizado em **2026-07-11** (8 testadores autônomos, todos os perfis e fluxos das Fases 1–7, build de produção local; dossiê em `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`). Resultado: núcleo sólido (moderação/FSM, PII/anonimização, LGPD, auditoria, USP-017 e2e), porém **1 P0 + 14 P1** de fluxo/UX — destaque: pós-login cai em 404 (`/inicio` nunca foi criado). Criada a **Fase 8 — Remediação do UAT** (12 unidades executáveis, sem mudança de arquitetura) e a **Fase 9 — Itens de avaliação humana** (não despachável pelo loop). Lançamento (UAT com sponsor + cutover) fica gated pela Fase 8.

Faseamento derivado do plano da arquitetura (~18–24 semanas). Os 13 épicos do PRD (44 user stories, IDs `USP-001`…`USP-044`) — mais `USP-045` (reativar Pessoa) e `USP-046`…`USP-048` (fachada pública — Fase 7), todas **extras ao PRD/board** — mapeados a features versionadas em `.specs/features/`.

> **Formato executável (contrato lido por `spec-driven-execution`).** Cada unidade é uma linha-USP marcável. O loop pega a primeira `[ ]` cujas `deps` estejam todas `[x]` e cujo `gate` esteja livre.
> ```
> - [ ] USP-NNN — Título · epic: <slug> · dir: .specs/features/<epic>/usp-NNN-slug/ · deps: USP-XXX | — · gate: B-NNN | —
> ```
> `gate:` = blocker que trava o **desenvolvimento** (raro); gates de go-live/deploy do STATE (ex.: B-001) **não** param o loop. Dependência entre USPs vai em `deps:`.
>
> **Estado:** Fases 1–6 estão no formato executável (linha-a-USP, reconciliadas por git log em 2026-07-06). A **Fase 0** é provisionamento de infra (não é USP) e **não é despachada pelo loop** — reconciliar/executar à mão. `deps` são best-effort (derivadas das histórias/domínio); confirmar contra PRD/board na revisão.

---

## Fase 0 — Setup e Spikes (1-2 sem)

**Goal:** Ambiente provisionado e riscos técnicos validados antes de qualquer código de domínio.
**Target:** Vercel/Supabase/Resend/Sentry/Turnstile/Anthropic provisionados; drill de restore executado.

> **Infra — não despachada pelo loop.** Provisionamento/spikes manuais; reconciliar à mão (não são USPs).

- Provisionar Vercel, Supabase, Resend, Sentry, Cloudflare Turnstile, Anthropic
- Spikes: Pooler + Prisma, Turnstile, Claude (extração CV)
- Validar elegibilidade Vercel para ONG; checklist de Empresa-fantasma; regiões/categorias iniciais (seed — épico `seed-taxonomia-checklists`)
- Drill de restore (backup Backblaze B2)

---

## Fase 1 — Identidade + Consentimentos (3-4 sem)

**Goal:** Pessoa pode se cadastrar, autenticar e dar consentimento; auditoria e autorização operantes.

### Unidades

- [x] USP-001 — Auto-cadastro de Pessoa · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-001-auto-cadastro/ · deps: — · gate: —
- [x] USP-002 — Cadastro de Pessoa pela assistente social · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-002-cadastro-as/ · deps: — · gate: —
- [x] USP-003 — Reivindicar credencial de Pessoa pré-cadastrada · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-003-reivindicar-credencial/ · deps: USP-002 · gate: —
- [x] USP-004 — Autenticar no portal (login) · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-004-login/ · deps: USP-001 · gate: —
- [x] USP-005 — Recuperar senha esquecida · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-005-recuperar-senha/ · deps: USP-004 · gate: —
- [x] USP-006 — Ativar papel adicional na Pessoa autenticada · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-006-ativar-papel/ · deps: USP-004 · gate: —
- [x] USP-007 — Inativar Pessoa · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-007-inativar-pessoa/ · deps: USP-002 · gate: —
- [x] USP-008 — Configurar permissões delegadas a voluntário · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-008-permissoes-delegadas/ · deps: USP-004 · gate: —
- [x] USP-045 — Reativar Pessoa (fluxo inverso da USP-007) · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-045-reativar-pessoa/ · deps: USP-007 · gate: —
- [x] USP-043 — Consentimentos por finalidade (LGPD) · epic: consentimentos-lgpd · dir: .specs/features/consentimentos-lgpd/usp-043-consentimentos/ · deps: USP-001 · gate: —

> Transversal nesta fase: `audit` (`withAudit` + `audit_log` append-only) — habilita todas as fases seguintes.
> Estado reconciliado por git log/PRs mergeadas em 2026-07-06 — Fase 1 100% concluída. `deps` são best-effort (derivadas das histórias); confirmar contra PRD/board na revisão.

---

## Fase 2 — Empresas + Vagas + Moderação (4-5 sem)

**Goal:** Empresa cadastrada publica vaga moderada e aprovada; conteúdo flui pela máquina de estados.

### Unidades

- [x] USP-012 — Cadastro de Empresa · epic: cadastros-publicos · dir: .specs/features/cadastros-publicos/usp-012-cadastro-empresa/ · deps: USP-004 · gate: —
- [x] USP-013 — Adicionar responsável a uma Empresa · epic: vinculos-pessoa-empresa · dir: .specs/features/vinculos-pessoa-empresa/usp-013-adicionar-responsavel/ · deps: USP-012 · gate: —
- [x] USP-014 — Remover responsável de uma Empresa · epic: vinculos-pessoa-empresa · dir: .specs/features/vinculos-pessoa-empresa/usp-014-remover-responsavel/ · deps: USP-012 · gate: —
- [x] USP-015 — Editar dados da Empresa · epic: vinculos-pessoa-empresa · dir: .specs/features/vinculos-pessoa-empresa/usp-015-editar-empresa/ · deps: USP-012 · gate: —
- [x] USP-016 — Moderar rascunho (vaga, CV ou serviço) · epic: moderacao-conteudo · dir: .specs/features/moderacao-conteudo/usp-016-moderar-rascunho/ · deps: USP-008 · gate: —
- [x] USP-017 — Validar Empresa na primeira vaga publicada · epic: moderacao-conteudo · dir: .specs/features/moderacao-conteudo/usp-017-validar-empresa-primeira-vaga/ · deps: USP-012 · gate: —
- [x] USP-018 — Inativar conteúdo já publicado · epic: moderacao-conteudo · dir: .specs/features/moderacao-conteudo/usp-018-inativar-conteudo/ · deps: USP-016 · gate: —
- [x] USP-019 — Sugerir nova categoria de serviço ou área de vaga · epic: moderacao-conteudo · dir: .specs/features/moderacao-conteudo/usp-019-sugerir-categoria/ · deps: — · gate: —
- [x] USP-020 — Publicar vaga · epic: vagas · dir: .specs/features/vagas/usp-020-publicar-vaga/ · deps: USP-012, USP-016 · gate: —
- [x] USP-021 — Buscar vagas (pública) · epic: vagas · dir: .specs/features/vagas/usp-021-buscar-vagas-publica/ · deps: USP-020 · gate: —
- [x] USP-022 — Ver detalhe da vaga · epic: vagas · dir: .specs/features/vagas/usp-022-detalhe-vaga/ · deps: USP-020 · gate: —
- [x] USP-023 — Editar vaga (pausar, arquivar, renovar) · epic: vagas · dir: .specs/features/vagas/usp-023-editar-vaga/ · deps: USP-020 · gate: —
- [x] USP-024 — Expiração automática de vaga · epic: vagas · dir: .specs/features/vagas/usp-024-expiracao-automatica/ · deps: USP-020 · gate: —

---

## Fase 3 — Candidaturas + Busca + Extração de CV (3-4 sem)

**Goal:** Candidato cadastra perfil/CV (com extração por IA), busca e se candidata; empresa busca candidatos.

### Unidades

- [x] USP-009 — Cadastro de candidato (papel) · epic: cadastros-publicos · dir: .specs/features/cadastros-publicos/usp-009-cadastro-candidato/ · deps: USP-001 · gate: —
- [x] USP-025 — Candidatar-se a uma vaga · epic: candidaturas-busca-candidatos · dir: .specs/features/candidaturas-busca-candidatos/usp-025-candidatar-se/ · deps: USP-009, USP-020 · gate: —
- [x] USP-026 — Cancelar candidatura · epic: candidaturas-busca-candidatos · dir: .specs/features/candidaturas-busca-candidatos/usp-026-cancelar-candidatura/ · deps: USP-025 · gate: —
- [x] USP-027 — Empresa ver lista de candidatos da vaga · epic: candidaturas-busca-candidatos · dir: .specs/features/candidaturas-busca-candidatos/usp-027-empresa-ver-candidatos/ · deps: USP-025, USP-012 · gate: —
- [x] USP-028 — Empresa buscar candidatos (busca ativa) · epic: candidaturas-busca-candidatos · dir: .specs/features/candidaturas-busca-candidatos/usp-028-empresa-buscar-candidatos/ · deps: USP-009, USP-012 · gate: —
- [x] USP-040 — Extração automática de CV via IA generativa · epic: extracao-cv-ia · dir: .specs/features/extracao-cv-ia/usp-040-extracao-cv/ · deps: USP-009 · gate: —

---

## Fase 4 — Serviços + Manifestações (2-3 sem)

**Goal:** Prestador publica serviço moderado; cliente manifesta interesse e recebe contato.

### Unidades

- [x] USP-010 — Cadastro de prestador de serviço (papel) · epic: cadastros-publicos · dir: .specs/features/cadastros-publicos/usp-010-cadastro-prestador/ · deps: USP-001 · gate: —
- [x] USP-011 — Cadastro de cliente de serviço (papel) · epic: cadastros-publicos · dir: .specs/features/cadastros-publicos/usp-011-cadastro-cliente/ · deps: USP-001 · gate: —
- [x] USP-029 — Publicar serviço · epic: servicos · dir: .specs/features/servicos/usp-029-publicar-servico/ · deps: USP-010, USP-016 · gate: —
- [x] USP-030 — Buscar serviços (pública) · epic: servicos · dir: .specs/features/servicos/usp-030-buscar-servicos/ · deps: USP-029 · gate: —
- [x] USP-031 — Ver detalhe do serviço · epic: servicos · dir: .specs/features/servicos/usp-031-detalhe-servico/ · deps: USP-029 · gate: —
- [x] USP-032 — Editar serviço (pausar, arquivar) · epic: servicos · dir: .specs/features/servicos/usp-032-editar-servico/ · deps: USP-029 · gate: —
- [x] USP-033 — Manifestar interesse em serviço · epic: manifestacao-interesse-servico · dir: .specs/features/manifestacao-interesse-servico/usp-033-manifestar-interesse/ · deps: USP-011, USP-029 · gate: —
- [x] USP-034 — Cancelar manifestação de interesse · epic: manifestacao-interesse-servico · dir: .specs/features/manifestacao-interesse-servico/usp-034-cancelar-manifestacao/ · deps: USP-033 · gate: —
- [x] USP-035 — Prestador ver manifestações de interesse · epic: manifestacao-interesse-servico · dir: .specs/features/manifestacao-interesse-servico/usp-035-prestador-ver-manifestacoes/ · deps: USP-033, USP-010 · gate: —

---

## Fase 5 — Ficha Social + Encaminhamento + Visão Consolidada (2 sem)

**Goal:** AS registra ficha, encaminha Pessoa a vaga e acompanha resultado; visão consolidada disponível.

### Unidades

- [x] USP-036 — Cadastrar ficha socioeconômica da Pessoa · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-036-ficha-socioeconomica/ · deps: USP-002 · gate: —
- [x] USP-037 — Encaminhar Pessoa para vaga · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/ · deps: USP-036, USP-020 · gate: —
- [x] USP-038 — Registrar resultado do encaminhamento manualmente · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-038-registrar-resultado/ · deps: USP-037 · gate: —
- [x] USP-039 — Visão consolidada da Pessoa · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/ · deps: USP-036 · gate: —

---

## Fase 6 — Relatórios + Home + Hardening + LGPD (2-3 sem)

**Goal:** Home pública com indicadores, relatórios operacionais, painel de consentimentos e hardening final.

### Unidades

- [x] USP-041 — Home pública com indicadores em tempo real · epic: indicadores-relatorios · dir: .specs/features/indicadores-relatorios/usp-041-home-indicadores/ · deps: — · gate: —
- [x] USP-042 — Relatórios operacionais do Portal · epic: indicadores-relatorios · dir: .specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/ · deps: — · gate: —
- [x] USP-044 — Notificações por e-mail em eventos do portal · epic: notificacoes-email · dir: .specs/features/notificacoes-email/usp-044-notificacoes-email/ · deps: — · gate: —

> **Hardening de segurança** entregue como unidade ad-hoc U3 (AD-023): CAPTCHA adaptativo no login, headers de segurança em `/api`, guard estático de Server Actions, redação de PII no logger + guard anti-`console.*`, piso de flags de cookie de sessão. **Painel de revogação de consentimentos já existia** (USP-043). **Revisão LGPD com DPO** e as demais frentes LGPD (direito ao esquecimento/anonimização, política de retenção de PII operacional, cascade `ANONIMIZAR`) ficam **deferidas** — gated por **B-001** (DPO não designado), fora do escopo de dev. Ver AD-023 §Deferidos.

---

## Fase 7 — Fachada Pública (Landing + Casca de Navegação) (1-2 sem)

**Goal:** O portal "abre como o protótipo" — casca de navegação global (header + footer), home/landing pública fiel a `docs/prototipo/index.html` e navegação integrada entre as telas públicas já prontas. Fecha o gap entre "features implementadas" e "experiência do protótipo".
**Target:** Home renderiza hero + busca + destaques (vagas/serviços) + seções institucionais + CTAs, todos sobre os tokens de `globals.css`; toda tela pública compartilha header (com navegação) e footer; os CTAs/links resolvem para as rotas reais já entregues (vagas, serviços, cadastros).

### Unidades

- [x] USP-046 — Casca de navegação pública (Header + Footer globais) · epic: fachada-publica · dir: .specs/features/fachada-publica/usp-046-casca-navegacao/ · deps: — · gate: —
- [x] USP-047 — Home/landing pública fiel ao protótipo · epic: fachada-publica · dir: .specs/features/fachada-publica/usp-047-home-landing/ · deps: USP-046, USP-041 · gate: —
- [x] USP-048 — Navegação integrada das telas públicas (vagas, serviços, cadastros) · epic: fachada-publica · dir: .specs/features/fachada-publica/usp-048-navegacao-integrada/ · deps: USP-046, USP-047, USP-021, USP-030 · gate: —

> **Por que existe.** As Fases 1–6 entregaram os módulos e as páginas de cada fluxo, mas a home pública (`src/app/(public)/page.tsx`) segue no esqueleto de inicialização da Fase 1 ("Esqueleto do monolito modular inicializado") e o app não tem casca de site (nenhum Header/Nav/Footer global; o `layout.tsx` raiz só renderiza `{children}` + `ThemeToggle`). Do protótipo, só o **design system** foi portado (tokens/fontes/dark mode em `globals.css`/`layout.tsx`) — não a composição da landing nem a navegação unificada (`showPage()`). Estas 3 unidades são **net-new** (não constam das 44 USPs do PRD, como a USP-045).
> **Escopo por USP:** USP-046 = casca do grupo `(public)` (header com navegação + links Entrar/Cadastrar + footer). USP-047 = reconstrói `(public)/page.tsx` reproduzindo o `page-home` do protótipo; **estende — não descarta** — os indicadores da USP-041 (`HomeIndicatorsView`). USP-048 = liga os CTAs/nav às rotas reais já entregues, reproduzindo o fluxo `showPage()` (`/vagas`, `/servicos`, cadastros).
> **Precede o Lançamento:** UAT/cutover pressupõem a fachada pronta — não se valida o MVP com a home no esqueleto.

---

## Fase 8 — Remediação do UAT (correções de fluxo, sem mudança de arquitetura) (1-2 sem)

**Goal:** Todos os achados executáveis do UAT de 2026-07-11 corrigidos: nenhum fluxo termina em 404/beco sem saída, formulários confiáveis pré/pós-hidratação, cache público coerente com o ciclo de vida, moderação cobrindo CV, cascata LGPD aplicada e relatórios legíveis.
**Target:** Dossiê `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — coluna "Fase 8" 100% fechada; smoke pós-fase: login→hub→fluxo por papel sem 404 em nenhum perfil do seed.

> **Fonte da verdade das unidades:** cada USP abaixo referencia os IDs de achado do dossiê (tabela Fase 8), que ancoram cada correção em AC/spec/PRD/protótipo. **Premissas:** não alterar arquitetura nem premissas técnicas estabelecidas; não inventar regras — na dúvida, a spec/AC citada no dossiê manda. Unidades são net-new (USP-049…USP-060, fora do PRD/board, como USP-045…048).

### Unidades

- [x] USP-049 — Pós-login: rota /inicio (hub por papel), redirects corrigidos, /perfil real mínimo, logout · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-049-pos-login-hub/ · deps: — · gate: — · achados: ORQ-1, AUTH-1, AUTH-3, AUTH-4
- [x] USP-050 — Rate limiting: parse de flag robusto, buckets por mutação, exclusão de prefetch, página 429 PT-BR · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-050-rate-limiting/ · deps: — · gate: — · achados: PUB-1, PUB-2, SOC-1
- [ ] USP-051 — Robustez de formulários: fallback GET do login, CSP dev, RangeError de data, noValidate, bodySizeLimit CV, texto /trocar-senha · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-051-robustez-forms/ · deps: — · gate: — · achados: ORQ-2, ORQ-3, EMP-1, EMP-6, CAND-5, AUTH-7
- [ ] USP-052 — Perfil do candidato consistente: sem perda de dados no save, status real, defaultValues, gate do termo CV_AI_EXTRACTION · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-052-perfil-candidato/ · deps: — · gate: — · achados: CAND-1, CAND-2, CAND-3, CAND-6
- [ ] USP-053 — Cascata de revogação JOB_APPLICATION conforme política do domínio (encerrar candidaturas + ocultar da busca) · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-053-cascata-revogacao/ · deps: — · gate: — · achados: CAND-7
- [ ] USP-054 — Ciclo de vida da vaga no painel: ações p/ DRAFT/AWAITING_ADJUSTMENTS, motivo visível + reenvio, revalidação de cache saindo de ACTIVE, data sem -1 dia · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-054-ciclo-vida-vaga/ · deps: — · gate: — · achados: EMP-2, MOD-3, EMP-3, MOD-5
- [ ] USP-055 — Empresas: cadastro por pessoa já representante (consent reuse), radios de tipo completos, mensagem de CPF específica · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-055-empresas/ · deps: — · gate: — · achados: MOD-2, EMP-4, EMP-8
- [ ] USP-056 — Moderação: CV na fila (adapter CANDIDATE_PROFILE), heurística de justificativa, ações por permissão, confirmação em sugestões · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-056-moderacao/ · deps: — · gate: — · achados: MOD-1, MOD-6, MOD-7, MOD-8
- [ ] USP-057 — E-mails de decisão de moderação (NOT-03/04/05) via outbox na tx de transitionContent; substituir stub · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-057-emails-moderacao/ · deps: USP-056 · gate: — · achados: REL-1, MOD-4
- [ ] USP-058 — Relatórios legíveis: nome de categoria, rótulos PT-BR, filtros de status/categoria no form · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-058-relatorios/ · deps: — · gate: — · achados: REL-2, REL-3, REL-5
- [ ] USP-059 — Casca e conteúdo: not-found PT-BR, favicon, /termos e /privacidade (aviso "em elaboração"), Markdown dos termos renderizado, rótulos PT-BR na visão consolidada, alinhamento do literal do badge (docs) · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-059-casca-conteudo/ · deps: — · gate: — · achados: PUB-3, PUB-4, AUTH-2, AUTH-6, SOC-4, SOC-6
- [ ] USP-060 — Higiene de dev/seed: cleanup de fixtures de int-tests (taxonomia/pessoas), senha de seed válida, harness de e-mail local (adapter SMTP dev + CRON_SECRET local) · epic: ajustes-uat · dir: .specs/features/ajustes-uat/usp-060-higiene-dev/ · deps: — · gate: — · achados: PUB-6, SVC-3, AUTH-8, AUTH-9, REL-4

---

## Fase 9 — Itens do UAT para avaliação humana (NÃO despachável pelo loop)

> **Gate humano.** Cada item exige decisão de dono/PO/DPO ou reconciliação de specs antes de virar unidade executável. Detalhes e evidências na tabela "Fase 9" do dossiê `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`. Nenhum item está no formato de linha-USP de propósito (o loop não deve pegá-los).

- H-1 — Indicador da home (E-001 literal) × lista pública com gate `isVerified`: qual conta vale?
- H-2 — Footer "(em breve)" × CTAs reais da home: reconciliar A-07 (USP-046) com NAV-04 (USP-048).
- H-3 — App-shell autenticado completo + busca/lista de Pessoas para AS (Épico 9 navegável) — envolve nota de privacidade ADR-0014 (PO+DPO).
- H-4 — Header público refletir sessão × casca estática ISR (CASCA-MN-01).
- H-5 — Edição de conteúdo/perfil ACTIVE exige re-moderação? (nenhuma spec cobre edição pós-aprovação).
- H-6 — Papel Cliente self-service em /perfil/papeis × USP-011 "sem UI de cadastro de cliente": reconciliar specs.
- H-7 — Detalhe de vaga inativada: 200 "Vaga encerrada" × null/404 da spec (sem vazamento; confirmar e alinhar).
- H-8 — Ampliação do seed de validação (mais coordenadores; usuário `primeiroAcesso=true`).

---

## Lançamento (1 sem)

**Goal:** Sistema validado e em produção.

- UAT com sponsor; documentação operacional; treinamento de moderadores e AS; cutover.
- **Pré-requisito:** Fase 8 concluída; itens da Fase 9 decididos ou aceitos como estão pelo sponsor.

---

## Future Considerations (Release 2 / Frente 4 — fora do MVP)

- Família estruturada, triagem, fila, indicações de necessidade
- Estoque único (fito), distribuição, vendas, caixa
- Papel BENEFICIARY / FAMILY_RESPONSIBLE, portal do beneficiário
- Kanban de candidatura, denúncia estruturada, convite por e-mail a responsável de Empresa
- Busca semântica/FTS, algoritmo de relevância, integração com redes sociais
