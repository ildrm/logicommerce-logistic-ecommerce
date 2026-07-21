#!/usr/bin/env sh
set -eu
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
