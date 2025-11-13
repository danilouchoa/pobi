#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# update-cloudflare-dns.sh (stub)
# Purpose: Update Cloudflare DNS record for app.finfy.me to point at current
#          Istio ingress gateway LoadBalancer hostname / IP.
# NOTE: This is a stub. Implement actual API interaction later.
# -----------------------------------------------------------------------------

RECORD_NAME="${CLOUDFLARE_RECORD_NAME:-app.finfy.me}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"          # Cloudflare Zone ID (required)
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"      # Cloudflare API token (required)
K8S_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
SERVICE_SELECTOR_LABEL="istio=ingressgateway"

if [[ -z "$ZONE_ID" || -z "$API_TOKEN" ]]; then
  echo "[ERROR] CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN must be set" >&2
  exit 1
fi

echo "[INFO] Fetching Istio ingress LoadBalancer hostname..."
LB_HOSTNAME=$(kubectl get svc -n "$K8S_NAMESPACE" -l "$SERVICE_SELECTOR_LABEL" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
LB_IP=$(kubectl get svc -n "$K8S_NAMESPACE" -l "$SERVICE_SELECTOR_LABEL" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

if [[ -z "$LB_HOSTNAME" && -z "$LB_IP" ]]; then
  echo "[WARN] No LoadBalancer ingress found yet. Retry later." >&2
  exit 0
fi

TARGET=${LB_HOSTNAME:-$LB_IP}
echo "[INFO] Desired DNS target for $RECORD_NAME => $TARGET"

cat <<EOF
---
Stub mode: NOT performing Cloudflare API call.
When implementing, use:
  curl -X PATCH \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/<record_id>" \
    --data '{"type":"CNAME","name":"$RECORD_NAME","content":"$TARGET","ttl":120,"proxied":false}'
EOF

echo "[INFO] Script completed (stub)."