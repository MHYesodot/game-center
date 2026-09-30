import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { MatchReadyPayload } from '@game-center/contracts'

import { SESSION_MATCH_READY_HANDLER, type SessionMatchReadyHandler } from '../../../boundaries/session-match-ready-handler.js'
import type { MatchReadySink } from './matchmaking.ports.js'

@Injectable()
export class DelegatingMatchReadySink implements MatchReadySink {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onMatchReady(match: MatchReadyPayload): Promise<void> {
    let handler: SessionMatchReadyHandler | undefined

    try {
      handler = this.moduleRef.get<SessionMatchReadyHandler | undefined>(SESSION_MATCH_READY_HANDLER, {
        strict: false,
      })
    } catch {
      return
    }

    if (!handler) {
      return
    }

    await handler.onMatchReady(match)
  }
}