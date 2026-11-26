#!/usr/bin/env bash
# Filter for public CI logs: replaces e-mail addresses with [redacted-email].
# Usage: some-command 2>&1 | redact-log.sh
exec sed -E 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[redacted-email]/g'
