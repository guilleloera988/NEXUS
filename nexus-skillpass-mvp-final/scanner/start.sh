#!/bin/bash
# Starts the scanner container: signatures, clamd, then the HTTP front (as the unprivileged clamav user).
# If clamd or the HTTP front stops, the container exits and the platform starts it again.
set -euo pipefail
mkdir -p /run/clamav /var/log/clamav && chown clamav:clamav /run/clamav /var/log/clamav
touch /var/log/clamav/clamd.log && chown clamav:clamav /var/log/clamav/clamd.log
tail -F -n 0 /var/log/clamav/clamd.log &
# The first signature download must finish before clamd can start; freshclam then keeps them current (12 checks a day).
until freshclam --foreground --stdout; do echo "freshclam failed; retrying in 30 s" >&2; sleep 30; done
freshclam --daemon --checks=12 --stdout
clamd &
runuser -u clamav --preserve-environment -- node /app/server.mjs &
wait -n
echo "clamd or the HTTP front stopped; exiting so the platform restarts the scanner" >&2
exit 1
