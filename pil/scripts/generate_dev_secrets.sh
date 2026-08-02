#!/usr/bin/env bash
# Generates local-only dev secrets under secrets/dev/ (gitignored). Never use these
# files or values in a real deployment — see Deployment & Hardening Guide for prod
# secret provisioning via /run/secrets.
set -euo pipefail

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/secrets/dev"
mkdir -p "$OUT_DIR"

if [ ! -f "$OUT_DIR/jwt_private_key.pem" ]; then
  openssl genpkey -algorithm ed25519 -out "$OUT_DIR/jwt_private_key.pem"
  openssl pkey -in "$OUT_DIR/jwt_private_key.pem" -pubout -out "$OUT_DIR/jwt_public_key.pem"
  echo "Generated dev JWT Ed25519 keypair."
fi

if [ ! -f "$OUT_DIR/root_secret.key" ]; then
  openssl rand -hex 32 > "$OUT_DIR/root_secret.key"
  echo "Generated dev root encryption secret."
fi

chmod 400 "$OUT_DIR"/* 2>/dev/null || true
echo "Dev secrets ready in $OUT_DIR"
