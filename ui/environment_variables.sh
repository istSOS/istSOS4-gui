#!/bin/sh

ROOT_DIR=/home/node/app

if [ -z "$NEXT_PUBLIC_ISTSOS4_URL" ]; then
  echo "Missing NEXT_PUBLIC_ISTSOS4_URL environment variable" >&2
  exit 1
fi

find "$ROOT_DIR" -type f | while read -r file; do
  sed -i "s|/NEXT_APP_URL|$NEXT_PUBLIC_BASE_PATH|g" "$file"
  sed -i "s|/ISTSOS4_URL|$NEXT_PUBLIC_ISTSOS4_URL|g" "$file"
  sed -i "s|/MAP_DEFAULT_BASEMAP|$NEXT_PUBLIC_MAP_DEFAULT_BASEMAP|g" "$file"
  sed -i "s|/MAP_CENTER|$NEXT_PUBLIC_MAP_CENTER|g" "$file"
  sed -i "s|/MAP_ZOOM|$NEXT_PUBLIC_MAP_ZOOM|g" "$file"
done

cd $ROOT_DIR
node server.js
