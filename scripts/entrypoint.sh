#!/bin/sh
set -e

if [ "${SEED_ON_INIT}" = "true" ] && [ ! -f /app/data/creneau.db ]; then
  echo "SEED_ON_INIT=true — copying seed database..."
  cp /app/seed.db /app/data/creneau.db
  echo "Seed database ready."
fi

exec node build
