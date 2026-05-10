import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['verbose', ['json', { outputFile: '.last-test-run-unit.json' }]],
    coverage: {
      provider: 'v8',
      include: ['app/api/**/*.ts', 'app/_lib/**/*.ts'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
