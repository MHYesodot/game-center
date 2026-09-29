import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..', '..')
const defaultTargets = ['apps/web', 'packages', 'services/platform-api', 'games']
const codeFilePattern = /\.(?:[cm]?[jt]sx?)$/
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
const renderedAttributeNames = new Set(['aria-label', 'title', 'placeholder', 'alt'])
const translationKeyPattern = /^(?:common|navigation|catalog|lobby|matchmaking|errors)\./

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function toRelative(filePath) {
  return normalizePath(path.relative(workspaceRoot, filePath))
}

function collectCodeFiles(targetPath, files = []) {
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
      collectCodeFiles(path.join(targetPath, entry), files)
    }

    return files
  }

  if (codeFilePattern.test(targetPath)) {
    files.push(targetPath)
  }

  return files
}

function getWorkspacePackageMap() {
  const packageMap = new Map()

  for (const scope of ['apps', 'packages', 'services']) {
    const scopePath = path.join(workspaceRoot, scope)

    if (!fs.existsSync(scopePath)) {
      continue
    }

    for (const entry of fs.readdirSync(scopePath)) {
      const manifestPath = path.join(scopePath, entry, 'package.json')

      if (!fs.existsSync(manifestPath)) {
        continue
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

      if (manifest.name) {
        packageMap.set(manifest.name, path.join(scopePath, entry))
      }
    }
  }

  return packageMap
}

function tryResolveLocalFile(candidatePath) {
  const candidates = [
    candidatePath,
    `${candidatePath}.ts`,
    `${candidatePath}.tsx`,
    `${candidatePath}.js`,
    `${candidatePath}.jsx`,
    `${candidatePath}.mts`,
    `${candidatePath}.cts`,
    path.join(candidatePath, 'index.ts'),
    path.join(candidatePath, 'index.tsx'),
    path.join(candidatePath, 'index.js'),
    path.join(candidatePath, 'index.jsx'),
  ]

  for (const item of candidates) {
    const normalizedCandidate = item.endsWith('.js') || item.endsWith('.jsx')
      ? item.replace(/\.jsx?$/, '.ts')
      : item

    if (fs.existsSync(normalizedCandidate)) {
      return normalizedCandidate
    }

    if (fs.existsSync(item)) {
      return item
    }
  }

  return null
}

function resolveImport(filePath, specifier, workspacePackages) {
  if (specifier.startsWith('.')) {
    return tryResolveLocalFile(path.resolve(path.dirname(filePath), specifier))
  }

  const workspacePackageRoot = workspacePackages.get(specifier)

  if (!workspacePackageRoot) {
    return null
  }

  return workspacePackageRoot
}

function getLineAndColumn(sourceFile, start) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start)
  return {
    line: line + 1,
    column: character + 1,
  }
}

