import { describe, expect, it } from 'vitest'
import { atempoFactors, audioFilter, buildFfmpegArguments, clampSpeed, outputFilename } from './audio'
import type { AudioProbe, ProcessingOptions } from './types'

const probe: AudioProbe = {
  codec: 'mp3',
  durationSeconds: 60,
  sampleRate: 44_100,
  channels: 2,
  channelDescription: 'stereo',
  bitrate: 128_000,
  bitDepth: 32,
  sampleFormat: 'fltp',
  hasMetadata: true,
}

const options: ProcessingOptions = { speed: 1.5, preservePitch: true, overwriteConfirmed: false }

describe('audio command generation', () => {
  it('clamps and rounds speeds to the supported 0.05 increments', () => {
    expect(clampSpeed(1)).toBe(1.1)
    expect(clampSpeed(1.574)).toBe(1.55)
    expect(clampSpeed(8)).toBe(4)
  })

  it('uses two safe atempo stages above 2x', () => {
    const factors = atempoFactors(4)
    expect(factors).toEqual([2, 2])
    expect(factors.reduce((product, factor) => product * factor, 1)).toBeCloseTo(4)
  })

  it('changes the declared sample rate when pitch is not preserved', () => {
    expect(audioFilter({ ...options, speed: 1.5, preservePitch: false }, 44_100))
      .toBe('asetrate=66150,aresample=44100')
  })

  it('creates deterministic names without altering the extension case', () => {
    expect(outputFilename('Talk.Final.MP3', options)).toBe('Talk.Final__1.50x-preserve-pitch.MP3')
  })

  it('preserves MP3 bitrate, metadata, and optional artwork mappings', () => {
    const args = buildFfmpegArguments('in.mp3', 'out.mp3', 'mp3', probe, options, true)
    expect(args).toContain('libmp3lame')
    expect(args).toContain('128000')
    expect(args).toContain('0:v:0?')
    expect(args).toContain('-map_metadata')
  })

  it('uses compatible source PCM codecs for WAV files', () => {
    const args = buildFfmpegArguments('in.wav', 'out.wav', 'wav', { ...probe, codec: 'pcm_s24le', bitDepth: 24 }, options, false)
    expect(args).toContain('pcm_s24le')
    expect(args).not.toContain('-b:a')
  })
})
