# ADR-0019 — Stack, plataforma de hospedagem e ambientes (custo mínimo)

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead, aprovado pelo PO
- **Tags:** stack, infra, custo

## Contexto e Problema

O ADR-0010 (negócio) fixa **custo operacional mínimo** como diretriz dominante e delega a escolha de stack ao Arquiteto/Tech Lead, com a restrição explícita de **evitar microsserviços, mensageria pesada e múltiplas bases**. O volume do MVP é baixo (centenas de Pessoas, dezenas a centenas de vagas/serviços ativos), com o tráfego anônimo de busca pública como único componente sujeito a picos (RP-009). Precisamos decidir linguagem, framework, banco, hospedagem e ambientes de forma a atender os RNFs (§6 do PRD) ao menor TCO, sem comprometer as restrições absolutas do ADR-0010 (criptografia em repouso, log imutável, HTTPS, backup, conformidade LGPD).

## Drivers de Decisão

- TCO mínimo recorrente (ADR-0010) — orçamento de infra esperado na casa de dezenas de dólares/mês.
- Volume baixo, com fundação compartilhada rica (Pessoa, papéis, LGPD) — favorece monolito modular.
- Dado pessoal deve permanecer no Brasil quando viável (LGPD).
- Operação simples (sem time dedicado de SRE) — preferir serviços gerenciados.
- ISR / revalidação on-demand para absorver picos de tráfego anônimo na busca pública.

## Opções Consideradas

### Opção A — Next.js 15 (App Router) + Supabase (Postgres/Auth/Storage, sa-east-1) + Vercel
- **Descrição:** Um único runtime fullstack; mutações via Server Actions; Prisma sobre Postgres gerenciado; Auth e Storage do Supabase; deploy e Cron na Vercel.
- **Prós:** Um deploy, uma base; ISR nativo; serviços gerenciados (backup, patching inclusos); dado em `sa-east-1`; DX alta.
- **Contras:** Lock-in moderado na Vercel; Server Actions acoplam UI e domínio se a disciplina de módulos não for mantida (mitigado pelo ADR de estrutura).
- **Custo estimado:** ~US$ 45–70/mês (Vercel Pro ~US$20 + Supabase Pro ~US$25 + extras).

### Opção B — Container único (Fly.io/Render) + Supabase
- **Descrição:** App Next.js empacotada em container, ISR e build operados manualmente.
- **Prós:** Sem lock-in de Vercel; pode ser ligeiramente mais barato no limite.
- **Contras:** Mais carga operacional (ISR, cache, deploy, observabilidade na mão) — contraria "operação simples".
- **Custo estimado:** ~US$ 30–50/mês + horas de DevOps.

### Opção C — Self-hosted completo (VPS + Postgres próprio)
- **Descrição:** VPS único com Postgres, Next.js e storage auto-geridos.
- **Prós:** Infra nominalmente mais barata.
- **Contras:** Patch, backup, scaling e segurança manuais; abre mão de Auth/Storage gerenciados; maior risco de violar as restrições absolutas do ADR-0010 (backup/cripto).
- **Custo estimado:** ~US$ 10–25/mês + custo de operação alto.

## Decisão

Adotamos a **Opção A**. O par Next.js 15 + Supabase + Vercel entrega o menor custo *operacional total* (não só de infra) dado o time e o volume, mantém o dado pessoal em `sa-east-1`, e dá ISR/Cron prontos para os requisitos de busca pública e jobs. Provedores complementares: **Anthropic Claude (ZDR)** para extração de CV (ADR-0027), **Cloudflare Turnstile** para CAPTCHA (ADR-0029), e **SMTP gerenciado** (ex.: Resend/SES) para e-mail transacional, despachado via outbox (ADR-0020).

**Ambientes:** `local` (Supabase CLI — Postgres 15 + Auth + Storage + Mailpit, portas 553xx), `homologação` (projeto Supabase + preview Vercel) e `produção` (projeto Supabase + Vercel prod). Migrations forward-only versionadas.

## Consequências

**Positivas:**
- Um runtime, um banco, um deploy — coerente com "evitar múltiplas bases" (ADR-0010).
- Backup, patching e cripto em repouso herdados dos provedores gerenciados.
- ISR e Cron nativos cobrem RP-009 (picos) e a expiração de vaga (ADR-0026).

**Negativas (trade-offs aceitos):**
- Lock-in moderado na Vercel e no Supabase. Mitigado por portas/adapters (DI) para serviços externos e por Prisma isolando o acesso a dados.
- Server Actions exigem disciplina de módulos para não virar acoplamento — endereçado no project-guideline.

**Neutras / a monitorar:**
- Custo da Vercel pode subir se o tráfego anônimo crescer muito; reavaliar CDN/edge se p95 da busca degradar.

## Referências

- ADR-0010 (negócio — custo mínimo), §6 do PRD (RNFs).
- USPs servidas: transversal (todas). Em especial as que exigem ISR/Cron: USP-021, USP-024, USP-030, USP-041, USP-044.
