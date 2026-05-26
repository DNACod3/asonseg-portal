#!/usr/bin/env bash
# Dump do Postgres (formato custom, comprimido) + upload opcional ao Backblaze B2.
# Usado pelo drill de restore (#109) e pelo workflow agendado backup-db.yml (#223).
#
# Uso:
#   DIRECT_URL=postgresql://...  ./scripts/backup/dump-db.sh [arquivo_saida.dump]
#   (com B2)  B2_REMOTE=b2:asonseg-backups  RCLONE_CONFIG=... ./scripts/backup/dump-db.sh
#
# Env:
#   DIRECT_URL   conexão DIRETA (não pooler transaction-mode) ao Postgres.   [obrigatório]
#   DUMP_SCHEMA  schema(s) a incluir (default "public"). Ver NOTA abaixo.    [opcional]
#   B2_REMOTE    destino rclone "b2:bucket[/prefixo]". Se vazio, não faz upload. [opcional]
#   RETENTION    nº de dumps a manter no B2 (default 30). Só aplica com B2_REMOTE.
#
# NOTA (achado do drill #109): dump do CLUSTER inteiro do Supabase inclui schemas
# gerenciados pela plataforma (storage, realtime, vault, auth, extensions, event
# triggers, roles) que exigem superuser e falham ao restaurar num Postgres vanilla.
# A 2ª cópia (B2, ADR-0006) cobre os DADOS DA APLICAÇÃO → escopo "public". Os schemas
# internos do Supabase são responsabilidade do backup/PITR nativo da plataforma.
set -euo pipefail

: "${DIRECT_URL:?DIRECT_URL é obrigatório (conexão direta ao Postgres)}"
DUMP_SCHEMA="${DUMP_SCHEMA:-public}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${1:-asonseg-db-${TS}.dump}"

echo "[dump-db] pg_dump (schema=${DUMP_SCHEMA}) → ${OUT} (formato custom -Fc, nível 9)"
# -Fc: formato custom (restaurável com pg_restore, paralelizável, comprimido)
pg_dump "${DIRECT_URL}" --schema="${DUMP_SCHEMA}" \
  --format=custom --compress=9 --no-owner --no-privileges --file "${OUT}"
SIZE="$(du -h "${OUT}" | cut -f1)"
echo "[dump-db] OK — ${OUT} (${SIZE})"

if [[ -n "${B2_REMOTE:-}" ]]; then
  echo "[dump-db] upload → ${B2_REMOTE}/${OUT}"
  rclone copyto "${OUT}" "${B2_REMOTE}/${OUT}" --b2-hard-delete
  # retenção: mantém os N mais recentes
  RETENTION="${RETENTION:-30}"
  echo "[dump-db] aplicando retenção (mantendo ${RETENTION} mais recentes)"
  mapfile -t OLD < <(rclone lsf "${B2_REMOTE}" --include 'asonseg-db-*.dump' | sort -r | tail -n "+$((RETENTION + 1))")
  for f in "${OLD[@]:-}"; do
    [[ -n "$f" ]] && { echo "[dump-db] removendo antigo: $f"; rclone deletefile "${B2_REMOTE}/${f}"; }
  done
  echo "[dump-db] upload concluído"
else
  echo "[dump-db] B2_REMOTE não definido — upload pulado (dump local em ${OUT})"
fi
