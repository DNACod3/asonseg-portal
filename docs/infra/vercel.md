# Infra — Vercel (hospedagem + deploy)

> **Task:** #96 · **US:** #95 (Provisionamento de ambientes) · **Épico:** #4 (Fase 0)
> **ADRs relacionados:** [ADR-0002](../arch/0002-vercel-supabase-plataforma.md) (plataforma), [ADR-0007](../arch/0007-pwa-online-only-isr-publico.md) (ISR público)
> **Status do provisionamento:** ✅ provisionado (contas/secrets geridos no console pela diretoria técnica)

Este documento registra a **decisão de plano** e os **limites que impactam o MVP**, e serve de runbook
para reprovisionar/auditar o projeto Vercel. Não contém secrets — os valores vivem em
**Vercel → Settings → Environment Variables** e localmente em `.env.local` (fora do git).

---

## 1. Projeto e repositório

| Item | Valor |
|---|---|
| Repositório conectado | `DNACod3/asonseg-portal` (privado) |
| Framework preset | Next.js (App Router) |
| Branch de produção | `master` (squash merge) |
| Região de funções | `gru1` (São Paulo) — proximidade do Supabase `sa-east-1` |
| Deploys de preview | automáticos por PR |

> A região `gru1` minimiza latência app→banco (mesma região AWS sa-east-1 do Supabase).
> Server Actions e route handlers rodam como serverless functions nessa região.

---

## 2. Decisão de plano — Hobby vs Pro

**Decisão (Fase 0):** iniciar no **Hobby**, com gatilho documentado de upgrade para **Pro**.
Alinhada a [ADR-0002](../arch/0002-vercel-supabase-plataforma.md) (custo mínimo como driver dominante,
ADR-0010 de negócio).

### Comparativo dos limites que afetam o MVP

| Limite | Hobby | Pro | Impacto no MVP ASONSEG |
|---|---|---|---|
| **Uso comercial** | ❌ proibido (non-commercial) | ✅ permitido | ⚠️ **Ponto crítico.** O portal é de uma ONG sem fins lucrativos; o uso é institucional/social, não comercial. Decisão: aceitável no Hobby para Fase 0; reavaliar com a Vercel (programa OSS/ONG) antes do go-live público. |
| **Bandwidth** | 100 GB/mês | 1 TB/mês | Tráfego anônimo (busca de vagas/serviços, home) cabe folgado; pico de divulgação (QP-009) é o gatilho de upgrade. |
| **Build minutes** | limitado (fair use) | maior cota | CI builds + previews por PR; suficiente no ritmo MVP. |
| **Função serverless — duração** | até 10s (default) | até 60s+ (config.) | Extração de CV via LLM (#99) pode aproximar do limite → mover para rota/cron com timeout maior, ou Pro. |
| **Cron Jobs** | limitado (1/dia recom.) | flexível | Backup diário (#99/[ADR-0006](../arch/0006-backup-duplo-supabase-backblaze.md)) e expiração de vagas usam **GitHub Actions cron**, não Vercel Cron → não bloqueia Hobby. |
| **Team members** | individual | time | Diretoria + voluntários; avaliar no upgrade. |

### Gatilhos de upgrade para Pro

Migrar para Pro **quando qualquer um** ocorrer:

1. Pico de tráfego de divulgação ameaçar o teto de 100 GB/mês de bandwidth (QP-009 do PRD).
2. Necessidade de uso comercial formalmente reconhecido / exigência da Vercel sobre Hobby non-commercial.
3. Server Action de extração de CV estourar o timeout de 10s de forma recorrente.
4. Necessidade de múltiplos membros com papéis no time Vercel.

> **Ação aberta:** consultar o programa de planos para OSS/ONG da Vercel antes do go-live público,
> para evitar a cláusula non-commercial do Hobby. Registrar a resposta aqui.

---

## 3. Environment Variables — escopos

Três escopos na Vercel, alinhados aos ambientes:

| Escopo Vercel | Quando aplica | Origem dos valores |
|---|---|---|
| **Production** | deploy de `master` | secrets reais de produção |
| **Preview** | deploys de PR | secrets de staging/preview (projeto Supabase separado recomendado) |
| **Development** | `vercel env pull` p/ dev local | normalmente apontam para a stack **Supabase CLI local** ([ADR-0016](../arch/0016-ambiente-local-supabase-cli.md)) |

A lista completa de variáveis e em qual escopo cada uma vive está na
**[matriz de secrets](./README.md#matriz-de-secrets)**. Todas são validadas por
[`src/shared/env.ts`](../../src/shared/env.ts) — o build falha se faltar alguma.

> **Regra:** nenhum secret real entra no git. `.env.example` só tem placeholders/valores demo locais.

---

## 4. Done when (DoD da task #96)

- [x] Projeto Vercel criado e conectado ao repositório `DNACod3/asonseg-portal` (deploy de placeholder verde)
- [x] Decisão de plano documentada aqui, com limites do MVP e gatilhos de upgrade
- [x] Escopos de Environment Variables definidos (Production / Preview / Development)
- [ ] (aberto) Resposta da Vercel sobre elegibilidade OSS/ONG registrada antes do go-live público

---

## 5. Runbook — reprovisionar / auditar

```bash
# CLI (opcional) — instalar e logar
npm i -g vercel && vercel login

# vincular o repo local ao projeto
vercel link

# puxar as envs do escopo Development para .env.local (NÃO commitar)
vercel env pull .env.local

# listar variáveis por escopo (confere a matriz de secrets)
vercel env ls
```
