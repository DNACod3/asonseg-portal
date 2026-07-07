# Runbook de provisionamento externo — Fase 0 (F0C-01)

> **Índice único de reconciliação.** Este doc NÃO substitui os runbooks por
> serviço já existentes em [`docs/infra/*`](./README.md) nem os spikes em
> [`docs/spikes/*`](../spikes/) — ele **cross-linka** e resume, por linha,
> **estado atual / o que provisionar manualmente / como verificar**, para que
> o go-live não descubra lacunas de provisionamento tarde demais (WS-C /
> F0C-01). Detalhe operacional (comandos, checklists, secrets) fica nos docs
> de origem.
>
> **Método de verificação desta unidade:** `docs/infra/*` e as ADRs foram lidos
> integralmente; `package.json`, `src/shared/env.ts`, `.github/workflows/*.yml`
> e `.env.local`/`.env.example` foram inspecionados; `gh secret list` e
> `gh variable list` foram rodados contra o repo (`DNACod3/asonseg-portal`) —
> **0 secrets e 0 variables configurados no GitHub Actions** hoje. O estado da
> Vercel (Environment Variables) **não é verificável por esta esteira** (sem
> acesso a token/CLI Vercel) — marcado como "verificar manualmente" abaixo.

## 1. Serviços externos

| Serviço | Estado atual | Provisionar manualmente | Como verificar |
| ------- | ------------- | ------------------------ | --------------- |
| **Vercel** — hospedagem/deploy ([vercel.md](./vercel.md)) | Doc registra `✅ provisionado` (plano Hobby, região `gru1`, repo conectado). **Não verificável por esta esteira** (sem token/CLI Vercel). | Confirmar no dashboard: Environment Variables (Production/Preview/Development) batem com a matriz de secrets do [README](./README.md#matriz-de-secrets); região de função `gru1`; branch de produção `master`. | Login no dashboard Vercel → Project Settings → Environment Variables; `vercel env ls` se a CLI/token estiver disponível. |
| **Supabase** — Postgres/Auth/Storage ([supabase.md](./supabase.md)) | Doc registra `✅ provisionado` (projeto cloud `sa-east-1`, RLS desabilitado — ADR-0003). Ambiente **local** é a stack do Supabase CLI (ADR-0016), independente deste projeto cloud. | Confirmar projeto Preview/Staging separado do de Produção (recomendado em supabase.md, evita PRs tocarem dado de produção); DNS/SSL do domínio customizado se aplicável. | `supabase status` (local); dashboard do projeto cloud → Settings → Database/API para produção. |
| **Resend** — e-mail transacional ([resend-sentry-turnstile.md §1](./resend-sentry-turnstile.md#1-resend--e-mail-transacional)) | Doc registra `✅ provisionado` (domínio `asonseg.org.br` verificado, SPF/DKIM). **GitHub Actions Secrets: 0 configurados** (verificado `gh secret list` — irrelevante aqui, Resend só é consumido em runtime Vercel, não em workflow). | Confirmar `RESEND_API_KEY`/`EMAIL_FROM` na Vercel (Production/Preview) — não verificável por esta esteira. | `curl` de teste documentado em resend-sentry-turnstile.md §5; dashboard Resend → Domains (status verificado). |
| **Sentry** — observabilidade ([resend-sentry-turnstile.md §2](./resend-sentry-turnstile.md#2-sentry--observabilidade)) | Doc de provisionamento registra `✅` (projeto/DSN/token). **Achado desta unidade:** o **SDK não está instalado no código** — `package.json` não tem `@sentry/nextjs`; não existem `sentry.*.config.ts`. `NEXT_PUBLIC_SENTRY_DSN` só existe como variável validada em `shared/env.ts` (opcional, vazia em dev), sem consumidor real. | Instalação do SDK (`@sentry/nextjs`, `sentry.client.config.ts`/`sentry.server.config.ts`/`sentry.edge.config.ts`, wrapper do `next.config`) é hardening de observabilidade — **Fase 6** (transversal), fora do escopo desta unidade (A-02). O provisionamento de conta/projeto/secrets no console segue válido. | Após a instalação (Fase 6): lançar um erro proposital numa rota de health e confirmar o evento no dashboard Sentry (comando em resend-sentry-turnstile.md §5). |
| **Cloudflare Turnstile** — CAPTCHA ([resend-sentry-turnstile.md §3](./resend-sentry-turnstile.md#3-cloudflare-turnstile--captcha)) | Doc registra `✅ provisionado` (widget + site/secret key). Dev/CI usam as **chaves de teste públicas** do Cloudflare (`1x0000...AA`), confirmadas no [spike-turnstile.md](../spikes/spike-turnstile.md) (Concluído) e usadas em `.env.example`/`ci.yml`. | Confirmar site key + secret key **reais** na Vercel (Production/Preview) — as chaves de teste nunca devem chegar a um domínio de produção real. | `curl` ao `siteverify` documentado em resend-sentry-turnstile.md §5; spike-turnstile.md tem a tabela completa de chaves de teste × comportamento. |
| **Anthropic** — LLM / extração de CV ([anthropic-backblaze.md §1](./anthropic-backblaze.md#1-anthropic--extração-de-cv)) | Doc de provisionamento registra `✅` (conta/billing/`ANTHROPIC_API_KEY`). **Achado desta unidade:** o módulo `cv-extraction` **não existe** em `src/modules/` — nenhum consumidor do SDK, nenhum port `CVExtractor` implementado ainda. `.env.local`/`.env.staging` usam `ANTHROPIC_API_KEY=sk-ant-dummy-key` (só faz o boot passar). O [spike-claude-cv.md](../spikes/spike-claude-cv.md) está "Prototipado — execução com chave real pendente". | Construir o módulo `cv-extraction` (port `CVExtractor` + adapter Anthropic, `shared/container.ts`) é escopo da **USP-040** (AD-005/AD-009: a US que precisa cria a infra) — fora desta unidade. Rodar o spike com uma `ANTHROPIC_API_KEY` real para preencher a coluna "medido" fica registrado como pendente no próprio spike. | Comando `curl` de teste em anthropic-backblaze.md §4; após USP-040, o teste real de extração via `CVExtractor`. |

## 2. Restore drill (Backblaze B2 — ADR-0006)

Ver [dr-restore-drill.md](./dr-restore-drill.md) (drill completo, scripts, resultados).

| Item | Estado atual | Provisionar manualmente | Como verificar |
| ---- | ------------- | ------------------------ | --------------- |
| Drill `pg_dump` → `restore` | **Executado localmente** (Postgres 15.8 via Supabase CLI) — RTO medido na base de _smoke_. | Repetir o drill contra um dump de **produção** (não só o smoke local) antes do go-live, para um RTO realista. | `scripts/backup/dump-db.sh` + `scripts/backup/restore-db.sh` (reutilizados pelos workflows de backup, issue #223). |
| Upload/restore via B2 | **Modo híbrido** — scripts prontos para rodar; upload real ao B2 pendente de credencial real (dev usa `B2_*=dummy-*`). | Rodar o drill completo com credenciais B2 reais (`B2_KEY_ID`/`B2_APPLICATION_KEY`/`B2_BUCKET`) antes do go-live. | `rclone lsd b2:$B2_BUCKET` / `aws s3 ls` (comandos em anthropic-backblaze.md §4). |
| **Achado — mismatch de nome de secret** | `src/shared/env.ts`/`.env.example` usam `B2_APPLICATION_KEY`; os workflows `.github/workflows/backup-db.yml`/`backup-storage.yml` referenciam `secrets.B2_APP_KEY` (nome diferente). `gh secret list` confirma **0 secrets configurados** no repo hoje — o mismatch ainda não quebrou nada em produção só porque o workflow nunca rodou com secret real. | Padronizar o nome (`B2_APPLICATION_KEY` recomendado, consistente com `env.ts`) nos workflows **antes** de registrar o secret real no GitHub Actions Secrets. | Comparar `grep B2_ .github/workflows/backup-*.yml src/shared/env.ts`; `gh secret list --repo DNACod3/asonseg-portal` deve listar o nome escolhido após o registro. |
| **Achado — `B2_*` no boot local** | `env.ts` exige `B2_KEY_ID`/`B2_APPLICATION_KEY`/`B2_BUCKET` no schema (falha o boot se ausentes); `.env.local`/`.env.staging` já os têm como **placeholders dummy** (`dummy-key-id` etc.) — não estão ausentes, mas também não são credenciais reais. | Nenhuma ação de dev necessária (dummies bastam para o boot); credenciais reais só são necessárias para os workflows de backup rodarem de verdade. | `grep '^B2_' .env.local .env.staging` (sem expor valor) confirma as 3 chaves presentes. |

## 3. Spikes (issue #105 — Fase 0)

| Spike | Estado atual | Provisionar manualmente | Como verificar |
| ----- | ------------- | ------------------------ | --------------- |
| [Pooler (PgBouncer/Supavisor) + Prisma](../spikes/spike-pooler-prisma.md) | **Concluído.** `DATABASE_URL` (pooler)/`DIRECT_URL` (direto) validados; comportamento sob transação/concorrência fechado. | Nenhuma — decisão já embutida no `schema.prisma`/`shared/lib/prisma.ts`. | Reexecutar o cenário do spike se o provedor de pooler mudar (ex.: troca de plano Supabase). |
| [Cloudflare Turnstile (widget + verify)](../spikes/spike-turnstile.md) | **Concluído.** Fluxo client→server validado com as chaves de teste públicas; tabela de comportamento por chave documentada. | Nenhuma — troca para chaves reais é só configuração de env (ver linha Turnstile acima). | `siteverify` com token real do widget de produção, uma vez a chave real estiver na Vercel. |
| [Claude — extração de CV (custo/latência/qualidade)](../spikes/spike-claude-cv.md) | **Prototipado — execução com chave real pendente** (modo híbrido: protótipo + schema Zod + estimativas prontos; sem chamada real feita). | Rodar o protótipo com `ANTHROPIC_API_KEY` real para preencher a coluna "medido" (custo/latência/qualidade observados). Construção do módulo `cv-extraction` em si é USP-040. | Reproduzir conforme "Como reproduzir" do próprio spike, com chave real. |

## 4. Fora do escopo desta unidade (referência)

- Instalar/configurar `@sentry/nextjs` — Fase 6 (A-02).
- Construir o módulo `cv-extraction` — USP-040 (A-01/A-02, AD-005/AD-009).
- Rotacionar/registrar credenciais reais em qualquer console/cofre — ação manual do owner externo (fora da esteira de código).
- Corrigir o mismatch `B2_APPLICATION_KEY`×`B2_APP_KEY` nos workflows — documentado acima como item de verificação; não é code-fix desta unidade (não bloqueia dev, só o backup real).
