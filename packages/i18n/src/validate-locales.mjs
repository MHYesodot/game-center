import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localesRoot = path.join(__dirname, 'locales')
const reservedKeysFile = path.join(__dirname, 'reserved-translation-keys.json')
const workspaceRoot = path.resolve(__dirname, '..', '..', '..')
const requiredLocales = ['en', 'he']
const codeFilePattern = /\.(?:[cm]?[jt]sx?)$/
const ignoredDirectories = new Set([
  '.git',
  '.turbo',
  '.cache',
  'coverage',
  'dist',
  'build',
  'node_modules',
  'playwright-report',
  'test-results',
])
const ignoredPathFragments = ['/packages/i18n/src/locales/', '/scripts/quality/fixtures/']

function readReservedKeys() {
  if (!fs.existsSync(reservedKeysFile)) {
    return new Set()
  }

  const content = JSON.parse(fs.readFileSync(reservedKeysFile, 'utf8'))
  const reservedKeys = Array.isArray(content.reservedKeys) ? content.reservedKeys : []

  return new Set(reservedKeys)
}

function listNamespaceFiles(locale) {
  const localeDir = path.join(localesRoot, locale)
  return fs.readdirSync(localeDir).filter((entry) => entry.endsWith('.json')).sort()
}

function extractPlaceholders(value) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

function validateIcuLikePlaceholders(value, file, key) {
  const openCount = (value.match(/\{/g) ?? []).length
  const closeCount = (value.match(/\}/g) ?? []).length

  if (openCount !== closeCount) {
    throw new Error(`Invalid placeholder syntax in ${file} at key ${key}`)
  }
}

function flattenEntries(node, filePath, prefix = '') {
  const entries = []

  for (const [key, value] of Object.entries(node)) {
    const nextKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'string') {
      if (value.trim().length === 0) {
        throw new Error(`Empty translation in ${filePath} at key ${nextKey}`)
      }

      validateIcuLikePlaceholders(value, filePath, nextKey)
      entries.push({
        key: nextKey,
        kind: 'string',
        values: [value],
      })
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error(`Empty translation list in ${filePath} at key ${nextKey}`)
      }

      value.forEach((item, index) => {
        if (typeof item !== 'string' || item.trim().length === 0) {
          throw new Error(`Invalid list translation in ${filePath} at key ${nextKey}[${index}]`)
        }

        validateIcuLikePlaceholders(item, filePath, `${nextKey}[${index}]`)
      })

      entries.push({
        key: nextKey,
        kind: 'array',
        values: value,
      })
      continue
    }

    if (value && typeof value === 'object') {
      entries.push(...flattenEntries(value, filePath, nextKey))
      continue
    }

    throw new Error(`Unsupported translation value in ${filePath} at key ${nextKey}`)
  }

  return entries
}

