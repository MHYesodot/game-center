import { z } from 'zod'

const lobbyConfigurationSchema = z.object({
  schemaVersion: z.string().trim().min(1).max(64),
  settings: z.record(z.string(), z.union([z.string().max(256), z.number().finite(), z.boolean()])),
})

export const createLobbyRequestSchema = z.object({
  gameId: z.string().trim().min(1).max(128),
  visibility: z.enum(['public', 'private']),
  capacity: z.coerce.number().int().positive().max(16),
  minimumPlayers: z.coerce.number().int().positive().max(16),
  configuration: lobbyConfigurationSchema,
  joinCode: z.string().trim().min(4).max(64).optional(),
})

export const joinLobbyRequestSchema = z.object({
  joinCode: z.string().trim().min(4).max(64).optional(),
})

export const setLobbyReadyRequestSchema = z.object({
  ready: z.boolean(),
})

export type CreateLobbyRequestDto = z.infer<typeof createLobbyRequestSchema>
export type JoinLobbyRequestDto = z.infer<typeof joinLobbyRequestSchema>
export type SetLobbyReadyRequestDto = z.infer<typeof setLobbyReadyRequestSchema>