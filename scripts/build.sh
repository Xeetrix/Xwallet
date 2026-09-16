#!/bin/sh
set -e

npx prisma generate

if [ -n "$DIRECT_URL" ]; then
  echo "DIRECT_URL is set — applying pending Prisma migrations..."
  npx prisma migrate deploy
else
  echo "DIRECT_URL not set — skipping 'prisma migrate deploy'. Set DIRECT_URL (a direct, non-pooled Postgres connection) to have migrations apply automatically on every deploy. Until then, tables must be created manually (e.g. via the Supabase SQL editor, using prisma/migrations/*/migration.sql)."
fi

npx next build
