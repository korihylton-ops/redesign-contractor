#!/bin/sh
# Runs as root so it can fix ownership of the bind-mounted ./data volume, whatever the host
# directory's ownership turns out to be, then drops to the unprivileged "node" user for the app itself.
# Without this, a host data/ directory owned by anyone but uid 1000 makes every write (leads, chats,
# conversions) throw EACCES and crash the app in a restart loop.
set -e
mkdir -p /app/data
chown -R node:node /app/data
exec su-exec node "$@"
