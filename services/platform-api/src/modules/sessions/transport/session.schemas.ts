import { z } from 'zod'

export const createSessionRequestSchema = z.object({
  matchId: z.string().trim().min(1).max(120),
})