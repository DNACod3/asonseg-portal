# Roadmap

**Current Milestone:** Fase 0 — Setup e Spikes
**Status:** Planning

Faseamento derivado do plano da arquitetura (~18–24 semanas). Os 13 épicos do PRD (44 user stories, IDs `USP-001`…`USP-044`) estão mapeados a features versionadas em `.specs/features/`. Toda feature começa `PLANNED`.

---

## Fase 0 — Setup e Spikes (1-2 sem)

**Goal:** Ambiente provisionado e riscos técnicos validados antes de qualquer código de domínio.
**Target:** Vercel/Supabase/Resend/Sentry/Turnstile/Anthropic provisionados; drill de restore executado.

### Features

**Infraestrutura & Spikes** - PLANNED

- Provisionar Vercel, Supabase, Resend, Sentry, Cloudflare Turnstile, Anthropic
- Spikes: Pooler + Prisma, Turnstile, Claude (extração CV)
- Validar elegibilidade Vercel para ONG; checklist de Empresa-fantasma; regiões/categorias iniciais (seed)
- Drill de restore (backup Backblaze B2)

---

## Fase 1 — Identidade + Consentimentos (3-4 sem)

**Goal:** Pessoa pode se cadastrar, autenticar e dar consentimento; auditoria e autorização operantes.

### Features

**[identity-acesso-papeis]** (Épico 1) - PLANNED — `USP-001`…`USP-008`

- Auto-cadastro, cadastro pela AS, reivindicação de credencial, login, recuperação de senha
- Ativar papel adicional, inativar Pessoa, permissões delegadas a voluntário

**[consentimentos-lgpd]** (Épico 12) - PLANNED — `USP-043`

- Consentimentos por finalidade (8), versionamento de termo, revogação granular

> Transversal nesta fase: `audit` (`withAudit` + `audit_log` append-only) — habilita todas as fases seguintes.

---

## Fase 2 — Empresas + Vagas + Moderação (4-5 sem)

**Goal:** Empresa cadastrada publica vaga moderada e aprovada; conteúdo flui pela máquina de estados.

### Features

**[cadastros-publicos]** (Épico 2 — parcial: Empresa) - PLANNED — `USP-012`
**[vinculos-pessoa-empresa]** (Épico 3) - PLANNED — `USP-013`…`USP-015`
**[moderacao-conteudo]** (Épico 4) - PLANNED — `USP-016`…`USP-019`
**[vagas]** (Épico 5) - PLANNED — `USP-020`…`USP-024`

---

## Fase 3 — Candidaturas + Busca + Extração de CV (3-4 sem)

**Goal:** Candidato cadastra perfil/CV (com extração por IA), busca e se candidata; empresa busca candidatos.

### Features

**[cadastros-publicos]** (Épico 2 — parcial: candidato) - PLANNED — `USP-009`
**[candidaturas-busca-candidatos]** (Épico 6) - PLANNED — `USP-025`…`USP-028`
**[extracao-cv-ia]** (Épico 10) - PLANNED — `USP-040`

---

## Fase 4 — Serviços + Manifestações (2-3 sem)

**Goal:** Prestador publica serviço moderado; cliente manifesta interesse e recebe contato.

### Features

**[cadastros-publicos]** (Épico 2 — parcial: prestador/cliente) - PLANNED — `USP-010`, `USP-011`
**[servicos]** (Épico 7) - PLANNED — `USP-029`…`USP-032`
**[manifestacao-interesse-servico]** (Épico 8) - PLANNED — `USP-033`…`USP-035`

---

## Fase 5 — Ficha Social + Encaminhamento + Visão Consolidada (2 sem)

**Goal:** AS registra ficha, encaminha Pessoa a vaga e acompanha resultado; visão consolidada disponível.

### Features

**[ficha-social-encaminhamento]** (Épico 9) - PLANNED — `USP-036`…`USP-039`

---

## Fase 6 — Relatórios + Home + Hardening + LGPD (2-3 sem)

**Goal:** Home pública com indicadores, relatórios operacionais, painel de consentimentos e hardening final.

### Features

**[indicadores-relatorios]** (Épico 11) - PLANNED — `USP-041`, `USP-042`
**[notificacoes-email]** (Épico 13) - PLANNED — `USP-044`

- Hardening de segurança; revisão LGPD com DPO; painel de revogação de consentimentos

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
