#!/usr/bin/env bash
# Plex Poster Helper - one-command Docker launcher (Linux / macOS / unraid).
#
#   ./docker/run.sh                    build (if needed) + start the web UI on :3939
#   ./docker/run.sh headless           start the optional headless scheduler (legacy)
#   ./docker/run.sh both               start the GUI and the scheduler together
#   ./docker/run.sh --build [target]   force a rebuild first
#   ./docker/run.sh --stop  [target]   stop & remove container(s); default: both
#   PORT=8095 ./docker/run.sh          use a different host port
#
# The web GUI includes a built-in scheduler. The headless container is only
# needed if you want scheduler-only with no UI.
set -euo pipefail

GUI_NAME=plex-poster-helper-2
GUI_IMAGE=plex-poster-helper-2
HL_NAME=plex-poster-helper-2-scheduler
HL_IMAGE=plex-poster-helper-2:headless
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

TARGET="" BUILD=0 STOP=0
for arg in "$@"; do
  case "$arg" in
    gui|headless|both) TARGET="$arg" ;;
    --build) BUILD=1 ;;
    --stop)  STOP=1 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

if [[ "$STOP" == 1 ]]; then
  if [[ -z "$TARGET" ]]; then TARGET=both; fi
  if [[ "$TARGET" != headless ]]; then docker rm -f "$GUI_NAME" >/dev/null 2>&1 || true; fi
  if [[ "$TARGET" != gui ]]; then docker rm -f "$HL_NAME" >/dev/null 2>&1 || true; fi
  echo "Stopped ($TARGET). Config volume '$VOLUME' is preserved."
  exit 0
fi

if [[ -z "$TARGET" ]]; then TARGET=gui; fi

build_image() {
  if [[ "$BUILD" == 1 || -z "$(docker images -q "$1")" ]]; then
    echo "Building $1 (first build takes a few minutes)…"
    docker build -f "$ROOT/docker/$2" -t "$1" "$ROOT"
  fi
}

docker volume create "$VOLUME" >/dev/null

start_gui() {
  build_image "$GUI_IMAGE" Dockerfile
  docker rm -f "$GUI_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$GUI_NAME" \
    -p "${PORT}:3939" \
    -e PUID=1000 -e PGID=1000 -e "TZ=$TZONE" -e PORT=3939 \
    -v "$VOLUME":/config \
    --shm-size=1g \
    --restart unless-stopped \
    "$GUI_IMAGE" >/dev/null
  echo "✓ Web UI running: http://localhost:${PORT}"
}

start_headless() {
  build_image "$HL_IMAGE" Dockerfile.headless
  docker rm -f "$HL_NAME" >/dev/null 2>&1 || true
  local extra=()
  if [[ -n "${PLEX_BASEURL:-}" ]]; then extra+=(-e "PLEX_BASEURL=$PLEX_BASEURL"); fi
  if [[ -n "${PLEX_TOKEN:-}"  ]]; then extra+=(-e "PLEX_TOKEN=$PLEX_TOKEN"); fi
  docker run -d --name "$HL_NAME" \
    -e "TZ=$TZONE" \
    -v "$VOLUME":/config \
    ${extra[@]+"${extra[@]}"} \
    --shm-size=1g \
    --restart unless-stopped \
    "$HL_IMAGE" >/dev/null
  echo "✓ Headless scheduler: running (legacy - the web UI includes a scheduler)"
}

case "$TARGET" in
  gui)      start_gui ;;
  headless) start_headless ;;
  both)     start_gui; start_headless ;;
esac

echo ""
echo "  Logs: docker logs -f $GUI_NAME"
echo "  Stop: ./docker/run.sh --stop [gui|headless|both]"
