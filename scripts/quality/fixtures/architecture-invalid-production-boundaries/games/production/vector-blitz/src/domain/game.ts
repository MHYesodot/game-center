import { JsonLogger } from '../../../../../../../../services/platform-api/src/common/logging/json-logger.service.ts'

void JsonLogger

export async function loadGame() {
  await fetch('/api/games/vector-blitz')
  return { ready: true }
}