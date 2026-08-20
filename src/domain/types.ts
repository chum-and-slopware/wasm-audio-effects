export const SUPPORTED_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a', 'aac'] as const
export type AudioExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export const MAX_FILE_BYTES = 500 * 1024 * 1024
export const OUTPUT_DIRECTORY = '_sped-up'

export type QueueStatus = 'ready' | 'skipped' | 'processing' | 'complete' | 'failed' | 'cancelled'

export interface ProcessingOptions {
  speed: number
  preservePitch: boolean
  overwriteConfirmed: boolean
}

export interface AudioFormatProfile {
  extension: AudioExtension
  encoder: string
  fallbackBitrate?: number
  preserveArtwork: boolean
  compatibleSampleFormats?: readonly string[]
}

export interface AudioProbe {
  codec: string
  durationSeconds: number
  sampleRate: number
  channels: number
  channelDescription: string
  bitrate?: number
  bitDepth?: number
  sampleFormat?: string
  hasMetadata: boolean
}

export interface SourceFile {
  id: string
  fileHandle: FileSystemFileHandle
  file: File
  relativeDirectories: string[]
  relativePath: string
  extension: AudioExtension
}

export interface QueueItem extends SourceFile {
  status: QueueStatus
  progress: number
  outputRelativePath: string
  warning?: string
  error?: string
  overwritten?: boolean
}

export interface BatchSummary {
  processed: number
  failed: number
  skipped: number
  cancelled: number
  overwritten: number
  elapsedMs: number
  outputPaths: string[]
}

export interface ProcessResult {
  data: Uint8Array
  probe: AudioProbe
  warning?: string
}

export type QueueUpdate = (id: string, update: Partial<QueueItem>) => void
