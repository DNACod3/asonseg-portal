# ASONSEG — Portal de Empregabilidade e Serviços

**Vision:** Portal web (PWA + responsivo, online-only) da ONG ASONSEG que conecta candidatos a vagas e prestadores de serviço a clientes locais em Florianópolis/SC, substituindo canais informais por um canal estruturado com moderação humana e ponte institucional via encaminhamento.
**For:** Comunidade beneficiada pela ASONSEG (candidatos, prestadores), empresas e clientes locais, e a equipe interna (assistente social, coordenação do portal, diretoria).
**Solves:** A intermediação informal e não rastreável entre quem precisa de trabalho/serviço e quem oferece — sem moderação, sem proteção de dados (LGPD) e sem capacidade da ONG de medir impacto social.

## Goals

- Conectar pessoas a oportunidades de forma estruturada e moderada: cada vaga/CV/serviço passa por moderação humana pré-publicação (alvo: tempo médio de moderação < 72h — MP10).
- Estabelecer a fundação compartilhada do ecossistema ASONSEG (Pessoa unificada, papéis compostos, auth/autorização, consentimentos LGPD, auditoria imutável) sobre a qual o Release 2 (Frente 4 — assistência social) será construído.
- Medir impacto: indicadores em tempo real (MP1–MP10) — candidatos/empresas/prestadores ativos, vagas/serviços publicados, candidaturas, manifestações, encaminhamentos e % de encaminhamentos com resultado positivo.
- Operar com custo mínimo (diretriz arquitetural dominante): US$ 5–15/mês inicial, escalando a US$ 100–150/mês na expansão.

## Tech Stack

**Core:**

- Framework: Next.js 15.x (App Router, Server Components first, Server Actions) — Node.js 20 LTS
- Language: TypeScript 5.x strict (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- Database: Postgres 15+ via Supabase (sa-east-1) + Prisma 5.x (sem RLS — autorização na camada de aplicação)

**Key dependencies:** Zod 3.x (validação), shadcn/ui + Tailwind + Radix (UI), React Hook Form, date-fns + date-fns-tz (`America/Sao_Paulo`), pino + Sentry (observabilidade), Resend (e-mail), `@anthropic-ai/sdk` (extração CV, encapsulado), Cloudflare Turnstile (CAPTCHA), Vitest + Playwright (testes).

**Infra:** Vercel (hosting), Supabase (Postgres/Storage/Auth), Cloudflare Turnstile, Anthropic Claude (pay-as-you-go), Backblaze B2 (backup duplo noturno).

## Scope

**v1 (MVP / Release 1) includes:**

- Identidade unificada: Pessoa com papéis compostos (login único), auto-cadastro com CAPTCHA, cadastro pela AS em situação extrema, reivindicação de credencial, permissões delegáveis a voluntários.
- Cadastros públicos: candidato, prestador, cliente, e Empresa (entidade sem login, vínculo N:N com Pessoa-responsável).
- Moderação humana pré-publicação de vagas, CVs e serviços (máquina de estados); validação manual de Empresa na 1ª vaga.
- Vagas (com validade/expiração automática) + candidaturas silenciosas + busca ativa de candidatos.
- Serviços (PF ou via Empresa) + manifestação de interesse com revelação de contato.
- Ficha socioeconômica mínima + encaminhamento institucional ASONSEG + visão consolidada da Pessoa.
- Extração de CV via IA generativa (best effort, validação humana obrigatória).
- Home pública com indicadores em tempo real + relatórios operacionais (CSV/PDF).
- Consentimentos LGPD por finalidade (8 finalidades), notificações por e-mail, auditoria imutável transversal.

**Explicitly out of scope:**

- Família estruturada, triagem, estoque, distribuição, vendas (→ Frente 4 / Release 2).
- Gestão de status de candidatura (Kanban), denúncia estruturada, convite por e-mail a responsável de Empresa (→ V2).
- Consulta automática à Receita Federal (só dígito verificador de CNPJ); WhatsApp/push (só e-mail); SEO técnico; busca semântica/FTS (só match exato, ordenação por mais recente).
- App mobile nativo / modo offline (PWA + responsivo cobrem; online-only); avaliações/reputação, mensagens internas, pagamentos, i18n (só PT-BR).

## Constraints

- **Timeline:** ~18–24 semanas (Fase 0 a Lançamento). Escopo fechado, preço fixo. Orçamento inicial R$ 50k (estimativa qualitativa do PO R$ 80–150k considerando a fundação compartilhada).
- **LGPD:** consentimento por finalidade + legítimo interesse; DPO designado antes do go-live (bloqueante); direito de acesso em até 15 dias; criptografia em repouso de dados sensíveis; termo do `CV_AI_EXTRACTION` cita o provedor LLM.
- **Performance:** p95 interativo ≤ 2s; home ≤ 1.5s; extração CV ≤ 30s (assíncrona). **Disponibilidade:** 99% no horário operacional (8h–21h).
- **Acessibilidade:** WCAG 2.1 AA; público de baixo letramento digital. **Localização:** PT-BR, fuso América/São_Paulo, BRL.
