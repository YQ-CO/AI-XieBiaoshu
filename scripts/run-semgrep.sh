#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
TARGET="${2:-backend/src}"
REPORT_DIR="${3:-.reports/semgrep}"

mkdir -p "$REPORT_DIR"

run_observe() {
  semgrep \
    --config p/security-audit \
    --severity WARNING \
    --severity INFO \
    --json \
    --output "$REPORT_DIR/semgrep-observe.json" \
    "$TARGET"
}

run_blocking() {
  semgrep \
    --config p/security-audit \
    --severity ERROR \
    --error \
    --json \
    --output "$REPORT_DIR/semgrep-blocking.json" \
    "$TARGET"
}

case "$MODE" in
  observe)
    run_observe
    ;;
  blocking)
    run_blocking
    ;;
  all)
    run_observe
    run_blocking
    ;;
  *)
    echo "usage: $0 <observe|blocking|all> [target_dir] [report_dir]" >&2
    exit 2
    ;;
esac
