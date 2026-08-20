import { describe, expect, it } from 'vitest'
import { parseProbeLogs, progressFromLog } from './probe'

describe('FFmpeg log parsing', () => {
  it('extracts first-stream audio properties', () => {
    const result = parseProbeLogs([
      '  Metadata:',
      '  Duration: 00:01:02.50, start: 0.000000, bitrate: 129 kb/s',
      '  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 128 kb/s',
    ])
    expect(result).toMatchObject({ codec: 'mp3', durationSeconds: 62.5, sampleRate: 44_100, channels: 2, bitrate: 128_000, hasMetadata: true })
  })

  it('throws a useful error for files without audio', () => {
    expect(() => parseProbeLogs(['Stream #0:0: Video: h264'])).toThrow('No readable audio stream')
  })

  it('bounds reported progress before completion', () => {
    expect(progressFromLog('size=1kB time=00:00:05.00 bitrate=2', 10)).toBe(.5)
    expect(progressFromLog('time=00:00:11.00', 10)).toBe(.99)
  })
})
