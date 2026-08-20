import { bitrateFor, encoderFor, FORMAT_PROFILES } from './formats'
import type { AudioExtension, AudioProbe, ProcessingOptions } from './types'

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1.5
  return Math.min(4, Math.max(1.1, Math.round(value * 20) / 20))
}

export function formatSpeed(speed: number): string {
  return clampSpeed(speed).toFixed(2)
}

export function atempoFactors(speed: number): number[] {
  const value = clampSpeed(speed)
  if (value <= 2) return [value]
  const factor = Math.sqrt(value)
  return [factor, factor]
}

export function audioFilter(options: ProcessingOptions, sampleRate: number): string {
  if (options.preservePitch) {
    return atempoFactors(options.speed).map((factor) => `atempo=${factor.toFixed(8)}`).join(',')
  }
  const shiftedRate = Math.round(sampleRate * clampSpeed(options.speed))
  return `asetrate=${shiftedRate},aresample=${sampleRate}`
}

export function outputFilename(filename: string, options: Pick<ProcessingOptions, 'speed' | 'preservePitch'>): string {
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const extension = dot > 0 ? filename.slice(dot) : ''
  const mode = options.preservePitch ? 'preserve-pitch' : 'pitch-shifted'
  return `${stem}__${formatSpeed(options.speed)}x-${mode}${extension}`
}

export function buildFfmpegArguments(
  inputName: string,
  outputName: string,
  extension: AudioExtension,
  probe: AudioProbe,
  options: ProcessingOptions,
  includeArtwork: boolean,
): string[] {
  const profile = FORMAT_PROFILES[extension]
  const args = ['-hide_banner', '-y', '-i', inputName, '-map', '0:a:0']

  if (includeArtwork && profile.preserveArtwork) {
    args.push('-map', '0:v:0?', '-c:v', 'copy')
  } else {
    args.push('-vn')
  }

  args.push('-af', audioFilter(options, probe.sampleRate), '-c:a', encoderFor(profile, probe))

  const bitrate = bitrateFor(profile, probe)
  if (bitrate) args.push('-b:a', String(bitrate))

  if (extension === 'flac' && probe.bitDepth && probe.bitDepth > 16) {
    args.push('-sample_fmt', 's32')
  }

  args.push('-map_metadata', '0', outputName)
  return args
}
