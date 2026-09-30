import { z } from 'zod'

export const createMatchmakingRequestSchema = z.object({
  gameId: z.string().trim().min(1).max(120),
  queueType: z.literal('quick-play'),
  platform: z.enum(['web', 'windows', 'macos', 'android', 'ios', 'ipados']),
  region: z.string().trim().min(1).max(64).optional(),
  protocolVersion: z.string().trim().min(1).max(64).optional(),
  sourceLobbyId: z.string().trim().min(1).max(120).optional(),
})