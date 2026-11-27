#!/usr/bin/env bash
# Fails if a workflow could print account details into public Actions logs
# (incident 2026-11-25: `wrangler deployments list` printed the account e-mail).
#   1. No wrangler command whose output lists account or author details.
#   2. Every wrangler invocation is piped through redact-log.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
status=0
banned='wrangler[^|]*\b(whoami|deployments (list|status)|versions (list|view)|secret list)\b'
if grep -nE "$banned" .github/workflows/*.yml; then
  echo "::error::account-listing wrangler command in a workflow (prints the account e-mail)"
  status=1
fi
while IFS= read -r hit; do
  file=${hit%%:*}; rest=${hit#*:}; line=${rest%%:*}
  # The command may continue over backslash-continued lines; join until a line without one.
  cmd=$(awk -v n="$line" 'NR>=n { print; if ($0 !~ /\\$/) exit }' "$file")
  if ! grep -q 'redact-log.sh' <<<"$cmd"; then
    echo "::error file=$file,line=$line::wrangler output not piped through redact-log.sh"
    status=1
  fi
done < <(grep -nE 'npx --yes "?wrangler' .github/workflows/*.yml || true)
[ "$status" -eq 0 ] && echo "Workflow privacy check passed."
exit "$status"
