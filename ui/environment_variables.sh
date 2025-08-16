#!/bin/sh

if [ -z "$NEXT_PUBLIC_BASE_PATH" ];
then
  ROOT_DIR=/home/node/app/no_bp
  for file in $ROOT_DIR/*.js* $ROOT_DIR/.next/*.js* $ROOT_DIR/.next/server/*.js* $ROOT_DIR/.next/server/pages/*.js* $ROOT_DIR/.next/server/chunks/*.js* $ROOT_DIR/.next/static/chunks/*.js* $ROOT_DIR/.next/static/chunks/pages/*.js*;
  do
    sed -i 's|/NEXT_APP_URL|'"$NEXT_PUBLIC_BASE_PATH"'|g' $file
  done

  cd $ROOT_DIR
  node server.js
else
  ROOT_DIR=/home/node/app/with_bp
  for file in $ROOT_DIR/*.js* $ROOT_DIR/.next/*.js* $ROOT_DIR/.next/server/*.js* $ROOT_DIR/.next/server/pages/*.js* $ROOT_DIR/.next/server/chunks/*.js* $ROOT_DIR/.next/static/chunks/*.js* $ROOT_DIR/.next/static/chunks/pages/*.js*;
  do
    sed -i 's|/NEXT_APP_URL|'"$NEXT_PUBLIC_BASE_PATH"'|g' $file
  done

  cd $ROOT_DIR
  node server.js
fi