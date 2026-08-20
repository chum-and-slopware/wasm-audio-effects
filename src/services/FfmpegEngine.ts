import { FFmpeg } from '@ffmpeg/ffmpeg'
import { buildFfmpegArguments } from '../domain/audio'
import { FORMAT_PROFILES } from '../domain/formats'
import { parseProbeLogs, progressFromLog } from '../domain/probe'
import type { AudioExtension, AudioProbe, ProcessingOptions, ProcessResult } from '../domain/types'

type ProgressCallback = (progress: number) => void

export class ProcessingCancelledError extends Error {
  constructor() {
    super('Processing was cancelled.')
    this.name = 'ProcessingCancelledError'
  }
}

export class FfmpegEngine {
  private ffmpeg = new FFmpeg()
  private loaded = false
  private cancelled = false

  async load(onStatus?: (message: string) => void): Promise<void> {
    if (this.loaded) return
    this.cancelled = false
    onStatus?.('Loading the local audio engine…')
    const base = `${import.meta.env.BASE_URL}ffmpeg-core`
    await this.ffmpeg.load({
      coreURL: `${base}/ffmpeg-core.js`,
      wasmURL: `${base}/ffmpeg-core.wasm`,
    })
    this.loaded = true
    onStatus?.('Audio engine ready.')
  }

  cancel(): void {
    this.cancelled = true
    if (this.loaded) this.ffmpeg.terminate()
    this.loaded = false
    this.ffmpeg = new FFmpeg()
  }

  private ensureNotCancelled(): void {
    if (this.cancelled) throw new ProcessingCancelledError()
  }

  private async probe(inputName: string): Promise<AudioProbe> {
    const logs: string[] = []
    const listener = ({ message }: { message: string }) => logs.push(message)
    this.ffmpeg.on('log', listener)
    try {
      await this.ffmpeg.exec(['-hide_banner', '-i', inputName])
    } finally {
      this.ffmpeg.off('log', listener)
    }
    return parseProbeLogs(logs)
  }

  private async execute(
    args: string[],
    expectedDuration: number,
    onProgress: ProgressCallback,
  ): Promise<number> {
    const listener = ({ message }: { message: string }) => {
      const progress = progressFromLog(message, expectedDuration)
      if (progress !== undefined) onProgress(progress)
    }
    this.ffmpeg.on('log', listener)
    try {
      return await this.ffmpeg.exec(args)
    } finally {
      this.ffmpeg.off('log', listener)
    }
  }

  async process(
    file: File,
    extension: AudioExtension,
    options: ProcessingOptions,
    onProgress: ProgressCallback,
  ): Promise<ProcessResult> {
    this.ensureNotCancelled()
    await this.load()
    this.ensureNotCancelled()

    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const inputName = `input-${nonce}.${extension}`
    const outputName = `output-${nonce}.${extension}`
    let warning: string | undefined

    try {
      await this.ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()))
      const probe = await this.probe(inputName)
      this.ensureNotCancelled()

      const expectedDuration = probe.durationSeconds > 0 ? probe.durationSeconds / options.speed : 0
      const profile = FORMAT_PROFILES[extension]
      const initialArgs = buildFfmpegArguments(inputName, outputName, extension, probe, options, profile.preserveArtwork)
      let exitCode = await this.execute(initialArgs, expectedDuration, onProgress)

      if (exitCode !== 0 && profile.preserveArtwork) {
        await this.ffmpeg.deleteFile(outputName).catch(() => undefined)
        warning = 'Attached artwork was incompatible and was omitted.'
        const retryArgs = buildFfmpegArguments(inputName, outputName, extension, probe, options, false)
        exitCode = await this.execute(retryArgs, expectedDuration, onProgress)
      }

      this.ensureNotCancelled()
      if (exitCode !== 0) throw new Error('FFmpeg could not encode this audio file.')

      const result = await this.ffmpeg.readFile(outputName)
      if (!(result instanceof Uint8Array)) throw new Error('FFmpeg returned an unexpected output type.')
      onProgress(1)
      return { data: result, probe, warning }
    } catch (error) {
      if (this.cancelled) throw new ProcessingCancelledError()
      throw error
    } finally {
      if (this.loaded) {
        await this.ffmpeg.deleteFile(inputName).catch(() => undefined)
        await this.ffmpeg.deleteFile(outputName).catch(() => undefined)
      }
    }
  }
}
