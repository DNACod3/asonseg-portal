# PROJECT — Portal de Empregabilidade e Serviços ASONSEG

> **Fonte da verdade IDSD.** Este documento é uma síntese operacional para o pipeline Bravi SPEC Driven. O conteúdo canônico vive em `docs/IDSD/prd/prd-asonseg-portal-mvp.md`, `docs/IDSD/architecture/architecture-document.md` e `docs/IDSD/architecture/project-guideline.md`. Em caso de conflito, **o IDSD prevalece** e este arquivo deve ser atualizado.

## Visão

Portal Web (PWA, online-only, PT-BR) da ONG **Ação Social Nossa Senhora de Guadalupe** que conecta a comunidade de Florianópolis (Canasvieiras, Jurerê, Ingleses e adjacências) a **vagas**, **serviços locais** e **oportunidades de trabalho**. O MVP entrega o portal de empregabilidade + a **fundação compartilhada** do sistema ASONSEG: Pessoa unificada com papéis compostos, consentimentos LGPD por finalidade, auditoria imutável e visão consolidada para gestão social.

Diferencial institucional: a ASONSEG não é só vitrine — atua **ativamente** encaminhando Pessoas para vagas com badge "Encaminhado por ASONSEG" (ver `IDSD/prd/ADR-0016-encaminhamento-entidade-dominio-social.md`).

## Personas

Detalhes em `IDSD/prd/prd-asonseg-portal-mvp.md §2.2–2.8`.

- **Candidato** — pessoa da comunidade buscando trabalho. Auto-cadastro, busca de vagas, candidatura silenciosa.
- **Empresa-responsável** — pessoa que representa Empresa (CNPJ); publica vagas, busca candidatos ativos.
- **Prestador de serviço** — pessoa (PF ou em nome de Empresa) que oferece serviços; publica anúncios, recebe manifestações.
- **Cliente de serviço** — pessoa que contrata serviços; papel ativado automaticamente na 1ª manifestação.
- **Assistente social (AS)** — profissional interno; cadastra Pessoa em situação extrema, ficha socioeconômica, encaminha, acessa dados sensíveis.
- **Coordenador Portal** — voluntário sênior interno; modera conteúdo, valida Empresa, delega permissões.
- **Diretoria** — dirigentes; configuração global (regiões, categorias, prazos), DPO, relatórios.

## Objetivos

1. Estabelecer canal **estruturado** de empregabilidade e serviços, eliminando dependência de canais informais (WhatsApp, mural físico).
2. Preservar o papel **institucional ativo** da ASONSEG via encaminhamento com badge (ADR-0016).
3. Operar com **qualidade controlada** via moderação humana pré-publicação de vagas, CVs e serviços (ADR-0015).
4. Construir **fundação compartilhada** (Pessoa, papéis, LGPD, auditoria) reaproveitável no Release 2 (~30% de redução de custo esperada).
5. **Conformidade LGPD desde o dia 1** — consentimentos por finalidade, auditoria imutável, retenção indefinida com direito de acesso em 15 dias (ADR-0008, ADR-0013, ADR-0023).

## Métricas de Sucesso (MP)

Detalhes em `IDSD/prd/prd-asonseg-portal-mvp.md §4`. Metas absolutas ainda dependem de **DEC-024** (owner: sponsor).

| ID | Métrica | Proposta inicial |
|----|---------|------------------|
| MP1  | Candidatos com perfil ativo (moderado) | 200–500 |
| MP2  | Empresas verificadas (≥1 vaga aprovada) | 30–100 |
| MP3  | Prestadores ativos (≥1 serviço aprovado) | 50–150 |
| MP4  | Vagas publicadas/aprovadas (acumulado) | 50–200 |
| MP6  | Candidaturas realizadas | a definir |
| MP10 | Tempo médio de moderação (envio → decisão) | < 72h |

## Constraints

- **LGPD** (Lei 13.709/2018) — múltiplos titulares, 8 finalidades distintas; cascata de revogação (ADR-0013, ADR-0025).
- **Custo operacional** — orçamento inicial R$ 50k; **TCO mínimo é diretriz arquitetural dominante** (ADR-0010). Proíbe microsserviços, mensageria pesada (Kafka, RabbitMQ), múltiplas bases.
- **Idioma** — PT-BR único, sem i18n no MVP. Público com baixo letramento digital.
- **Disponibilidade** — janela 8h–21h; online-only (sem offline).
- **Regulatória** — termo de responsabilidade do prestador/empresa/cliente cobre isenção da ASONSEG por relações comerciais e trabalhistas.

## Stack Oficial

Detalhes em `IDSD/architecture/architecture-document.md §4`. Restrições em `CLAUDE.md §"Forbidden"`.

| Camada | Tecnologia |
|--------|------------|
| Linguagem | TypeScript 5.x strict |
| Framework | Next.js 15 (App Router, RSC, Server Actions) |
| ORM / DB | Prisma 5.x + PostgreSQL 15 (Supabase, sa-east-1) |
| Auth | Supabase Auth (e-mail/senha) — sem RLS, authz no app |
| Storage | Supabase Storage (privado, URLs assinadas) |
| Validação | Zod 3.x |
| UI | shadcn/ui + Tailwind + Radix + React Hook Form |
| IA | Anthropic Claude Haiku (ZDR obrigatório) via porta `CVExtractor` |
| Anti-abuso | Cloudflare Turnstile + lockout `(email,IP)` + rate limit |
| E-mail | SMTP gerenciado (Resend/SES) via outbox pós-commit |
| Infra | Vercel + Vercel Cron; GitHub Actions |
| Testes | Vitest (unit/int) + Playwright (E2E); meta cobertura 70% (CI falha < 65%) |

**Stack restrito** — *sem*: Redux/Zustand/Jotai, ORMs alternativos, Redis, Kafka/RabbitMQ, microsserviços, CSS-in-JS, libs de data alternativas ao date-fns.

## Módulos de Domínio (11)

Sob `src/modules/`, cada um com estrutura canônica (`actions/ queries/ domain/ schemas/ components/ views/ ports/ adapters/`). Import sempre via barrel.

`identity` · `persons` · `companies` · `consents` · `moderation` · `jobs` · `services` · `referrals` · `cv-extraction` · `audit` · `reporting`

## Referências Canônicas IDSD

| Tópico | Arquivo IDSD |
|--------|--------------|
| Requisitos funcionais e ACs (44 USPs) | `IDSD/prd/prd-asonseg-portal-mvp.md` |
| Visão arquitetural | `IDSD/architecture/architecture-document.md` |
| Contratos, diagramas de sequência, schemas | `IDSD/architecture/technical-design.md` |
| Padrões operacionais (DoD, Server Actions, View Models) | `IDSD/architecture/project-guideline.md` |
| ADRs de negócio (0001–0018) | `IDSD/prd/ADR-*.md` |
| ADRs técnicos (0019–0030) | `IDSD/architecture/adrs/*.md` |
| Intents por USP (cenários de fracasso/sucesso) | `IDSD/ice-portal-asonseg/intents/intent-USP-*.md` |
| Expectations por USP (EARS) | `IDSD/ice-portal-asonseg/expectations/expectations-USP-*.md` |
| Matriz de conexões USP × ADR × métrica × risco | `IDSD/ice-portal-asonseg/matriz-conexoes.md` |
| Runbooks operacionais | `IDSD/architecture/runbooks/` |
| Decisões pendentes (gate de fase) | `IDSD/architecture/pending-decisions.md` |
