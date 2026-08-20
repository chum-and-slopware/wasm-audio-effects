import type { AudioProbe } from './types'

function durationInSeconds(value: string): number {
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

function channelCount(description: string): number {
  const normalized = description.toLowerCase().trim()
  if (normalized.includes('mono')) return 1
  if (normalized.includes('stereo')) return 2
  const surround = normalized.match(/(\d+)\.(\d+)/)
  if (surround) return Number(surround[1]) + Number(surround[2])
  const explicit = normalized.match(/(\d+) channels?/)
  return explicit ? Number(explicit[1]) : 2
}

function bitDepth(codec: string, sampleFormat?: string): number | undefined {
  const value = `${codec} ${sampleFormat ?? ''}`.toLowerCase()
  const match = value.match(/(?:s|u|flt|pcm_[a-z]*)(8|16|24|32|64)/)
  if (match) return Number(match[1])
  if (value.includes('fltp') || value.includes('flt')) return 32
  if (value.includes('dbl')) return 64
  return undefined
}

export function parseProbeLogs(logs: readonly string[]): AudioProbe {
  const text = logs.join('\n')
  const durationMatch = text.match(/Duration:\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
  const audioLine = logs.find((line) => /Stream #.*Audio:/i.test(line))
  if (!audioLine) throw new Error('No readable audio stream was found.')

  const codecMatch = audioLine.match(/Audio:\s*([^,\s]+)/i)
  const rateMatch = audioLine.match(/(\d+)\s*Hz/i)
  const bitrateMatch = audioLine.match(/(\d+(?:\.\d+)?)\s*kb\/s/i)
  const sampleFormatMatch = audioLine.match(/Hz,\s*([^,]+),\s*([^,]+)/i)
  const codec = codecMatch?.[1] ?? ''
  const sampleRate = Number(rateMatch?.[1] ?? 0)
  if (!codec || !sampleRate) throw new Error('The audio codec or sample rate could not be determined.')

  const channelDescription = sampleFormatMatch?.[1]?.trim() ?? 'stereo'
  const sampleFormat = sampleFormatMatch?.[2]?.trim().split(' ')[0]

  return {
    codec,
    durationSeconds: durationMatch ? durationInSeconds(durationMatch[1]) : 0,
    sampleRate,
    channels: channelCount(channelDescription),
    channelDescription,
    bitrate: bitrateMatch ? Math.round(Number(bitrateMatch[1]) * 1000) : undefined,
    bitDepth: bitDepth(codec, sampleFormat),
    sampleFormat,
    hasMetadata: /Metadata:/i.test(text),
  }
}

export function progressFromLog(message: string, expectedOutputDuration: number): number | undefined {
  if (expectedOutputDuration <= 0) return undefined
  const match = message.match(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
  if (!match) return undefined
  return Math.min(0.99, durationInSeconds(match[1]) / expectedOutputDuration)
}
