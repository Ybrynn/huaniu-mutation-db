#!/bin/sh
set -e

# Ensure data directories exist
mkdir -p /data/uploads /data/backups

# Copy seed database on first run
if [ ! -f /data/mutations.db ]; then
  echo "First run: initializing database..."
  cp /app/seed-mutations.db /data/mutations.db 2>/dev/null || echo "No seed database, will create fresh"
fi

echo "Starting server..."
exec node server.js
