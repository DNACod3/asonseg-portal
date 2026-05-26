#!/usr/bin/env bash
# Restaura um dump (-Fc) num banco LIMPO e valida integridade básica.
# Usado pelo drill de restore (#109). NÃO usar contra produção.
#
# Uso:
#   TARGET_URL=postgresql://.../postgres_restore  ./scripts/backup/restore-db.sh arquivo.dump
#   (baixando do B2)  B2_REMOTE=b2:bucket  ./scripts/backup/restore-db.sh asonseg-db-XX: -
#
# Env:
#   TARGET_URL   conexão ao banco DESTINO (limpo).                       [obrigatório]
#   B2_REMOTE    se definido e o arquivo não existir local, baixa de lá. [opcional]
set -euo pipefail

: "${TARGET_URL:?TARGET_URL é obrigatório (banco destino limpo)}"
DUMP="${1:?informe o arquivo .dump (ou nome no B2)}"

if [[ ! -f "${DUMP}" && -n "${B2_REMOTE:-}" ]]; then
  echo "[restore-db] baixando ${DUMP} de ${B2_REMOTE}"
  rclone copyto "${B2_REMOTE}/${DUMP}" "${DUMP}"
fi
[[ -f "${DUMP}" ]] || { echo "[restore-db] arquivo ${DUMP} não encontrado" >&2; exit 1; }

echo "[restore-db] restaurando ${DUMP} → destino"
# --clean --if-exists: idempotente; -j: paralelo (acelera RTO em bases grandes)
pg_restore --no-owner --no-privileges --clean --if-exists --jobs=4 \
  --dbname "${TARGET_URL}" "${DUMP}"

echo "[restore-db] validação de integridade (tabelas + contagens):"
psql "${TARGET_URL}" -c "\dt public.*"
psql "${TARGET_URL}" -tc "select tablename, n_live_tup from pg_stat_user_tables order by tablename;"
echo "[restore-db] OK"
