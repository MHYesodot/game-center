# ADR-016 Desktop Platform — Tauri

Status: Accepted

## Context

Desktop Game Center must support native operations such as installation, launching, updates, local storage, and protocol handling on Windows and macOS.

## Decision

Use Tauri 2 as the desktop shell architecture.

The future application path is `apps/desktop`.

Rules:

- React UI does not perform native operations directly
- native capabilities are exposed through Tauri commands and capability abstractions
- desktop must not import implementation modules from `apps/web`

## Alternatives Considered

- Electron
- web-only launcher behavior
- native shell logic embedded directly into React UI code

## Consequences

- desktop-specific E2E tooling must be standardized later
- shared behavior should move into packages rather than app-to-app imports
- packaging and update workflows become desktop-specific concerns rather than generic web concerns