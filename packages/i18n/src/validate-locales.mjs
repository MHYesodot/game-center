import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localesRoot = path.join(__dirname, 'locales')
const requiredLocales = ['en', 'he']

function listNamespaceFiles(locale) {
  const localeDir = path.join(localesRoot, locale)
  return fs.readdirSync(localeDir).filter((entry) => entry.endsWith('.json')).sort()
}

function flatten(node, prefix = '') {
  const keys = []

  for (const [key, value] of Object.entries(node)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      keys.push(nextKey)
      continue
    }

    keys.push(...flatten(value, nextKey))
  }

  return keys
}

function validateIcuLikePlaceholders(value, file, key) {
  const openCount = (value.match(/\{/g) ?? []).length
  const closeCount = (value.match(/\}/g) ?? []).length

  if (openCount !== closeCount) {
    throw new Error(`Invalid placeholder syntax in ${file} at key ${key}`)
  }
}

function parseLocaleFile(locale, fileName) {
  const filePath = path.join(localesRoot, locale, fileName)
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const keys = flatten(content)
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)

  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate translation keys in ${filePath}: ${duplicateKeys.join(', ')}`)
  }

  for (const key of keys) {
    const value = key.split('.').reduce((accumulator, part) => accumulator[part], content)
    if (typeof value !== 'string') {
      continue
    }

    if (value.trim().length === 0) {
      throw new Error(`Empty translation in ${filePath} at key ${key}`)
    }

    validateIcuLikePlaceholders(value, filePath, key)
  }

  return { filePath, keys, content }
}

const referenceFiles = listNamespaceFiles(requiredLocales[0])

for (const locale of requiredLocales) {
  const localeDir = path.join(localesRoot, locale)
  if (!fs.existsSync(localeDir)) {
    throw new Error(`Missing required locale directory: ${locale}`)
  }

  const files = listNamespaceFiles(locale)
  const missingFiles = referenceFiles.filter((file) => !files.includes(file))

  if (missingFiles.length > 0) {
    throw new Error(`Locale ${locale} is missing files: ${missingFiles.join(', ')}`)
  }

  for (const fileName of referenceFiles) {
    const reference = parseLocaleFile(requiredLocales[0], fileName)
    const current = parseLocaleFile(locale, fileName)
    const missingKeys = reference.keys.filter((key) => !current.keys.includes(key))

    if (missingKeys.length > 0) {
      throw new Error(`Locale ${locale} is missing keys in ${fileName}: ${missingKeys.join(', ')}`)
    }
  }
}

console.log('Locale validation passed for required locales:', requiredLocales.join(', '))