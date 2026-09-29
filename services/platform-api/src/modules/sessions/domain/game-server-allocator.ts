import type { AllocateServer, AllocatorDescriptor, ServerReady } from '@game-center/contracts'

export interface GameServerAllocator {
  describe(): AllocatorDescriptor
  allocate(command: AllocateServer): Promise<ServerReady>
}