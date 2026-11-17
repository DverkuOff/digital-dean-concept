#!/usr/bin/env bash
# PostToolUse-хук Claude Code: после Edit/Write проверяет изменённый .ts/.tsx через ESLint.
# Ошибки возвращаются ассистенту (exit 2 + stderr), чтобы он сразу их исправил.
set -euo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')"
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
case "$file" in
  "$root"/src/*|"$root"/e2e/*|"$root"/scripts/*|src/*|e2e/*|scripts/*) ;;
  *) exit 0 ;;
esac
cd "$root"
if ! out="$(npx eslint --no-warn-ignored "$file" 2>&1)"; then
  echo "ESLint нашёл проблемы в $file:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