function parseLocaleFile(locale, fileName) {
  const filePath = path.join(localesRoot, locale, fileName)
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const namespace = fileName.replace(/\.json$/, '')
  const entries = flattenEntries(content, filePath, namespace)
  const keys = entries.map((entry) => entry.key)
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)

  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate translation keys in ${filePath}: ${duplicateKeys.join(', ')}`)
  }

  return {
    filePath,
    entries: new Map(entries.map((entry) => [entry.key, entry])),
    keys,
  }
}

function compareLocaleFiles(referenceLocale, currentLocale, fileName) {
  const reference = parseLocaleFile(referenceLocale, fileName)
  const current = parseLocaleFile(currentLocale, fileName)
  const missingKeys = reference.keys.filter((key) => !current.entries.has(key))
  const extraKeys = current.keys.filter((key) => !reference.entries.has(key))

  if (missingKeys.length > 0) {
    throw new Error(`Locale ${currentLocale} is missing keys in ${fileName}: ${missingKeys.join(', ')}`)
  }

  if (extraKeys.length > 0) {
    throw new Error(`Locale ${currentLocale} has extra keys in ${fileName}: ${extraKeys.join(', ')}`)
  }

  for (const key of reference.keys) {
    const referenceEntry = reference.entries.get(key)
    const currentEntry = current.entries.get(key)

    if (!referenceEntry || !currentEntry) {
      continue
    }

    if (referenceEntry.kind !== currentEntry.kind) {
      throw new Error(`Locale ${currentLocale} has mismatched translation type in ${fileName} at key ${key}`)
    }

    if (referenceEntry.values.length !== currentEntry.values.length) {
      throw new Error(`Locale ${currentLocale} has mismatched list length in ${fileName} at key ${key}`)
    }

    referenceEntry.values.forEach((value, index) => {
      const referencePlaceholders = extractPlaceholders(value)
      const currentPlaceholders = extractPlaceholders(currentEntry.values[index])

      if (referencePlaceholders.join('|') !== currentPlaceholders.join('|')) {
        throw new Error(`Locale ${currentLocale} has mismatched placeholders in ${fileName} at key ${key}`)
      }
    })
  }

  return reference.keys
}

function collectCodeFiles(currentPath, files = []) {
  const stat = fs.statSync(currentPath)

  if (stat.isDirectory()) {
    const directoryName = path.basename(currentPath)

    if (ignoredDirectories.has(directoryName)) {
      return files
    }

    for (const entry of fs.readdirSync(currentPath)) {
      collectCodeFiles(path.join(currentPath, entry), files)
    }

    return files
  }

  if (codeFilePattern.test(currentPath)) {
    files.push(currentPath)
  }

  return files
}

function collectReferencedTranslationKeys() {
  const referencedKeys = new Set()
  const files = collectCodeFiles(workspaceRoot)

  for (const filePath of files) {
    const normalizedPath = filePath.replace(/\\/g, '/')

    if (ignoredPathFragments.some((fragment) => normalizedPath.includes(fragment))) {
      continue
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : filePath.endsWith('.jsx')
          ? ts.ScriptKind.JSX
          : ts.ScriptKind.TS,
    )

    function maybeAddKey(value) {
      if (/^(?:common|navigation|catalog|lobby|matchmaking|errors)\./.test(value)) {
        referencedKeys.add(value)
      }
    }

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const calleeText = node.expression.getText(sourceFile)

        if ((calleeText === 'translate' || calleeText === 'translateList') && node.arguments.length >= 2) {
          const keyArgument = node.arguments[1]

          if (ts.isStringLiteral(keyArgument) || ts.isNoSubstitutionTemplateLiteral(keyArgument)) {
            maybeAddKey(keyArgument.text)
          }
        }
      }

      if (ts.isVariableDeclaration(node)) {
        const variableName = ts.isIdentifier(node.name) ? node.name.text : ''

        if (variableName.includes('Key') && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
          for (const property of node.initializer.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer))
            ) {
              maybeAddKey(property.initializer.text)
            }
          }
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name.getText(sourceFile).replace(/['"]/g, '')

        if (
          /(?:^|[A-Z])(displayNameKey|descriptionKey|taglineKey|playerRangeKey|sessionModesKey|techStackKey|lobbyThemeKey|clientSurfaceKey|serverFocusKey|categoryKey|errorKey)$/.test(
            propertyName,
          ) &&
          (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
        ) {
          maybeAddKey(node.initializer.text)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return referencedKeys
}

const referenceLocale = requiredLocales[0]
const referenceFiles = listNamespaceFiles(referenceLocale)

for (const locale of requiredLocales) {
  const localeDir = path.join(localesRoot, locale)

  if (!fs.existsSync(localeDir)) {
    throw new Error(`Missing required locale directory: ${locale}`)
  }

  const files = listNamespaceFiles(locale)
  const missingFiles = referenceFiles.filter((file) => !files.includes(file))
  const extraFiles = files.filter((file) => !referenceFiles.includes(file))

  if (missingFiles.length > 0) {
    throw new Error(`Locale ${locale} is missing files: ${missingFiles.join(', ')}`)
  }

  if (extraFiles.length > 0) {
    throw new Error(`Locale ${locale} has extra files: ${extraFiles.join(', ')}`)
  }
}

const translationKeys = new Set()

for (const locale of requiredLocales) {
  for (const fileName of referenceFiles) {
    const keys = compareLocaleFiles(referenceLocale, locale, fileName)

    if (locale === referenceLocale) {
      keys.forEach((key) => translationKeys.add(key))
    }
  }
}

const referencedKeys = collectReferencedTranslationKeys()
const reservedKeys = readReservedKeys()
const missingReferencedKeys = [...referencedKeys].filter((key) => !translationKeys.has(key)).sort()
const orphanedKeys = [...translationKeys]
  .filter((key) => !referencedKeys.has(key) && !reservedKeys.has(key))
  .sort()

if (missingReferencedKeys.length > 0) {
  throw new Error(`Referenced translation keys are missing from locale bundles: ${missingReferencedKeys.join(', ')}`)
}

if (orphanedKeys.length > 0) {
  console.warn(`Orphaned translation keys: ${orphanedKeys.join(', ')}`)
}

console.log('Locale validation passed for required locales:', requiredLocales.join(', '))