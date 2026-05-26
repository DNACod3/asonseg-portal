# Workflows agendados de backup → Backblaze B2

- **Issue:** #223 · **US:** #105 · **Decisão de base:** ADR-0006 (backup duplo)
- **Relacionada:** #109 (drill de restore) — reaproveita `scripts/backup/`

Dois workflows agendados implementam a **2ª cópia** dos dados no Backblaze B2 (a 1ª é o
backup/PITR nativo do Supabase). Falha do B2 = alerta humano, não incidente crítico.

| Workflow | Cron (UTC) | O que faz |
|---|---|---|
| [`.github/workflows/backup-db.yml`](../../.github/workflows/backup-db.yml) | `0 6 * * *` (03:00 BRT) | `pg_dump -Fc` (schema `public`) → upload B2 com retenção de 30 |
| [`.github/workflows/backup-storage.yml`](../../.github/workflows/backup-storage.yml) | `30 6 * * *` (03:30 BRT) | `rclone sync` do Supabase Storage (S3) → B2 (incremental) |

Ambos têm `workflow_dispatch` para validação manual de 1 execução ponta-a-ponta antes da Fase 1.

## Decisões herdadas do drill #109

- **Dump escopado em `--schema=public`** — o cluster inteiro do Supabase não restaura num Postgres
  vanilla (schemas `storage`/`realtime`/`vault`/`auth` exigem superuser). A 2ª cópia cobre os dados
  da aplicação.
- **`postgresql-client-15`** fixado na major do servidor — evita o `SET transaction_timeout` emitido
  por clientes 17+.

## Secrets a registrar no GitHub Actions

`Settings → Secrets and variables → Actions` (separados de produção; nunca commitar):

| Secret | Usado por | Descrição |
|---|---|---|
| `BACKUP_DIRECT_URL` | backup-db | Conexão **direta** (porta 5432) ao Postgres de produção |
| `B2_KEY_ID` | ambos | Backblaze B2 — keyID |
| `B2_APP_KEY` | ambos | Backblaze B2 — applicationKey |
| `B2_BUCKET` | ambos | Nome do bucket B2 (ex.: `asonseg-backups`) |
| `SUPABASE_S3_ENDPOINT` | backup-storage | `https://<ref>.storage.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | backup-storage | ex.: `sa-east-1` |
| `SUPABASE_S3_ACCESS_KEY` | backup-storage | Storage S3 access key |
| `SUPABASE_S3_SECRET_KEY` | backup-storage | Storage S3 secret key |
| `SUPABASE_STORAGE_BUCKET` | backup-storage | Bucket de Storage a copiar (ex.: `cvs`) |
| `SENTRY_DSN` | ambos (opcional) | Se definido, falha envia evento `error` ao Sentry |

## Alerta de falha

Cada workflow tem um passo `if: failure()` que: (1) emite `::error::` no _job log_ (visível na aba
Actions e nas notificações do GitHub) e (2) se `SENTRY_DSN` estiver configurado, envia um evento
`error` ao Sentry via Store API. DoD: falha de backup gera alerta visível.

## Validação (antes da Fase 1)

1. Registrar os secrets acima.
2. Rodar cada workflow via **Run workflow** (`workflow_dispatch`) e confirmar o artefato no B2.
3. Executar o **drill de restore** (#109, `docs/infra/dr-restore-drill.md`) sobre o dump gerado.
