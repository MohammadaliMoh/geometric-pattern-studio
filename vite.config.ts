import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 3030, strictPort: true }, preview: { port: 3030, strictPort: true }, test: { include: ['src/**/*.test.ts'] } })
