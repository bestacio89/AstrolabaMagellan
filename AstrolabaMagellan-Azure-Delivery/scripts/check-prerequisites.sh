#!/usr/bin/env bash
set -euo pipefail
for command in az dotnet node npm zip curl getent psql openssl; do
  command -v "$command" >/dev/null 2>&1 || { echo "Missing required command: $command" >&2; exit 1; }
done
az version --output table
dotnet --info
node --version
npm --version
az bicep version

echo 'Prerequisite commands are available. This does not validate your Azure permissions or private network routing.'
