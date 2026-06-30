#!/usr/bin/env bash
# Plex Poster Helper - one-command Docker launcher (Linux / macOS / unraid).
#
#   ./docker/run.sh              build (if needed) + start the web UI on :3939
#   ./docker/run.sh --build      force a rebuild first
#   ./docker/run.sh --stop       stop & remove the container (config volume kept)
#   PORT=8095 ./docker/run.sh    use a different host port
#
# The web UI includes a built-in scheduler, so this single container is all you need.
set -euo pipefail

NAME=plex-poster-helper-2
IMAGE=plex-poster-helper-2
VOLUME=ppsh-config
PORT="${PORT:-3939}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

detect_tz() {
  if [[ -n "${TZ:-}" ]]; then echo "$TZ"; return; fi
  if [[ -s /etc/timezone ]]; then cat /etc/timezone; return; fi
  if [[ -L /etc/localtime ]]; then readlink /etc/localtime | sed -E 's#.*/zoneinfo/##'; return; fi
  echo UTC
}
TZONE="$(detect_tz)"

BUILD=0 STOP=0
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=1 ;;
    --stop)  STOP=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

if [[ "$STOP" == 1 ]]; then
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  echo "Stopped. Config volume '$VOLUME' is preserved."
  exit 0
fi

docker volume create "$VOLUME" >/dev/null

if [[ "$BUILD" == 1 || -z "$(docker images -q "$IMAGE")" ]]; then
  echo "Building $IMAGE (first build takes a few minutes)…"
  docker build -f "$ROOT/docker/Dockerfile" -t "$IMAGE" "$ROOT"
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -p "${PORT}:3939" \
  -e "TZ=$TZONE" -e PORT=3939 \
  -v "$VOLUME":/config \
  --restart unless-stopped \
  "$IMAGE" >/dev/null

echo "✓ Web UI running: http://localhost:${PORT}"
echo ""
echo "  Logs: docker logs -f $NAME"
echo "  Stop: ./docker/run.sh --stop"
