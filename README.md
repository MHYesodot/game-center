# Game Center

A modern multi-surface game center with:

- A React main lobby in `apps/portal`
- A standalone board game client in `apps/board-arena`
- A standalone arcade client in `apps/arcade-runner`
- A standalone 3D simulation client in `apps/flight-sim`
- A Node + WebSocket lobby service in `services/lobby-server`

## Why this structure

The portal is only responsible for discovery and lobby orchestration. Gameplay clients are isolated so each game can use the runtime that best fits its rendering and input model.

## Run locally

Start the lobby service:

```bash
npm run dev:server
```

Start the portal:

```bash
npm run dev:portal
```

Start the standalone game clients:

```bash
npm run dev:board
npm run dev:arcade
npm run dev:sim
```

## Build everything

```bash
npm run build
```

## Service endpoints

- `GET /api/games`
- `GET /api/games/:slug`
- `GET /api/lobbies`
- `POST /api/lobbies`
- `POST /api/lobbies/:id/join`
- `POST /api/lobbies/:id/ready`
- `POST /api/lobbies/:id/board/move`

The board game endpoint applies server-side drop-token validation and win detection.