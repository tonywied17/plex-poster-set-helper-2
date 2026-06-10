#!/bin/sh
set -e

# The GUI image keeps its data under /config/app (the KasmVNC base owns /config
# itself). The headless image uses the same path so a shared volume means shared
# Plex sign-in and schedules. Older headless images wrote to /config directly -
# migrate that layout once.
if [ -f /config/config.json ] && [ ! -e /config/app ]; then
  echo "[entrypoint] migrating legacy /config layout to /config/app"
  mkdir /config/app
  for f in /config/* /config/.[!.]*; do
    [ -e "$f" ] || continue
    [ "$f" = "/config/app" ] || mv "$f" /config/app/
  done
fi

# xvfb-run gives Electron a virtual display; the app itself opens no window.
exec xvfb-run -a /app/node_modules/.bin/electron /app --headless --no-sandbox
