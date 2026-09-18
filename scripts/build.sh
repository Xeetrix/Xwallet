#!/bin/sh
set -e

npx prisma generate

# Vercel's Supabase integration provisions POSTGRES_URL_NON_POOLING (a
# direct, non-pgbouncer connection) automatically. Use it as DIRECT_URL
# when DIRECT_URL itself hasn't been set explicitly.
if [ -z "$DIRECT_URL" ] && [ -n "$POSTGRES_URL_NON_POOLING" ]; then
  export DIRECT_URL="$POSTGRES_URL_NON_POOLING"
fi

if [ -n "$DIRECT_URL" ]; then
  echo "DIRECT_URL is set — applying pending Prisma migrations..."

  set +e
  migrate_output=$(npx prisma migrate deploy 2>&1)
  migrate_status=$?
  set -e

  echo "$migrate_output"

  if [ $migrate_status -ne 0 ] && echo "$migrate_output" | grep -q "P3005"; then
    echo "Database already has these tables from outside Prisma Migrate (P3005). Baselining the initial migration as already applied, then retrying..."
    npx prisma migrate resolve --applied "20250101000000_init"
    npx prisma migrate deploy
  elif [ $migrate_status -ne 0 ]; then
    exit $migrate_status
  fi
else
  echo "DIRECT_URL not set — skipping 'prisma migrate deploy'. Set DIRECT_URL (a direct, non-pooled Postgres connection) to have migrations apply automatically on every deploy. Until then, tables must be created manually (e.g. via the Supabase SQL editor, using prisma/migrations/*/migration.sql)."
fi

npx next build
