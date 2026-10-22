#!/usr/bin/env bash
# Runs the v1 hardening checks on isolated profiles (never your real data, never your running copy): typecheck, unit tests, build, then every probe.
# Usage: bash scripts/qa/run-all.sh [outDir]     Needs Playwright in $PW_DIR (default /tmp/born-pw) for the remote probes.
set -u
cd "$(dirname "$0")/../.."
OUT="${1:-${TMPDIR:-/tmp}/born-v1-qa}"; mkdir -p "$OUT"; rm -rf "$OUT"/prof-*
unset ELECTRON_RUN_AS_NODE
fail=0
step() { local name="$1"; shift; echo "=== $name"; if "$@" >"$OUT/$name.log" 2>&1; then echo "ok   $name — $(grep -E 'checks,|Tests |findings|identical' "$OUT/$name.log" | tail -1 | sed 's/\x1b\[[0-9;]*m//g')"; else echo "FAIL $name (see $OUT/$name.log)"; fail=1; fi; }
step typecheck npm run typecheck
step unit-tests npm test
step build npm run build
step layout-probe node scripts/qa/layout-probe.cjs "$OUT/prof-layout"
step output-probe node scripts/qa/output-probe.cjs
step remote-probe node scripts/qa/remote-probe.cjs "$OUT/prof-remote"
step remote-reconnect node scripts/qa/remote-reconnect.cjs "$OUT/prof-reconnect"
step input-probe node scripts/qa/input-probe.cjs "$OUT/prof-input"
step flows node scripts/qa/flows.cjs "$OUT/prof-flows"
step sweep node scripts/qa/sweep.cjs "$OUT/prof-sweep"
step verify-libraries node scripts/qa/verify-libraries.cjs resources
exit $fail
