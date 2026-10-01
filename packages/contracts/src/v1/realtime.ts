import type { LobbyDetails } from './lobby.js'
import type { MatchProposalDetails, MatchmakingRequestDetails, MatchmakingPlatform } from './matchmaking.js'
import type { GameSession } from './session.js'

export type RealtimeProtocolVersion = 'realtime.v1'

export type RealtimeClientType = 'web' | 'desktop' | 'mobile' | 'test'

export type RealtimeCommandType =
  | 'connection.handshake'
  | 'connection.ping'
  | 'subscription.subscribe'
  | 'subscription.unsubscribe'

export type RealtimeAckStatus = 'received' | 'accepted' | 'rejected'

export type RealtimeCloseReason =
  | 'NORMAL'
  | 'HEARTBEAT_TIMEOUT'
  | 'PROTOCOL_ERROR'
  | 'UNSUPPORTED_PROTOCOL_VERSION'
  | 'RATE_LIMITED'
  | 'SLOW_CONSUMER'
  | 'SERVER_SHUTDOWN'
  | 'REALTIME_UNAVAILABLE'

export type RealtimeErrorCode =
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'UNSUPPORTED_PROTOCOL_VERSION'
  | 'HANDSHAKE_REQUIRED'
  | 'HANDSHAKE_TIMEOUT'
  | 'INVALID_PLAYER_ID'
  | 'SUBSCRIPTION_DENIED'
  | 'REALTIME_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'SLOW_CONSUMER'

export type RealtimeSubscriptionTarget =
  | { kind: 'player' }
  | { kind: 'lobby'; lobbyId: string }
  | { kind: 'matchmakingRequest'; requestId: string }
  | { kind: 'session'; sessionId: string }

export type RealtimeChannel = `player:${string}` | `lobby:${string}` | `matchmaking:request:${string}` | `session:${string}`

export type RealtimeHandshakePayload = {
  protocolVersion: RealtimeProtocolVersion
  playerId: string
  clientType: RealtimeClientType
  clientVersion: string
  platform: MatchmakingPlatform
}

export type RealtimeSubscribePayload = {
  target: RealtimeSubscriptionTarget
}

export type RealtimeUnsubscribePayload = {
  target: RealtimeSubscriptionTarget
}

export type RealtimePingPayload = {
  sentAt: string
}

export type RealtimeConnectionState = 'connecting' | 'connected' | 'closing' | 'closed'

export type RealtimeEnvelope<TKind extends 'command' | 'event' | 'ack' | 'error', TType extends string, TPayload> = {
  protocolVersion: RealtimeProtocolVersion
  kind: TKind
  type: TType
  messageId: string
  timestamp: string
  correlationId?: string
  payload: TPayload
}

export type RealtimeCommandEnvelope<TPayload = unknown> = RealtimeEnvelope<'command', RealtimeCommandType, TPayload>

export type RealtimeAckEnvelope = RealtimeEnvelope<
  'ack',
  RealtimeCommandType,
  {
    status: RealtimeAckStatus
    details?: Record<string, string | number | boolean | null>
  }
>

export type RealtimeErrorEnvelope = RealtimeEnvelope<
  'error',
  'error',
  {
    code: RealtimeErrorCode
    messageKey: string
    details?: Record<string, string | number | boolean | null>
  }
>

export type ConnectionEstablishedPayload = {
  connectionId: string
  playerId: string
  gatewayNodeId: string
  state: Extract<RealtimeConnectionState, 'connected'>
  protocolVersion: RealtimeProtocolVersion
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
}

export type LobbyRealtimeEvent = {
  eventName: 'lobby.updated'
  lobby: LobbyDetails
}

export type MatchmakingRealtimeEvent =
  | {
      eventName: 'matchmaking.request.updated'
      request: MatchmakingRequestDetails
    }
  | {
      eventName: 'matchmaking.proposal.updated'
      proposal: MatchProposalDetails
    }

export type SessionRealtimeEvent = {
  eventName: 'session.updated'
  session: GameSession
}

export type PlayerRealtimeEvent = {
  eventName: 'player.notification'
  notification:
    | { kind: 'matchmaking'; request: MatchmakingRequestDetails | null; proposal: MatchProposalDetails | null }
    | { kind: 'session'; session: GameSession }
    | { kind: 'lobby'; lobby: LobbyDetails }
}

export type PlatformRealtimeEventPayload =
  | ConnectionEstablishedPayload
  | LobbyRealtimeEvent
  | MatchmakingRealtimeEvent
  | SessionRealtimeEvent
  | PlayerRealtimeEvent

export type PlatformRealtimeEventType =
  | 'connection.established'
  | 'lobby.updated'
  | 'matchmaking.request.updated'
  | 'matchmaking.proposal.updated'
  | 'session.updated'
  | 'player.notification'

export type PlatformRealtimeEvent = {
  protocolVersion: RealtimeProtocolVersion
  eventType: PlatformRealtimeEventType
  messageId: string
  occurredAt: string
  channels: RealtimeChannel[]
  payload: PlatformRealtimeEventPayload
}

export type ResolveRealtimeIdentityRequest = {
  playerId: string
}

export type ResolveRealtimeIdentityResponse = {
  playerId: string
}

export type AuthorizeRealtimeSubscriptionRequest = {
  playerId: string
  target: RealtimeSubscriptionTarget
}

export type AuthorizeRealtimeSubscriptionResponse = {
  allowed: boolean
  channel: RealtimeChannel | null
}