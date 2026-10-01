import { z } from 'zod'

const subscriptionTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player') }),
  z.object({ kind: z.literal('lobby'), lobbyId: z.string().trim().min(1).max(120) }),
  z.object({ kind: z.literal('matchmakingRequest'), requestId: z.string().trim().min(1).max(120) }),
  z.object({ kind: z.literal('session'), sessionId: z.string().trim().min(1).max(120) }),
])

export const resolveRealtimeIdentitySchema = z.object({
  playerId: z.string().trim().min(1).max(120),
})

export const authorizeRealtimeSubscriptionSchema = z.object({
  playerId: z.string().trim().min(1).max(120),
  target: subscriptionTargetSchema,
})