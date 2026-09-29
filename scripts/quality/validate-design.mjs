import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..', '..')
const defaultTargets = ['apps/web', 'packages', 'services/platform-api']
const allowedRawLiteralFiles = new Set([
  'apps/web/src/index.css',
  'packages/design-tokens/src/index.ts',
])
const ignoredDirectories = new Set([
  '.git',
  '.cache',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])
const literalMatchers = [
  { label: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { label: 'rgb color', pattern: /rgba?\([^\n]+?\)/g },
  { label: 'hsl color', pattern: /hsla?\([^\n]+?\)/g },
  { label: 'gradient', pattern: /(?:linear|radial)-gradient\([^\n]+?\)/g },
]

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function toRelative(filePath) {
  return normalizePath(path.relative(workspaceRoot, filePath))
}

function collectCssFiles(targetPath, files = []) {
  if (!fs.existsSync(targetPath)) {
    return files
  }

  const stat = fs.statSync(targetPath)

  if (stat.isDirectory()) {
    const directoryName = path.basename(targetPath)

    if (ignoredDirectories.has(directoryName)) {
      return files
    }

    for (const entry of fs.readdirSync(targetPath)) {
      collectCssFiles(path.join(targetPath, entry), files)
    }

    return files
  }

  if (targetPath.endsWith('.css')) {
    files.push(targetPath)
  }

  return files
}

function getLineAndColumn(source, index) {
  const before = source.slice(0, index)
  const lines = before.split(/\r?\n/)
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  }
}

const targetPaths = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultTargets).map((target) =>
  path.resolve(workspaceRoot, target),
)
const violations = []

for (const filePath of targetPaths.flatMap((target) => collectCssFiles(target))) {
  const relativePath = toRelative(filePath)

  if (allowedRawLiteralFiles.has(relativePath)) {
    continue
  }

  const source = fs.readFileSync(filePath, 'utf8')

  for (const { label, pattern } of literalMatchers) {
    for (const match of source.matchAll(pattern)) {
      const { line, column } = getLineAndColumn(source, match.index ?? 0)
      violations.push(`${relativePath}:${line}:${column} disallowed raw ${label} literal \`${match[0]}\``)
    }
  }

  for (const lineMatch of source.matchAll(/transition\s*:[^;]+;/g)) {
    if (lineMatch[0].includes('var(')) {
      continue
    }

    const { line, column } = getLineAndColumn(source, lineMatch.index ?? 0)
    violations.push(`${relativePath}:${line}:${column} transitions must use motion tokens`)
  }
}

if (violations.length > 0) {
  console.error('Design token validation failed:')
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log('Design token validation passed.')