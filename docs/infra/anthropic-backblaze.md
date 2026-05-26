# Infra — Anthropic (LLM / extração de CV) · Backblaze B2 (backup externo)

> **Task:** #99 · **US:** #95 (Provisionamento de ambientes) · **Épico:** #4 (Fase 0)
> **ADRs relacionados:** [ADR-0006](../arch/0006-backup-duplo-supabase-backblaze.md) (backup duplo), ADR-T-0012 (LLM externo, via [ADR-0002](../arch/0002-vercel-supabase-plataforma.md))
> **Status do provisionamento:** ✅ provisionado (contas/secrets geridos nos consoles)

Runbook da API Anthropic (extração de CV) e do bucket Backblaze B2 (destino do backup externo).
Sem secrets aqui — valores na Vercel env e/ou no cofre do runner de backup (GitHub Actions Secrets).

---

## 1. Anthropic — extração de CV

Backend do módulo `cv-extraction`. O código depende **apenas do port `CVExtractor`**
(resolvido em [`shared/container.ts`](../../src/shared/container.ts)); o adapter Anthropic é
detalhe de implementação — nunca importar `@anthropic-ai/sdk` direto no consumidor.

| Item | Valor |
|---|---|
| Billing | **pay-as-you-go** |
| Modelo | `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) |
| Custo estimado MVP | ~US$ 5–30/mês (volume baixo/médio — ADR-0002) |
| Limite/alerta de gasto | configurado no console (teto + alerta de billing) |

**Secrets:** `ANTHROPIC_API_KEY` (server-only), `ANTHROPIC_MODEL`.

### Checklist
- [x] Conta/organização Anthropic criada, billing pay-as-you-go ativo
- [x] `ANTHROPIC_API_KEY` registrada na Vercel (server-only)
- [x] Limite/alerta de gasto configurado
- [x] Chamada de teste à API confirmada (ver runbook)

> **Dev local:** `ANTHROPIC_API_KEY=sk-ant-dummy-key` só faz o boot passar; para exercitar a
> extração de CV de verdade, usar uma chave real em `.env.local` (não commitar).

---

## 2. Backblaze B2 — backup externo

Destino do **segundo** backup ([ADR-0006](../arch/0006-backup-duplo-supabase-backblaze.md)):
dump do Postgres + sync dos buckets de Storage, via **GitHub Actions cron**, criptografado
(AES-256-CBC com openssl), retenção 30 dias rolling. Sobrevive a indisponibilidade total do Supabase.

| Item | Valor |
|---|---|
| Bucket | privado, p/ dumps + sync de storage (`B2_BUCKET`) |
| Endpoint | S3-compatível (região do B2) |
| Cobertura do sync | banco + buckets `cvs` e `provider-photos` |
| RPO / RTO / retenção | 24h / 2–4h / 30 dias rolling |

**Secrets:** `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` (+ endpoint S3).

> ⚠️ Onde guardar: como o dump roda em **GitHub Actions** (ver issue #223 — workflows de backup),
> esses secrets devem viver em **GitHub Actions Secrets** do repo, além da Vercel se a app precisar.

### Checklist
- [x] Bucket B2 privado criado
- [x] Application Key gerada (`B2_KEY_ID`, `B2_APPLICATION_KEY`)
- [x] `B2_BUCKET` + endpoint S3 anotados
- [x] Secrets registrados no cofre do runner (GitHub Actions Secrets) / Vercel

---

## 3. Done when (DoD da task #99)

- [x] Anthropic: billing pay-as-you-go ativo, `ANTHROPIC_API_KEY` na Vercel, chamada de teste OK, limite/alerta configurado
- [x] Backblaze B2: bucket privado criado, Application Key gerada e secrets registrados
- [x] Acesso a ambos confirmado

---

## 4. Runbook — validar

```bash
# Anthropic — chamada de teste (NÃO commitar a key)
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":16,"messages":[{"role":"user","content":"ping"}]}'

# Backblaze B2 — validar acesso via S3-compatível (rclone ou aws-cli)
#   rclone (config 'b2:'): listar o bucket
rclone lsd b2:$B2_BUCKET
#   aws-cli (endpoint S3 do B2):
aws s3 ls "s3://$B2_BUCKET" --endpoint-url "https://s3.<regiao>.backblazeb2.com"
```

> O drill de restore obrigatório da Fase 0 está coberto pela issue #105 (Spikes + drill de restore).
> Os workflows de backup agendados estão na issue #223.
