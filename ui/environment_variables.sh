#!/bin/sh

set -eu

ROOT_DIR=/home/node/app
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
API_URL="${NEXT_PUBLIC_API_URL:-}"

<<<<<<< HEAD
find "$ROOT_DIR" -type f | while read -r file; do
  sed -i "s|/NEXT_APP_URL|$NEXT_PUBLIC_BASE_PATH|g" "$file"
  sed -i "s|__NEXT_API_URL__|$NEXT_PUBLIC_API_URL|g" "$file"
  sed -i "s|__AUTHORIZATION__|$AUTHORIZATION|g" "$file"
  sed -i "s|__NETWORK__|$NETWORK|g" "$file"
done
=======
escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[|&]/\\&/g'
}
>>>>>>> 41f3337 (fix(docker): restrict runtime env rewrites to Next build artifacts)

BASE_PATH_ESCAPED="$(escape_sed_replacement "$BASE_PATH")"
API_URL_ESCAPED="$(escape_sed_replacement "$API_URL")"

rewrite_file() {
  file="$1"

  if ! grep -qE '/NEXT_APP_URL|__NEXT_API_URL__' "$file"; then
    return
  fi

  sed -i \
    -e "s|/NEXT_APP_URL|$BASE_PATH_ESCAPED|g" \
    -e "s|__NEXT_API_URL__|$API_URL_ESCAPED|g" \
    "$file"
}

if [ -f "$ROOT_DIR/server.js" ]; then
  rewrite_file "$ROOT_DIR/server.js"
fi

if [ -d "$ROOT_DIR/.next" ]; then
  find "$ROOT_DIR/.next" -type f \( \
    -name '*.js' -o \
    -name '*.mjs' -o \
    -name '*.cjs' -o \
    -name '*.json' -o \
    -name '*.html' -o \
    -name '*.map' \
  \) | while IFS= read -r file; do
    rewrite_file "$file"
  done
fi

cd "$ROOT_DIR"
node server.js
