import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { RedisClientType } from 'redis'

import { REDIS } from '../../../../infrastructure/infrastructure.tokens.js'
import { isRedisDependencyError, logDependencyDown } from '../../../../infrastructure/dependency-health.js'
import type { MatchmakingQueueStore } from '../../application/matchmaking.ports.js'
import type { DurableMatchmakingRequest } from '../../domain/queue-ticket.js'

const runtimeTtlSeconds = 15 * 60

type ErrorLike = {
  code?: string
  message?: string
}

@Injectable()
export class RedisMatchmakingQueueStore implements MatchmakingQueueStore {
  private readonly namespace: string

  constructor(
    @Inject(REDIS) private readonly redis: RedisClientType,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    this.namespace = configService.get<string>('MATCHMAKING_RUNTIME_NAMESPACE') ?? 'gc:v1:mm'
  }

  async enqueue(request: DurableMatchmakingRequest): Promise<void> {
    try {
      await this.redis.zAdd(this.queueKey(request.queueKey), [{ score: new Date(request.requestedAt).getTime(), value: request.requestId }])
      await this.redis.expire(this.queueKey(request.queueKey), runtimeTtlSeconds)
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async remove(queueKey: string, requestId: string): Promise<void> {
    try {
      await this.redis.zRem(this.queueKey(queueKey), requestId)
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async removeMany(queueKey: string, requestIds: string[]): Promise<void> {
    try {
      if (requestIds.length === 0) {
        return
      }

      await this.redis.zRem(this.queueKey(queueKey), requestIds)
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async getCandidateRequestIds(queueKey: string, limit: number): Promise<string[]> {
    try {
      return await this.redis.zRange(this.queueKey(queueKey), 0, Math.max(limit - 1, 0))
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async getRuntimeState(queueKey: string, requestId: string) {
    try {
      const [rank, count] = await Promise.all([
        this.redis.zRank(this.queueKey(queueKey), requestId),
        this.redis.zCard(this.queueKey(queueKey)),
      ])

      return {
        available: true,
        queuePosition: rank === null ? null : rank + 1,
        estimatedWaitSeconds: null,
        candidateCount: count,
        lastHeartbeatAt: null,
        searchExpansionVersion: null,
      }
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async acquireQueueLock(queueKey: string, ownerToken: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.set(this.lockKey(queueKey), ownerToken, { NX: true, EX: ttlSeconds })
      return result === 'OK'
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async releaseQueueLock(queueKey: string, ownerToken: string): Promise<void> {
    try {
      const currentOwner = await this.redis.get(this.lockKey(queueKey))

      if (currentOwner === ownerToken) {
        await this.redis.del(this.lockKey(queueKey))
      }
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async touchProposalLease(proposalId: string, expiresAt: string): Promise<void> {
    try {
      const ttlSeconds = Math.max(Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000), 1)
      await this.redis.set(this.proposalKey(proposalId), expiresAt, { EX: ttlSeconds })
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  async clearProposalLease(proposalId: string): Promise<void> {
    try {
      await this.redis.del(this.proposalKey(proposalId))
    } catch (error) {
      throw this.normalizeRuntimeError(error)
    }
  }

  private queueKey(queueKey: string) {
    return `${this.namespace}:queue:${queueKey}`
  }

  private proposalKey(proposalId: string) {
    return `${this.namespace}:proposal:${proposalId}`
  }

  private lockKey(queueKey: string) {
    return `${this.namespace}:lock:queue:${queueKey}`
  }

  private normalizeRuntimeError(error: unknown) {
    if (isRedisDependencyError(error) || !this.redis.isOpen || !this.redis.isReady) {
      logDependencyDown('redis', error, 'RedisMatchmakingQueueStore')

      const candidate = error instanceof Error || (error && typeof error === 'object') ? (error as ErrorLike) : undefined

      return Object.assign(new Error(candidate?.message ?? 'Redis unavailable'), {
        code: candidate?.code ?? 'ECONNREFUSED',
        cause: error,
      })
    }

    if (error instanceof Error) {
      return error
    }

    return new Error('Unexpected matchmaking runtime error')
  }
}