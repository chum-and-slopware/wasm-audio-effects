import { readFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const coreDirectory = path.join(rootDirectory, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')
const coreFiles = ['ffmpeg-core.js', 'ffmpeg-core.wasm'] as const

function ffmpegCoreAssets(): Plugin {
  const serve = (middlewares: { use: (path: string, handler: (request: unknown, response: NodeJS.WritableStream & { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void }) => {
    for (const file of coreFiles) {
      middlewares.use(`/ffmpeg-core/${file}`, (_request, response, next) => {
        const source = path.join(coreDirectory, file)
        if (!existsSync(source)) {
          next()
          return
        }
        response.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        createReadStream(source).pipe(response)
      })
    }
  }

  return {
    name: 'self-host-ffmpeg-core',
    configureServer(server) {
      serve(server.middlewares)
    },
    configurePreviewServer(server) {
      serve(server.middlewares)
    },
    async generateBundle() {
      for (const file of coreFiles) {
        this.emitFile({
          type: 'asset',
          fileName: `ffmpeg-core/${file}`,
          source: await readFile(path.join(coreDirectory, file)),
        })
      }
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/wasm-voice-speeder/' : '/',
  plugins: [react(), ffmpegCoreAssets()],
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: { reporter: ['text', 'html'] },
  },
})
