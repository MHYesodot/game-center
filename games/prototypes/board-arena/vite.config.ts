import { defineConfig } from 'vite'

import { getPrototypeAlias } from '../vite.shared.mjs'

export default defineConfig({
  resolve: {
    alias: getPrototypeAlias(),
  },
})