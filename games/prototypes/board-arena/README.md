# Board Arena

Status: `PROTOTYPE ONLY`

This client is a reference asset for board-game interaction and visual direction.

It is not production architecture.

Do not expand it toward production quality.

Production direction:

- web or Godot client depending on title
- authoritative Go server

Current behavior preserved in this prototype:

- local two-player column-drop board interaction
- turn indicator and status messaging
- winner detection for four-in-a-row
- manual match reset

See:

- `docs/architecture/game-client-architecture.md`
- `docs/architecture/prototype-game-client-audit.md`
- `docs/adr/ADR-020-game-client-architecture-and-engine-selection.md`