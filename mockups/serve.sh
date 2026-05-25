#!/usr/bin/env bash
# Serve the mockups directory and print a URL that opens in a browser.
# Idempotent: kill any prior server on 8042, restart bound to 0.0.0.0,
# discover the EC2 public IP, self-test reachability.
#
# Run on the workspace VM:   bash mockups/serve.sh
#
# Output:
#   SERVER  http://127.0.0.1:8042/  (PID N)
#   PUBLIC  <ip-or-NONE>
#   SELF-TEST  HTTP <code> in <time>s  →  <verdict>
#   URL     http://<ip>:8042/settings.html

set -u

PORT=8042
DIR="$(cd "$(dirname "$0")" && pwd)"

pkill -f "http.server ${PORT}" 2>/dev/null || true
sleep 1

cd "$DIR"
nohup python3 -m http.server "$PORT" --bind 0.0.0.0 \
  > /tmp/mockup-server.log 2>&1 &
disown
SERVER_PID=$!
sleep 2

if ! ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "ERROR  server did not bind to :${PORT}. See /tmp/mockup-server.log"
  exit 1
fi
echo "SERVER  http://127.0.0.1:${PORT}/  (PID ${SERVER_PID})"

# AWS IMDSv2 → fall back to IMDSv1, then ipify.org.
TOKEN=$(curl -sX PUT \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" \
  --max-time 2 \
  http://169.254.169.254/latest/api/token 2>/dev/null)
if [ -n "$TOKEN" ]; then
  PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" \
    --max-time 2 \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
fi
[ -z "${PUBLIC_IP:-}" ] && \
  PUBLIC_IP=$(curl -s --max-time 2 \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null)
[ -z "${PUBLIC_IP:-}" ] && \
  PUBLIC_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null)
echo "PUBLIC  ${PUBLIC_IP:-NONE}"

if [ -n "${PUBLIC_IP:-}" ]; then
  RESULT=$(curl -s -o /dev/null \
    -w "HTTP %{http_code} in %{time_total}s" \
    --max-time 5 \
    "http://${PUBLIC_IP}:${PORT}/settings.html" 2>/dev/null)
  CODE=$(echo "$RESULT" | awk '{print $2}')
  if [ "$CODE" = "200" ]; then
    VERDICT="SG is open"
  else
    VERDICT="SG is blocking — ask the user to add inbound TCP ${PORT} from their laptop IP"
  fi
  echo "SELF-TEST  ${RESULT}  →  ${VERDICT}"
  echo "URL     http://${PUBLIC_IP}:${PORT}/settings.html"
else
  echo "SELF-TEST  skipped (no public IP)"
  echo "URL     loopback only — http://127.0.0.1:${PORT}/settings.html"
fi
