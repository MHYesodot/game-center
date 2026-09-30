import path from 'node:path'

export function getPrototypeAlias() {
  return {
    '@game-center/game-client-core': path.resolve(
      import.meta.dirname,
      '..',
      '..',
      'packages',
      'game-client-core',
      'src',
      'index.ts',
    ),
    '@game-center/i18n': path.resolve(import.meta.dirname, '..', '..', 'packages', 'i18n', 'src', 'index.ts'),
  }
}