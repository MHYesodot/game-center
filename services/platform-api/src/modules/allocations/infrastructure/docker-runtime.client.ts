export const DOCKER_RUNTIME_CLIENT = Symbol('DOCKER_RUNTIME_CLIENT')

export type DockerRuntimeContainerState =
  | 'created'
  | 'running'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'exited'
  | 'dead'
  | 'unknown'

export type DockerRuntimeHealthState = 'starting' | 'healthy' | 'unhealthy' | null

export type DockerRuntimePortBinding = {
  containerPort: number
  hostPort: number
  protocol: 'tcp' | 'udp'
}

export type DockerRuntimeContainer = {
  id: string
  name: string
  image: string
  labels: Record<string, string>
  state: DockerRuntimeContainerState
  health: DockerRuntimeHealthState
  exitCode: number | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  portBindings: DockerRuntimePortBinding[]
}

export type DockerRuntimeCreateContainerInput = {
  name: string
  image: string
  labels: Record<string, string>
  env: Record<string, string>
  networkName: string
  internalPort: number
  memoryBytes: number
  nanoCpus: number
  pidsLimit: number
  stopTimeoutSeconds: number
  user?: string | null
  readOnlyRootFilesystem?: boolean
}

export interface DockerRuntimeClient {
  ping(): Promise<void>
  ensureNetwork(name: string): Promise<void>
  inspectContainer(idOrName: string): Promise<DockerRuntimeContainer | null>
  findManagedContainer(input: { allocationId: string; name: string }): Promise<DockerRuntimeContainer | null>
  createContainer(input: DockerRuntimeCreateContainerInput): Promise<DockerRuntimeContainer>
  startContainer(containerId: string): Promise<void>
  stopContainer(containerId: string, timeoutSeconds: number): Promise<void>
  removeContainer(containerId: string, force: boolean): Promise<void>
  getLogs(containerId: string, tail: number): Promise<string>
  listManagedContainers(): Promise<DockerRuntimeContainer[]>
}