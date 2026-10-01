import { z } from 'zod'

export const registerRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
})

export const loginRequestSchema = registerRequestSchema

export const issueRealtimeTicketRequestSchema = z.object({
  clientType: z.enum(['web', 'desktop', 'mobile', 'test']),
  clientVersion: z.string().trim().min(1).max(120),
  platform: z.enum(['web', 'windows', 'macos', 'linux', 'ios', 'android']),
})