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