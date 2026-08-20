import { expect, test } from '@playwright/test'

test('renders the complete processing workspace and self-hosts the WASM core', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /hear more/i })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /preserve pitch/i })).toBeChecked()
  await expect(page.getByText('MP3 · WAV · FLAC · OGG · OPUS · M4A · AAC')).toBeVisible()

  const wasm = await request.get('/ffmpeg-core/ffmpeg-core.wasm')
  expect(wasm.ok()).toBeTruthy()
  expect(wasm.headers()['content-type']).toContain('application/wasm')
  expect((await wasm.body()).byteLength).toBeGreaterThan(1_000_000)
})

test('supports keyboard changes to processing settings', async ({ page }) => {
  await page.goto('/')
  const pitch = page.getByRole('checkbox', { name: /preserve pitch/i })
  await pitch.focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('Pitch-shifted mode')).toBeVisible()

  const customSpeed = page.getByRole('spinbutton', { name: 'Custom speed' })
  await customSpeed.fill('2.35')
  await expect(page.getByText('2.35×', { exact: true })).toBeVisible()
})

test('processes a WAV through the real WebAssembly engine and writes it locally', async ({ page }) => {
  await page.addInitScript(() => {
    const sampleRate = 8_000
    const seconds = 1
    const sampleCount = sampleRate * seconds
    const bytes = new Uint8Array(44 + sampleCount * 2)
    const view = new DataView(bytes.buffer)
    const text = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
    text(0, 'RIFF')
    view.setUint32(4, 36 + sampleCount * 2, true)
    text(8, 'WAVE')
    text(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    text(36, 'data')
    view.setUint32(40, sampleCount * 2, true)
    for (let index = 0; index < sampleCount; index += 1) {
      view.setInt16(44 + index * 2, Math.sin(2 * Math.PI * 440 * index / sampleRate) * 20_000, true)
    }

    const source = new File([bytes], 'tone.wav', { type: 'audio/wav' })
    const sourceHandle = { kind: 'file', name: source.name, getFile: async () => source }
    const outputFiles = new Map<string, Uint8Array>()
    const makeOutputFile = (name: string) => ({
      kind: 'file',
      name,
      createWritable: async () => ({
        write: async (data: Uint8Array) => outputFiles.set(name, new Uint8Array(data)),
        close: async () => {
          const output = outputFiles.get(name)
          ;(window as unknown as { __voiceSpeederOutput?: number[] }).__voiceSpeederOutput = output ? Array.from(output) : []
        },
        abort: async () => undefined,
      }),
    })
    const outputDirectory = {
      kind: 'directory',
      name: '_sped-up',
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        if (!options?.create && !outputFiles.has(name)) throw new DOMException('Missing', 'NotFoundError')
        return makeOutputFile(name)
      },
      getDirectoryHandle: async () => { throw new DOMException('Missing', 'NotFoundError') },
      async *entries() { /* no existing files */ },
    }
    let outputCreated = false
    const root = {
      kind: 'directory',
      name: 'Test audio',
      async *entries() { yield ['tone.wav', sourceHandle] },
      getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
        if (name !== '_sped-up' || (!outputCreated && !options?.create)) throw new DOMException('Missing', 'NotFoundError')
        outputCreated = true
        return outputDirectory
      },
    }
    Object.defineProperty(window, 'showDirectoryPicker', { value: async () => root })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Choose audio folder' }).click()
  await expect(page.getByText('tone.wav', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Process 1 file' }).click()
  await expect(page.locator('.run-status strong')).toHaveText('Batch complete: 1 processed, 0 failed.')

  const audio = await page.evaluate(async () => {
    const raw = (window as unknown as { __voiceSpeederOutput: number[] }).__voiceSpeederOutput
    const bytes = Uint8Array.from(raw)
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(bytes.buffer.slice(0))
    const samples = decoded.getChannelData(0)
    let upwardCrossings = 0
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index - 1] <= 0 && samples[index] > 0) upwardCrossings += 1
    }
    await context.close()
    return {
      header: String.fromCharCode(...bytes.slice(0, 4)),
      duration: decoded.duration,
      frequency: upwardCrossings / decoded.duration,
      size: bytes.byteLength,
    }
  })
  expect(audio.header).toBe('RIFF')
  expect(audio.size).toBeGreaterThan(1_000)
  expect(audio.duration).toBeCloseTo(1 / 1.5, 1)
  expect(audio.frequency).toBeGreaterThan(390)
  expect(audio.frequency).toBeLessThan(490)
})