function parseImports(sourceText) {
  const imports = []

  for (const match of sourceText.matchAll(/(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1] ?? match[2]

    if (specifier) {
      imports.push(specifier)
    }
  }

  return imports
}

function getTopLevelOwner(filePath) {
  const relativePath = toRelative(filePath)
  const segments = relativePath.split('/')
  const scopeIndex = segments.findIndex((segment) => ['apps', 'packages', 'services', 'games'].includes(segment))

  if (scopeIndex === -1) {
    return { scope: segments[0], name: segments[1], relativePath }
  }

  const scope = segments[scopeIndex]
  const name = segments[scopeIndex + 1]

  return { scope, name, relativePath }
}

function getPlatformModuleName(filePath) {
  const match = toRelative(filePath).match(/^services\/platform-api\/src\/modules\/([^/]+)\//)
  return match?.[1] ?? null
}

function looksLikeHumanText(value) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return false
  }

  if (!/[A-Za-z\u0590-\u05FF]/.test(trimmed)) {
    return false
  }

  if (translationKeyPattern.test(trimmed)) {
    return false
  }

  if (/^[@/#a-z0-9._:-]+$/i.test(trimmed)) {
    return false
  }

  return true
}

function scanForHardCodedUiText(filePath, sourceFile, violations) {
  if (!/\/apps\//.test(normalizePath(filePath)) || !/\.(?:tsx|jsx)$/.test(filePath)) {
    return
  }

  const relativePath = toRelative(filePath)

  function visit(node) {
    if (ts.isJsxText(node) && looksLikeHumanText(node.getText(sourceFile))) {
      const { line, column } = getLineAndColumn(sourceFile, node.getStart())
      violations.push(`${relativePath}:${line}:${column} hard-coded UI text must use i18n translations`)
    }

    if (ts.isJsxAttribute(node) && renderedAttributeNames.has(node.name.text)) {
      const initializer = node.initializer

      if (initializer && ts.isStringLiteral(initializer) && looksLikeHumanText(initializer.text)) {
        const { line, column } = getLineAndColumn(sourceFile, initializer.getStart())
        violations.push(`${relativePath}:${line}:${column} rendered attribute text must use i18n translations`)
      }
    }

    if (ts.isJsxExpression(node) && node.expression) {
      if (
        (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
        looksLikeHumanText(node.expression.text)
      ) {
        const { line, column } = getLineAndColumn(sourceFile, node.expression.getStart())
        violations.push(`${relativePath}:${line}:${column} string literals rendered in JSX must use i18n translations`)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function detectCycles(graph) {
  const visited = new Set()
  const visiting = new Set()
  const stack = []
  const cycles = new Set()

  function visit(node) {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node)
      const cycle = [...stack.slice(cycleStart), node].map((item) => toRelative(item)).join(' -> ')
      cycles.add(cycle)
      return
    }

    if (visited.has(node)) {
      return
    }

    visiting.add(node)
    stack.push(node)

    for (const dependency of graph.get(node) ?? []) {
      visit(dependency)
    }

    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }

  for (const node of graph.keys()) {
    visit(node)
  }

  return [...cycles]
}

const targetPaths = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultTargets).map((target) =>
  path.resolve(workspaceRoot, target),
)
const workspacePackages = getWorkspacePackageMap()
const files = targetPaths.flatMap((target) => collectCodeFiles(target))
const fileSet = new Set(files.map((filePath) => normalizePath(filePath)))
const graph = new Map()
const violations = []

for (const filePath of files) {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS,
  )
  const imports = parseImports(sourceText)
  const dependencies = new Set()
  const owner = getTopLevelOwner(filePath)
  const ownerModule = getPlatformModuleName(filePath)
  const normalizedFilePath = normalizePath(filePath)

  scanForHardCodedUiText(filePath, sourceFile, violations)

  for (const specifier of imports) {
    const resolvedImport = resolveImport(filePath, specifier, workspacePackages)

    if (specifier.startsWith('@nestjs/') && normalizedFilePath.includes('/services/platform-api/src/modules/') && normalizedFilePath.includes('/domain/')) {
      const position = sourceText.indexOf(specifier)
      const { line, column } = getLineAndColumn(sourceFile, position)
      violations.push(`${toRelative(filePath)}:${line}:${column} domain layer must not depend on NestJS`)
    }

    if (!resolvedImport) {
      continue
    }

    const normalizedResolved = normalizePath(resolvedImport)
    const targetOwner = getTopLevelOwner(resolvedImport)
    const targetModule = getPlatformModuleName(resolvedImport)

    if (fileSet.has(normalizedResolved)) {
      dependencies.add(resolvedImport)
    }

    if (owner.scope === 'apps' && targetOwner.scope === 'apps' && owner.name !== targetOwner.name) {
      violations.push(`${toRelative(filePath)} cross-app imports are forbidden: ${specifier}`)
    }

    if (owner.scope === 'packages' && targetOwner.scope === 'apps') {
      violations.push(`${toRelative(filePath)} packages must not import app internals: ${specifier}`)
    }

    if (owner.scope === 'games' && targetOwner.scope === 'apps') {
      violations.push(`${toRelative(filePath)} games must not import app internals: ${specifier}`)
    }

    if (normalizedFilePath.includes('/services/platform-api/src/modules/') && ownerModule && targetModule && ownerModule !== targetModule) {
      violations.push(`${toRelative(filePath)} platform modules must not import another module's internals: ${specifier}`)
    }

    if (normalizedFilePath.includes('/services/platform-api/src/modules/') && normalizedFilePath.includes('/domain/')) {
      if (/\/(application|infrastructure|transport)\//.test(normalizedResolved)) {
        violations.push(`${toRelative(filePath)} domain layer must not import outer layers: ${specifier}`)
      }
    }
  }

  graph.set(filePath, dependencies)
}

for (const cycle of detectCycles(graph)) {
  violations.push(`circular dependency detected: ${cycle}`)
}

if (violations.length > 0) {
  console.error('Architecture validation failed:')
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log('Architecture validation passed.')