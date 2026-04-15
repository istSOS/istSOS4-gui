#!/bin/sh

ROOT_DIR=/home/node/app

find "$ROOT_DIR" -type f | while read -r file; do
  sed -i "s|/NEXT_APP_URL|$NEXT_PUBLIC_BASE_PATH|g" "$file"
done

cd $ROOT_DIR
node server.js
