#!/bin/sh
# 현재 떠 있는 DB 컨테이너에서 스키마 + 데이터를 덤프해 init SQL 을 다시 만든다.
#   npm run db:reset && npm run db:dump
set -e
CLI=$(command -v docker || command -v podman) || { echo "docker 또는 podman 이 필요합니다"; exit 1; }
DUMP='mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --databases inspection --no-tablespaces --skip-add-locks --skip-comments --single-transaction --set-gtid-purged=OFF'
COUNT='mysql -N -B -u root -p"$MYSQL_ROOT_PASSWORD" inspection -e "SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM applications), (SELECT COUNT(*) FROM application_logs), (SELECT COUNT(*) FROM notifications), (SELECT COUNT(*) FROM external_visits)"'
mkdir -p docker/initdb
"$CLI" exec ti-db sh -lc "$DUMP" > docker/initdb/_dump.sql
COUNTS=$("$CLI" exec ti-db sh -lc "$COUNT" 2>/dev/null | tail -1)
SEED_COUNTS="$COUNTS" node tools/write-initdb.mjs
