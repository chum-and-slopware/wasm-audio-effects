import type { AudioExtension, AudioFormatProfile, AudioProbe } from './types'

export const FORMAT_PROFILES: Record<AudioExtension, AudioFormatProfile> = {
  mp3: { extension: 'mp3', encoder: 'libmp3lame', fallbackBitrate: 192_000, preserveArtwork: true },
  wav: {
    extension: 'wav',
    encoder: 'pcm_s16le',
    preserveArtwork: false,
    compatibleSampleFormats: ['pcm_u8', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_f32le', 'pcm_f64le'],
  },
  flac: { extension: 'flac', encoder: 'flac', preserveArtwork: true },
  ogg: { extension: 'ogg', encoder: 'libvorbis', fallbackBitrate: 160_000, preserveArtwork: false },
  opus: { extension: 'opus', encoder: 'libopus', fallbackBitrate: 96_000, preserveArtwork: false },
  m4a: { extension: 'm4a', encoder: 'aac', fallbackBitrate: 160_000, preserveArtwork: true },
  aac: { extension: 'aac', encoder: 'aac', fallbackBitrate: 160_000, preserveArtwork: false },
}

export function encoderFor(profile: AudioFormatProfile, probe: AudioProbe): string {
  if (profile.extension === 'wav' && profile.compatibleSampleFormats?.includes(probe.codec)) {
    return probe.codec
  }
  if (profile.extension === 'ogg' && probe.codec.toLowerCase() === 'opus') {
    return 'libopus'
  }
  return profile.encoder
}

export function bitrateFor(profile: AudioFormatProfile, probe: AudioProbe): number | undefined {
  if (!profile.fallbackBitrate) return undefined
  return probe.bitrate ?? profile.fallbackBitrate
}
