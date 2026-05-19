#!/bin/sh
set -e

echo "Running database setup/migrations..."
npx tsx scripts/setup.ts

echo "Starting application..."
exec node build
