import { describe, expect, it } from 'vitest'
import { createQueue, scanDirectory } from './filesystem'
import type { ProcessingOptions } from './types'

function fileHandle(name: string, size = 10): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => new File([new Uint8Array(size)], name),
  } as unknown as FileSystemFileHandle
}

function directoryHandle(name: string, children: Record<string, FileSystemHandle>): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of Object.entries(children)) yield entry
    },
  } as unknown as FileSystemDirectoryHandle
}

const options: ProcessingOptions = { speed: 2, preservePitch: true, overwriteConfirmed: false }

describe('folder discovery', () => {
  it('recurses, handles extension case, sorts paths, and excludes the root output folder', async () => {
    const root = directoryHandle('Audio', {
      'z.MP3': fileHandle('z.MP3'),
      notes: directoryHandle('notes', { 'áudio.wav': fileHandle('áudio.wav'), 'ignore.txt': fileHandle('ignore.txt') }),
      '_sped-up': directoryHandle('_sped-up', { 'old.mp3': fileHandle('old.mp3') }),
    })
    const files = await scanDirectory(root)
    expect(files.map((file) => file.relativePath)).toEqual(['notes/áudio.wav', 'z.MP3'])
  })

  it('marks files above 500 MB as skipped and creates mirrored output paths', () => {
    const source = {
      id: 'large',
      fileHandle: fileHandle('large.flac'),
      file: new File([new Uint8Array(1)], 'large.flac'),
      relativeDirectories: ['day one'],
      relativePath: 'day one/large.flac',
      extension: 'flac' as const,
    }
    Object.defineProperty(source.file, 'size', { value: 500 * 1024 * 1024 + 1 })
    const [item] = createQueue([source], options)
    expect(item.status).toBe('skipped')
    expect(item.outputRelativePath).toBe('_sped-up/day one/large__2.00x-preserve-pitch.flac')
  })
})
