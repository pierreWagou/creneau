#!/bin/sh
set -e

# If no database exists yet, seed it with test data
if [ ! -f /app/data/creneau.db ]; then
  echo "No database found — copying seed..."
  cp /app/seed.db /app/data/creneau.db
  echo "Seed database ready."
fi

exec node build
