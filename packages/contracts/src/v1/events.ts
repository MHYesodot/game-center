export type DomainEvent<TName extends string, TPayload> = {
  kind: 'domain'
  name: TName
  payload: TPayload
  occurredAt: string
}

export type IntegrationEvent<TName extends string, TPayload> = {
  kind: 'integration'
  name: TName
  payload: TPayload
  occurredAt: string
}

export type Command<TName extends string, TPayload> = {
  kind: 'command'
  name: TName
  payload: TPayload
}

export type Query<TName extends string, TPayload> = {
  kind: 'query'
  name: TName
  payload: TPayload
}

export type PlatformIntegrationEventName =
  | 'catalog.game-published'
  | 'lobby.created'
  | 'lobby.ready-check-completed'
  | 'matchmaking.ticket-queued'
  | 'matchmaking.match-created'
  | 'sessions.session-created'
  | 'sessions.session-ready'
  | 'sessions.result-reported'
  | 'sessions.session-terminated'

export type PlatformIntegrationEvent = IntegrationEvent<
  PlatformIntegrationEventName,
  Record<string, string | number | boolean | string[]>
>