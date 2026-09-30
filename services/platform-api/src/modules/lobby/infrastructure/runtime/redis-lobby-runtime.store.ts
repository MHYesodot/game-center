import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { LobbyConnectionState, LobbyRuntimeState } from '@game-center/contracts'
import type { RedisClientType } from 'redis'

import { REDIS } from '../../../../infrastructure/infrastructure.tokens.js'
import { isRedisDependencyError, logDependencyDown } from '../../../../infrastructure/dependency-health.js'
import type { LobbyRuntimeStore } from '../../application/lobby.ports.js'
import { LOBBY_RECONNECT_GRACE_MS } from '../../domain/lobby-record.js'

type PresenceRecord = {
  connectionState: LobbyConnectionState
  lastSeenAt: string
  reconnectDeadlineAt: string | null
}

const runtimeTtlSeconds = 15 * 60

@Injectable()
export class RedisLobbyRuntimeStore implements LobbyRuntimeStore {
  private readonly namespace: string

  constructor(
    @Inject(REDIS) private readonly redis: RedisClientType,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    this.namespace = configService.get<string>('LOBBY_RUNTIME_NAMESPACE') ?? 'gc:v1'
  }

  async getRuntimeState(lobbyId: string, activePlayerIds: string[]): Promise<LobbyRuntimeState> {
    try {
      const [presenceMap, readyMemberIds] = await Promise.all([
        this.redis.hGetAll(this.presenceKey(lobbyId)),
        this.redis.sMembers(this.readyKey(lobbyId)),
      ])

      const readySet = new Set(readyMemberIds)
      const members = activePlayerIds.map((playerId) => {
        const encoded = presenceMap[playerId]
        const presence = encoded ? (JSON.parse(encoded) as PresenceRecord) : null

        return {
          playerId,
          connectionState: presence?.connectionState ?? 'disconnected',
          ready: readySet.has(playerId),
          lastSeenAt: presence?.lastSeenAt ?? null,
          reconnectDeadlineAt: presence?.reconnectDeadlineAt ?? null,
        }
      })

      const connectedMemberCount = members.filter((member) => member.connectionState === 'connected').length
      const allMembersReady = activePlayerIds.length > 0 && activePlayerIds.every((playerId) => readySet.has(playerId))

      return {
        available: true,
        connectedMemberCount,
        allMembersReady,
        readyMemberIds: members.filter((member) => member.ready).map((member) => member.playerId),
        members,
      }
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async markConnected(lobbyId: string, playerId: string, at: string): Promise<void> {
    try {
      await this.redis.hSet(this.presenceKey(lobbyId), playerId, JSON.stringify({
        connectionState: 'connected',
        lastSeenAt: at,
        reconnectDeadlineAt: null,
      } satisfies PresenceRecord))
      await this.redis.expire(this.presenceKey(lobbyId), runtimeTtlSeconds)
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async markDisconnected(lobbyId: string, playerId: string, at: string, reconnectDeadlineAt: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.hSet(this.presenceKey(lobbyId), playerId, JSON.stringify({
          connectionState: 'reconnecting',
          lastSeenAt: at,
          reconnectDeadlineAt,
        } satisfies PresenceRecord)),
        this.redis.sRem(this.readyKey(lobbyId), playerId),
      ])
      await this.redis.expire(this.presenceKey(lobbyId), runtimeTtlSeconds)
      await this.redis.expire(this.readyKey(lobbyId), runtimeTtlSeconds)
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async setReadyState(lobbyId: string, playerId: string, ready: boolean, at: string): Promise<void> {
    try {
      await this.markConnected(lobbyId, playerId, at)

      if (ready) {
        await this.redis.sAdd(this.readyKey(lobbyId), playerId)
      } else {
        await this.redis.sRem(this.readyKey(lobbyId), playerId)
      }

      await this.redis.expire(this.readyKey(lobbyId), runtimeTtlSeconds)
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async removeMember(lobbyId: string, playerId: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.hDel(this.presenceKey(lobbyId), playerId),
        this.redis.sRem(this.readyKey(lobbyId), playerId),
      ])
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async clearReadyState(lobbyId: string): Promise<void> {
    try {
      await this.redis.del(this.readyKey(lobbyId))
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  async clearLobbyRuntime(lobbyId: string): Promise<void> {
    try {
      await this.redis.del([this.presenceKey(lobbyId), this.readyKey(lobbyId)])
    } catch (error) {
      this.handleRuntimeError(error)
      throw error
    }
  }

  reconnectDeadlineAt(from: Date) {
    return new Date(from.getTime() + LOBBY_RECONNECT_GRACE_MS).toISOString()
  }

  private presenceKey(lobbyId: string) {
    return `${this.namespace}:lobby:${lobbyId}:presence`
  }

  private readyKey(lobbyId: string) {
    return `${this.namespace}:lobby:${lobbyId}:ready`
  }

  private handleRuntimeError(error: unknown) {
    if (isRedisDependencyError(error)) {
      logDependencyDown('redis', error, 'RedisLobbyRuntimeStore')
    }
  }
}