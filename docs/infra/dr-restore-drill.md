# Drill de restore de backup (Backblaze B2) — DR

- **Issue:** #109 · **US:** #105 · **Épico:** #4 (Fase 0)
- **Data:** 2026-05-26
- **Camada:** infra (drill / DR) · **Decisão de base:** ADR-0006 (backup duplo Supabase + Backblaze)
- **Alvo de RTO:** ~2h · **Status:** Drill executado (local); upload B2 pronto p/ rodar (modo híbrido)

## Objetivo

Executar um ciclo `pg_dump` → `restore` num banco limpo, medir o **RTO**, e validar o procedimento
de DR da 2ª cópia (Backblaze B2). RPO de 24h é coberto pelo backup nativo do Supabase; o B2 é a
**segunda cópia** (technical-design §4: falha do B2 = alerta humano, não crítico).

## Scripts (reutilizáveis — também usados por #223)

- [`scripts/backup/dump-db.sh`](../../scripts/backup/dump-db.sh) — `pg_dump -Fc` comprimido + upload opcional ao B2 (rclone) + retenção.
- [`scripts/backup/restore-db.sh`](../../scripts/backup/restore-db.sh) — `pg_restore` num banco limpo + validação de integridade.

## Execução do drill (local, 2026-05-26)

Ambiente: Postgres 15.8 (Supabase CLI, `supabase start`), `pg_dump`/`pg_restore` 18.x (libpq Homebrew).

```bash
# 1. banco destino limpo
psql "$ADMIN" -c "CREATE DATABASE restore_drill;"
# 2. dump (escopo public — ver Achado 1)
DIRECT_URL="$SRC" ./scripts/backup/dump-db.sh /tmp/drill.dump
# 3. restore + validação
TARGET_URL="$TGT" ./scripts/backup/restore-db.sh /tmp/drill.dump
```

### Resultado

| Fase | Tempo medido (base de _smoke_, 8 linhas) |
|---|---|
| Dump (`pg_dump -Fc`, schema public) | **0,12 s** |
| Restore (`pg_restore --clean --jobs=4`) | **0,14 s** |
| **Total** | **0,26 s** |

**Integridade:** checksum `md5(string_agg(id order by id))` de `_health_check` **idêntico** entre
origem e destino → `INTEGRITY: MATCH ✓`. Contagens: `health=8`, `migrations=1` em ambos.

> A base atual é só de _smoke_ (sem domínio). Os tempos absolutos não são representativos; o valor
> do drill aqui é **validar o procedimento e os achados**. Ver extrapolação de RTO abaixo.

## Achados (o drill expôs 2 ajustes importantes)

1. **Dump do CLUSTER inteiro NÃO restaura num Postgres vanilla.** A 1ª tentativa (sem `--schema`)
   trouxe schemas geridos pela plataforma Supabase — `storage`, `realtime`, `vault`, `auth`,
   `extensions`, _event triggers_ (`pgrst_*`), roles — que exigem **superuser** e extensões
   Supabase, gerando 18 erros (`schema "storage" does not exist`, `permission denied for table
   secrets`, `Must be superuser to create an event trigger`, etc.). **Correção:** a 2ª cópia (B2)
   escopa **`--schema=public`** (os dados da aplicação, que são nossos). Os schemas internos do
   Supabase ficam a cargo do backup/PITR **nativo** da plataforma. Com `public`, o restore fica
   limpo e a integridade bate.
2. **Skew de versão do `pg_dump`.** Cliente 18.x emite `SET transaction_timeout = 0` (GUC do PG17+),
   que o servidor PG15 não reconhece — 2 _warnings_ benignos, restore conclui OK. **Correção no
   workflow:** fixar o `postgresql-client` na **major do servidor (15)** para eliminar o skew.

## RTO — extrapolação e veredito

Decompondo o ciclo de DR real (Supabase prod → B2 → banco novo):

| Etapa | Estimativa (base MVP, dump comprimido ~baixas centenas de MB) |
|---|---|
| Provisionar Postgres limpo (projeto/instância de teste) | 10–20 min |
| Download do dump do B2 (sa-east-1, ~centenas de MB) | 2–10 min |
| `pg_restore --jobs=4` | 5–20 min |
| Validação de integridade + _smoke_ da aplicação | 10–20 min |
| **Total** | **~30–70 min** |

**Veredito: RTO ~2h é confortável** para o volume do MVP — o ciclo cabe folgado, com margem para
imprevistos (recriar conexões, ajustar env, reapontar a aplicação). Reavaliar quando a base passar
de ~poucos GB (aí o download/restore dominam e justificam dump paralelo `-Fd`/`-j` no dump também).

## Procedimento de DR (passo-a-passo, produção)

1. **Obter o dump mais recente do B2:**
   `B2_REMOTE=b2:asonseg-backups ./scripts/backup/restore-db.sh asonseg-db-<TS>.dump` (baixa do B2 se não houver local), **ou** `rclone copyto b2:asonseg-backups/asonseg-db-<TS>.dump ./`.
2. **Provisionar destino limpo** (novo projeto Supabase ou Postgres gerenciado) e exportar `TARGET_URL` (conexão direta, porta 5432).
3. **Restaurar:** `TARGET_URL=... ./scripts/backup/restore-db.sh asonseg-db-<TS>.dump`.
4. **Validar integridade:** contagens/checksums das tabelas-chave (o script já lista `pg_stat_user_tables`); rodar `prisma migrate status` e um _smoke_ da app.
5. **Cutover:** reapontar `DATABASE_URL`/`DIRECT_URL` da aplicação para o destino restaurado.

## Pendente (modo híbrido — quando houver credenciais B2 reais)

O upload/download ao B2 **não** foi exercitado: `B2_*` no `.env.local` são _dummy_ e não há
`rclone`/`b2` CLI instalado. Para fechar 100%:

```bash
brew install rclone
rclone config create b2backup b2 account "$B2_KEY_ID" key "$B2_APPLICATION_KEY"
B2_REMOTE=b2backup:asonseg-backups DIRECT_URL=<prod> ./scripts/backup/dump-db.sh   # sobe ao B2
B2_REMOTE=b2backup:asonseg-backups TARGET_URL=<limpo> ./scripts/backup/restore-db.sh asonseg-db-<TS>.dump
```

Os scripts já contemplam o caminho B2 (upload com retenção no `dump-db.sh`; download no `restore-db.sh`).

## Referências

- ADR-0006 — backup duplo (Supabase nativo + Backblaze B2).
- technical-design.md §4–§5 — RPO/RTO, workflows de backup, B2 como 2ª cópia.
- Issue relacionada #223 — workflows agendados (`backup-db.yml`, `backup-storage.yml`).
