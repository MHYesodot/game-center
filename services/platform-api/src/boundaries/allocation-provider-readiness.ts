export const ALLOCATION_PROVIDER_READINESS = Symbol('ALLOCATION_PROVIDER_READINESS')

export interface AllocationProviderReadiness {
  readonly dependencyName: 'docker'
  enabled(): boolean
  check(): Promise<void>
}