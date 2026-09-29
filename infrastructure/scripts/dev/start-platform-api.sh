#!/bin/sh
set -eu

cd /workspace

npm --workspace @game-center/platform-api run build
npx tsc -p services/platform-api/tsconfig.json --watch --preserveWatchOutput --watchFile fixedpollinginterval --watchDirectory fixedpollinginterval &
typescript_watch_pid=$!

cleanup() {
	kill "$typescript_watch_pid"
}

trap cleanup INT TERM EXIT
exec npx nodemon --watch services/platform-api/dist --ext js --exec "node services/platform-api/dist/main.js"
