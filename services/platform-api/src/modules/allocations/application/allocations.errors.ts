import type { AllocationFailureCode } from '@game-center/contracts'

export class AllocationProviderError extends Error {
  constructor(readonly failureCode: AllocationFailureCode, message: string) {
    super(message)
  }
}