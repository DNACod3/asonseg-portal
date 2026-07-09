# Roadmap

**Current Milestone:** Fase 5 — Ficha Social + Encaminhamento + Visão Consolidada
**Status:** Fase 4 **100% concluída** (9 USPs, 1 PR único, AD-020) · próxima unidade elegível: **USP-036** (Cadastrar ficha socioeconômica da Pessoa)

Faseamento derivado do plano da arquitetura (~18–24 semanas). Os 13 épicos do PRD (44 user stories, IDs `USP-001`…`USP-044`) — mais `USP-045` (reativar Pessoa, extra do board/IDSD) — mapeados a features versionadas em `.specs/features/`.

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

- [ ] USP-036 — Cadastrar ficha socioeconômica da Pessoa · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-036-ficha-socioeconomica/ · deps: USP-002 · gate: —
- [ ] USP-037 — Encaminhar Pessoa para vaga · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/ · deps: USP-036, USP-020 · gate: —
- [ ] USP-038 — Registrar resultado do encaminhamento manualmente · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-038-registrar-resultado/ · deps: USP-037 · gate: —
- [ ] USP-039 — Visão consolidada da Pessoa · epic: ficha-social-encaminhamento · dir: .specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/ · deps: USP-036 · gate: —

---

## Fase 6 — Relatórios + Home + Hardening + LGPD (2-3 sem)

**Goal:** Home pública com indicadores, relatórios operacionais, painel de consentimentos e hardening final.

### Unidades

- [ ] USP-041 — Home pública com indicadores em tempo real · epic: indicadores-relatorios · dir: .specs/features/indicadores-relatorios/usp-041-home-indicadores/ · deps: — · gate: —
- [ ] USP-042 — Relatórios operacionais do Portal · epic: indicadores-relatorios · dir: .specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/ · deps: — · gate: —
- [ ] USP-044 — Notificações por e-mail em eventos do portal · epic: notificacoes-email · dir: .specs/features/notificacoes-email/usp-044-notificacoes-email/ · deps: — · gate: —

> Hardening de segurança; revisão LGPD com DPO; painel de revogação de consentimentos (transversal, não-USP).

---

## Lançamento (1 sem)

**Goal:** Sistema validado e em produção.

- UAT com sponsor; documentação operacional; treinamento de moderadores e AS; cutover.

---

## Future Considerations (Release 2 / Frente 4 — fora do MVP)

- Família estruturada, triagem, fila, indicações de necessidade
- Estoque único (fito), distribuição, vendas, caixa
- Papel BENEFICIARY / FAMILY_RESPONSIBLE, portal do beneficiário
- Kanban de candidatura, denúncia estruturada, convite por e-mail a responsável de Empresa
- Busca semântica/FTS, algoritmo de relevância, integração com redes sociais
