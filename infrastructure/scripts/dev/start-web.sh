#!/bin/sh
set -eu

cd /workspace
exec npm --workspace @game-center/web run dev -- --host 0.0.0.0 --port 5173
