import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runValidator(scriptName: string, fixtureDirectory: string) {
  return spawnSync(process.execPath, [path.join(__dirname, scriptName), path.join(__dirname, 'fixtures', fixtureDirectory)], {
    cwd: path.resolve(__dirname, '..', '..'),
    encoding: 'utf8',
  })
}

describe('quality validators', () => {
  it('accepts a valid architecture fixture', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-valid')

    expect(result.status).toBe(0)
  })

  it('rejects hard-coded ui text', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-hardcoded')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('hard-coded UI text must use i18n translations')
  })

  it('rejects cross-app imports', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-import')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('cross-app imports are forbidden')
  })

  it('rejects production game monolithic main entries', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-production-main')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('production game main.ts must remain bootstrap-only')
  })

  it('rejects large production game innerHTML construction', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-production-innerhtml')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('production game clients must not construct large application UI with innerHTML')
  })

  it('rejects production game platform boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-production-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('production games must not import platform API internals')
    expect(result.stderr).toContain('production game domain/rendering layers must not call platform HTTP APIs directly')
  })

  it('rejects matchmaking boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-matchmaking-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('matchmaking domain layer must not depend on raw persistence or runtime clients')
    expect(result.stderr).toContain('matchmaking application layer must not depend on raw persistence or runtime clients')
    expect(result.stderr).toContain('matchmaking must use the catalog public boundary, not catalog persistence internals')
    expect(result.stderr).toContain('matchmaking must not depend on lobby persistence internals')
  })

  it('rejects session boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-session-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('sessions domain layer must not depend on raw persistence or runtime clients')
    expect(result.stderr).toContain('sessions application layer must not depend on raw persistence or runtime clients')
    expect(result.stderr).toContain('sessions must use matchmaking public boundaries, not matchmaking persistence or runtime internals')
  })

  it('rejects allocation boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-allocation-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('allocation domain layer must not depend on raw persistence, container, or cluster clients')
    expect(result.stderr).toContain('only allocation infrastructure may import container or cluster SDKs directly')
    expect(result.stderr).toContain('allocation application layer must not import provider or persistence implementations directly')
    expect(result.stderr).toContain('allocation modules must not depend on Session persistence internals')
    expect(result.stderr).toContain('allocation modules must use the Catalog public boundary, not Catalog persistence internals')
  })

  it('rejects realtime gateway boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-realtime-gateway-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('realtime gateway must not depend on SQL or Postgres clients directly')
    expect(result.stderr).toContain('realtime gateway must not define gameplay protocol content')
    expect(result.stderr).toContain('platform-api must not import realtime gateway internals')
    expect(result.stderr).toContain('games must not import realtime gateway internals')
  })

  it('rejects auth boundary violations', () => {
    const result = runValidator('validate-architecture.mjs', 'architecture-invalid-auth-boundaries')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('platform-api runtime must not trust x-player-id headers')
    expect(result.stderr).toContain('platform business modules must not depend on auth persistence or crypto internals')
  })

  it('rejects raw design literals outside approved token files', () => {
    const result = runValidator('validate-design.mjs', 'design-invalid')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('disallowed raw hex color literal')
  })

  it('accepts tokenized design usage', () => {
    const result = runValidator('validate-design.mjs', 'design-valid')

    expect(result.status).toBe(0)
  })
})