# ADR-0016 (Técnico) — Ambiente de desenvolvimento local via Supabase CLI

- **Status:** Aceito
- **Data:** 2026-05-26
- **Decisores:** Tech Lead, Dev
- **Tags:** dev-experience | infra | auth | storage | paridade-ambientes
- **Resolve:** Revisão da estratégia de ambiente local descrita em `architecture-document.md §7.3` (no contexto da task #97 — provisionamento)

## Contexto e Problema

A estratégia original (`architecture-document.md §7.3` e cabeçalho do `docker-compose.yml`) previa o ambiente local como **Postgres 15 + MailHog** em containers, com **Auth e Storage apontando para o projeto dev na nuvem** (sem imagem fiel) ou substituídos por **fakes via `shared/container.ts`**.

Na prática isso traz dois problemas para fluxos sensíveis do MVP:

- **Auth e Storage não são testáveis localmente com fidelidade.** Vários fluxos centrais (auto-cadastro com confirmação de e-mail, recuperação de senha, upload/download de CV com URL assinada, foto pública de prestador) dependem de GoTrue + Storage reais. Apontar para um projeto dev na nuvem cria acoplamento a um recurso compartilhado e exige rede; usar fakes não exercita o comportamento real do provedor.
- **Divergência de comportamento.** Diferenças entre o fake e o GoTrue/Storage real só aparecem em staging, tarde demais.

## Drivers de Decisão

- Paridade com produção (Supabase: Postgres 15, GoTrue, Storage) — ADR-0003, ADR-0005, ADR-T-0002
- Capacidade de testar Auth e Storage **offline**, sem depender de projeto na nuvem
- Reprodutibilidade (mesmo estado em qualquer máquina, versionado)
- Coexistência com outros projetos Supabase locais na mesma máquina
- Baixo atrito operacional (subir/parar com um comando)

## Opções Consideradas

### Opção A — docker-compose (Postgres + MailHog) + projeto dev na nuvem para Auth/Storage

- **Prós:** leve; sem imagens extras
- **Contras:** Auth/Storage exigem rede e um projeto na nuvem compartilhado; estado mutável compartilhado entre devs; não funciona offline

### Opção B — docker-compose + fakes de Auth/Storage via `shared/container.ts`

- **Prós:** rápido; sem dependência de rede
- **Contras:** não exercita o provedor real; divergência fake↔real só aparece em staging; manutenção do fake

### Opção C — Supabase CLI (stack local completa) — **escolhida**

- **Prós:** Postgres + GoTrue (Auth) + Storage + Mailpit + Studio reais e locais; offline; estado versionado no `config.toml`; buckets declarativos; paridade alta com produção
- **Contras:** baixa ~vários GB de imagens Docker na 1ª vez; mais containers em execução

## Decisão

Adotamos a **Opção C — Supabase CLI** como backend de desenvolvimento local **único**, configurado em `supabase/config.toml`:

- **Postgres fixado em 15** (`[db] major_version = 15`) — paridade com produção.
- **Portas remapeadas para a faixa 553xx** (API `55321`, DB `55322`, Studio `55323`, Mailpit `55324`, etc.) para **coexistir** com a stack local de outro projeto Supabase na mesma máquina (que ocupa as portas 543xx padrão).
- **Buckets declarativos** espelhando o ADR-0005: `cvs` (privado, 5 MiB, PDF/DOC/DOCX), `consent-terms` (privado, 10 MiB, PDF/JPG/PNG), `provider-photos` (público, 2 MiB, JPG/PNG). Criados automaticamente no `supabase start`.
- **E-mails de Auth** (confirmação, reset) capturados pelo **Mailpit** local (substitui o MailHog).
- **`.env.local`** aponta para a stack local: DB em `127.0.0.1:55322`, API/Auth/Storage em `http://127.0.0.1:55321`, com as chaves demo (públicas) do CLI.
- **Migrations Prisma** rodam contra o banco local (`DATABASE_URL`/`DIRECT_URL` na 55322) via `npm run db:migrate` / `db:deploy`.

O `docker-compose.yml` é **descontinuado** como ambiente local (mantido apenas como referência/fallback; não deve subir junto com `supabase start`, para evitar dois Postgres).

## Consequências

**Positivas:**

- Auth e Storage testáveis localmente, offline, com o provedor real.
- Paridade alta com produção (Postgres 15, GoTrue, Storage, buckets idênticos ao ADR-0005).
- Estado do ambiente versionado e reprodutível (`supabase/config.toml`).
- Dois projetos Supabase locais convivem na mesma máquina (faixas de porta distintas).

**Negativas / custos:**

- Primeira inicialização baixa vários GB de imagens Docker.
- Mais containers em execução (maior uso de RAM/CPU local).

**Operação:**

```bash
supabase start    # subir a stack (dados persistem entre start/stop)
supabase stop     # parar sem apagar dados
supabase status   # ver URLs e chaves locais
supabase db reset # recriar do zero (migrations + seed + buckets)
```

## Notas

- As chaves `anon`/`service_role` locais são fixas e públicas (demo do CLI) — não são segredo e podem constar no `.env.local`.
- O host direto de produção (`db.<ref>.supabase.co`) é IPv6-only; em produção/staging usar o **Session Pooler** (porta 5432, IPv4) no `DIRECT_URL`. Isto não afeta o ambiente local, mas é relevante para migrations em ambientes sem IPv6.
- Atualizar `architecture-document.md §7.3` e o `CLAUDE.md` (seção de comandos) para refletir esta decisão.
