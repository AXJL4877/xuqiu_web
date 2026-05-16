#!/bin/sh
set -e

cd /app

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Preparing standalone server..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

cd .next/standalone

echo "[entrypoint] Starting Next.js on 0.0.0.0:3000..."
exec node server.js
