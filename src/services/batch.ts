import { outputExists, writeOutput } from '../domain/filesystem'
import type { BatchSummary, ProcessingOptions, QueueItem, QueueUpdate } from '../domain/types'
import { FfmpegEngine, ProcessingCancelledError } from './FfmpegEngine'

interface BatchRequest {
  root: FileSystemDirectoryHandle
  items: readonly QueueItem[]
  options: ProcessingOptions
  engine: FfmpegEngine
  update: QueueUpdate
  onStatus: (message: string) => void
  isCancelled: () => boolean
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Write permission was denied for the selected folder.'
  }
  return error instanceof Error ? error.message : 'An unexpected processing error occurred.'
}

export async function processBatch(request: BatchRequest): Promise<BatchSummary> {
  const startedAt = performance.now()
  const summary: BatchSummary = {
    processed: 0,
    failed: 0,
    skipped: request.items.filter((item) => item.status === 'skipped').length,
    cancelled: 0,
    overwritten: 0,
    elapsedMs: 0,
    outputPaths: [],
  }

  const readyItems = request.items.filter((item) => item.status === 'ready')
  for (let index = 0; index < readyItems.length; index += 1) {
    const item = readyItems[index]
    if (request.isCancelled()) {
      const remaining = readyItems.slice(index)
      remaining.forEach((pending) => request.update(pending.id, { status: 'cancelled', progress: 0 }))
      summary.cancelled += remaining.length
      break
    }

    request.onStatus(`Processing ${index + 1} of ${readyItems.length}: ${item.relativePath}`)
    request.update(item.id, { status: 'processing', progress: 0, error: undefined })

    try {
      const overwritten = await outputExists(request.root, item)
      const result = await request.engine.process(item.file, item.extension, request.options, (progress) => {
        request.update(item.id, { progress })
      })
      if (request.isCancelled()) throw new ProcessingCancelledError()
      await writeOutput(request.root, item, result.data)
      request.update(item.id, {
        status: 'complete',
        progress: 1,
        warning: result.warning,
        overwritten,
      })
      summary.processed += 1
      summary.overwritten += overwritten ? 1 : 0
      summary.outputPaths.push(item.outputRelativePath)
    } catch (error) {
      if (error instanceof ProcessingCancelledError || request.isCancelled()) {
        request.update(item.id, { status: 'cancelled', progress: 0 })
        summary.cancelled += 1
        const remaining = readyItems.slice(index + 1)
        remaining.forEach((pending) => request.update(pending.id, { status: 'cancelled', progress: 0 }))
        summary.cancelled += remaining.length
        break
      }
      request.update(item.id, { status: 'failed', progress: 0, error: errorMessage(error) })
      summary.failed += 1
    }
  }

  summary.elapsedMs = performance.now() - startedAt
  return summary
}
