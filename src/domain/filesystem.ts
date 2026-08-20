import { formatSpeed, outputFilename } from './audio'
import {
  MAX_FILE_BYTES,
  OUTPUT_DIRECTORY,
  SUPPORTED_EXTENSIONS,
  type AudioExtension,
  type ProcessingOptions,
  type QueueItem,
  type SourceFile,
} from './types'

function extensionOf(filename: string): AudioExtension | undefined {
  const extension = filename.split('.').pop()?.toLowerCase()
  return SUPPORTED_EXTENSIONS.find((candidate) => candidate === extension)
}

export function sourceId(relativePath: string): string {
  let hash = 2166136261
  for (const character of relativePath) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `audio-${(hash >>> 0).toString(16)}`
}

async function visitDirectory(
  directory: FileSystemDirectoryHandle,
  relativeDirectories: string[],
  results: SourceFile[],
): Promise<void> {
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'directory') {
      await visitDirectory(handle, [...relativeDirectories, name], results)
      continue
    }

    const extension = extensionOf(name)
    if (!extension) continue
    const file = await handle.getFile()
    const relativePath = [...relativeDirectories, name].join('/')
    results.push({
      id: sourceId(relativePath),
      fileHandle: handle,
      file,
      relativeDirectories,
      relativePath,
      extension,
    })
  }
}

export async function scanDirectory(root: FileSystemDirectoryHandle): Promise<SourceFile[]> {
  const results: SourceFile[] = []
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === 'directory') {
      if (name !== OUTPUT_DIRECTORY) await visitDirectory(handle, [name], results)
      continue
    }
    const extension = extensionOf(name)
    if (!extension) continue
    const file = await handle.getFile()
    results.push({
      id: sourceId(name),
      fileHandle: handle,
      file,
      relativeDirectories: [],
      relativePath: name,
      extension,
    })
  }
  return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

export function createQueue(files: readonly SourceFile[], options: ProcessingOptions): QueueItem[] {
  return files.map((source) => {
    const filename = outputFilename(source.file.name, options)
    const outputRelativePath = [OUTPUT_DIRECTORY, ...source.relativeDirectories, filename].join('/')
    const oversized = source.file.size > MAX_FILE_BYTES
    return {
      ...source,
      status: oversized ? 'skipped' : 'ready',
      progress: 0,
      outputRelativePath,
      error: oversized ? 'File exceeds the 500 MB browser-processing limit.' : undefined,
    }
  })
}

async function findDirectory(
  root: FileSystemDirectoryHandle,
  segments: readonly string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle | undefined> {
  let current = root
  for (const segment of segments) {
    try {
      current = await current.getDirectoryHandle(segment, { create })
    } catch (error) {
      if (!create && error instanceof DOMException && error.name === 'NotFoundError') return undefined
      throw error
    }
  }
  return current
}

export async function outputExists(root: FileSystemDirectoryHandle, item: QueueItem): Promise<boolean> {
  const directory = await findDirectory(root, [OUTPUT_DIRECTORY, ...item.relativeDirectories], false)
  if (!directory) return false
  const filename = item.outputRelativePath.split('/').at(-1)!
  try {
    await directory.getFileHandle(filename)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return false
    throw error
  }
}

export async function countConflicts(root: FileSystemDirectoryHandle, items: readonly QueueItem[]): Promise<number> {
  let count = 0
  for (const item of items) {
    if (item.status === 'ready' && (await outputExists(root, item))) count += 1
  }
  return count
}

export async function writeOutput(root: FileSystemDirectoryHandle, item: QueueItem, data: Uint8Array): Promise<void> {
  const directory = await findDirectory(root, [OUTPUT_DIRECTORY, ...item.relativeDirectories], true)
  if (!directory) throw new Error('The output directory could not be created.')
  const filename = item.outputRelativePath.split('/').at(-1)!
  const handle = await directory.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  try {
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    await writable.write(copy)
    await writable.close()
  } catch (error) {
    await writable.abort(error).catch(() => undefined)
    throw error
  }
}

export function folderSummary(items: readonly QueueItem[], options: ProcessingOptions): string {
  const ready = items.filter((item) => item.status !== 'skipped').length
  return `${ready} file${ready === 1 ? '' : 's'} ready at ${formatSpeed(options.speed)}×`
}
