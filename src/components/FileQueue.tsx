import type { QueueItem } from '../domain/types'
import { formatBytes } from '../utils/format'
import { AlertIcon, CheckIcon } from './Icons'

const statusLabels: Record<QueueItem['status'], string> = {
  ready: 'Ready',
  skipped: 'Skipped',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

interface FileQueueProps {
  items: readonly QueueItem[]
}

export function FileQueue({ items }: FileQueueProps) {
  if (items.length === 0) return null

  return (
    <section className="queue-card" aria-labelledby="queue-heading">
      <div className="section-heading queue-heading">
        <div>
          <p className="eyebrow">Batch queue</p>
          <h2 id="queue-heading">Audio files</h2>
        </div>
        <span className="file-count">{items.length} found</span>
      </div>

      <div className="queue-table" role="table" aria-label="Selected audio files">
        <div className="queue-row queue-labels" role="row">
          <span role="columnheader">File</span>
          <span role="columnheader">Size</span>
          <span role="columnheader">Format</span>
          <span role="columnheader">Status</span>
        </div>
        {items.map((item) => (
          <div className={`queue-row status-${item.status}`} role="row" key={item.id}>
            <div className="file-cell" role="cell">
              <span className="file-name" title={item.relativePath}>{item.relativePath}</span>
              <span className="output-name">→ {item.outputRelativePath}</span>
              {item.error && <span className="row-message error"><AlertIcon width={14} />{item.error}</span>}
              {item.warning && <span className="row-message warning"><AlertIcon width={14} />{item.warning}</span>}
            </div>
            <span role="cell" data-label="Size">{formatBytes(item.file.size)}</span>
            <span role="cell" data-label="Format" className="format-pill">{item.extension.toUpperCase()}</span>
            <div className="status-cell" role="cell" data-label="Status">
              <span className="status-label">
                {item.status === 'complete' && <CheckIcon width={15} />}
                {statusLabels[item.status]}
              </span>
              {item.status === 'processing' && (
                <div className="mini-progress" aria-label={`${Math.round(item.progress * 100)} percent`}>
                  <span style={{ width: `${item.progress * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
