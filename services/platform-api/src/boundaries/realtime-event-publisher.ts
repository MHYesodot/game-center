import type { PlatformRealtimeEvent } from '@game-center/contracts'

export interface RealtimeEventPublisher {
  publish(event: PlatformRealtimeEvent): Promise<void>
}

export const REALTIME_EVENT_PUBLISHER = Symbol('REALTIME_EVENT_PUBLISHER')