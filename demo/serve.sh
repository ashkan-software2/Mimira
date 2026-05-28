#!/usr/bin/env bash
# Serve the Yuna admin Next.js dev server and print a URL that opens in a browser.
# Mirrors mockups/serve.sh: idempotent — kill prior dev server on the port, restart
# bound to 0.0.0.0, discover EC2 public IP via IMDSv2, self-test reachability.
#
# Run on the workspace VM:   bash serve.sh
# Override port:              PORT=4000 bash serve.sh
#
# Output:
#   SERVER     http://127.0.0.1:<port>/  (PID N, log /tmp/yuna-dev-<port>.log)
#   PUBLIC     <ip-or-NONE>
#   SELF-TEST  HTTP <code> in <time>s  →  <verdict>
#   URL        http://<ip>:<port>/inbox

set -u

PORT="${PORT:-3042}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
LANDING="/inbox"
LOG="/tmp/yuna-dev-${PORT}.log"

cd "$ROOT"

# 1. Ensure deps are installed.
if [ ! -d node_modules ]; then
  echo "INSTALL    node_modules missing — running npm install..."
  npm install --no-audit --no-fund
fi

# 2. Kill any prior dev server for this project — Next 16 enforces a
#    singleton per project directory, so we need a wider net than just :PORT.
PRIOR_PORT_PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
PRIOR_DEV_PIDS=$(pgrep -f "${ROOT}/node_modules/.bin/next" 2>/dev/null || true)
PRIOR_SERVER_PIDS=$(pgrep -f "next-server" 2>/dev/null || true)
ALL_PRIOR=$(printf "%s\n%s\n%s\n" "$PRIOR_PORT_PIDS" "$PRIOR_DEV_PIDS" "$PRIOR_SERVER_PIDS" | sort -u | tr '\n' ' ' | sed 's/^ //;s/ $//')
if [ -n "$ALL_PRIOR" ]; then
  echo "KILL       prior next/dev processes (PIDs: ${ALL_PRIOR})"
  # shellcheck disable=SC2086
  kill $ALL_PRIOR 2>/dev/null || true
  sleep 2
  # shellcheck disable=SC2086
  kill -9 $ALL_PRIOR 2>/dev/null || true
  sleep 1
fi

# 3. Discover EC2 public IP *before* starting the dev server, so it can be
#    injected into Next's allowedDevOrigins. Without this, server actions
#    (Save buttons) 403 silently when the page is loaded over the public IP.
TOKEN=$(curl -sX PUT \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60" \
  --max-time 2 \
  http://169.254.169.254/latest/api/token 2>/dev/null || true)
PUBLIC_IP=""
if [ -n "$TOKEN" ]; then
  PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" \
    --max-time 2 \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
fi
[ -z "$PUBLIC_IP" ] && \
  PUBLIC_IP=$(curl -s --max-time 2 \
    http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
[ -z "$PUBLIC_IP" ] && \
  PUBLIC_IP=$(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || true)

# 4. Boot dev server bound to all interfaces.
YUNA_DEV_ORIGIN="${PUBLIC_IP}" \
  nohup npx next dev -H 0.0.0.0 -p "$PORT" > "$LOG" 2>&1 &
disown
SERVER_PID=$!

# 5. Wait up to 30s for the port to bind.
for _ in $(seq 1 30); do
  if ss -tln 2>/dev/null | grep -q ":${PORT} "; then break; fi
  sleep 1
done

if ! ss -tln 2>/dev/null | grep -q ":${PORT} "; then
  echo "ERROR      server did not bind to :${PORT}. Last log lines:"
  tail -20 "$LOG"
  exit 1
fi
echo "SERVER     http://127.0.0.1:${PORT}/  (PID ${SERVER_PID}, log ${LOG})"
echo "PUBLIC     ${PUBLIC_IP:-NONE}"

# 6. Loopback warmup — first request compiles the landing page.
curl -s --max-time 30 -o /dev/null "http://127.0.0.1:${PORT}${LANDING}" || true

# 7. Self-test reachability via the public IP.
if [ -n "$PUBLIC_IP" ]; then
  RESULT=$(curl -s -o /dev/null \
    -w "HTTP %{http_code} in %{time_total}s" \
    --max-time 8 \
    "http://${PUBLIC_IP}:${PORT}${LANDING}" 2>/dev/null || true)
  CODE=$(echo "$RESULT" | awk '{print $2}')
  if [ "$CODE" = "200" ] || [ "$CODE" = "307" ]; then
    VERDICT="SG is open"
    echo "SELF-TEST  ${RESULT}  →  ${VERDICT}"
    echo "URL        http://${PUBLIC_IP}:${PORT}${LANDING}"
  else
    VERDICT="SG is blocking :${PORT}"
    echo "SELF-TEST  ${RESULT}  →  ${VERDICT}"
    echo "URL        http://${PUBLIC_IP}:${PORT}${LANDING}   (not reachable yet)"
    echo ""
    echo "TO FIX     EC2 console → this instance → Security tab → Edit inbound rules"
    echo "           Add  TCP ${PORT}  source = your laptop IP/32  (don't use 0.0.0.0/0)"
    echo "           Then: bash serve.sh"
    echo ""
    echo "OR         SSH local-forward from your laptop (no AWS console needed):"
    echo "             ssh -L ${PORT}:127.0.0.1:${PORT} ubuntu@${PUBLIC_IP}"
    echo "             # leave open, browse: http://localhost:${PORT}${LANDING}"
  fi
else
  echo "SELF-TEST  skipped (no public IP)"
  echo "URL        loopback only — http://127.0.0.1:${PORT}${LANDING}"
fi
