import { useCallback, useMemo, useRef, useState } from 'react'
import { clampSpeed } from './domain/audio'
import { countConflicts, createQueue, folderSummary, scanDirectory } from './domain/filesystem'
import type { BatchSummary, ProcessingOptions, QueueItem, SourceFile } from './domain/types'
import { FileQueue } from './components/FileQueue'
import { OverwriteDialog } from './components/OverwriteDialog'
import { AlertIcon, BoltIcon, CheckIcon, FolderIcon, LockIcon, StopIcon, WaveIcon } from './components/Icons'
import { FfmpegEngine } from './services/FfmpegEngine'
import { processBatch } from './services/batch'
import { errorText, formatDuration } from './utils/format'

const speedPresets = [1.25, 1.5, 2, 3, 4]

function initialCompatibility(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'showDirectoryPicker' in window
}

export default function App() {
  const compatible = initialCompatibility()
  const [root, setRoot] = useState<FileSystemDirectoryHandle>()
  const [sources, setSources] = useState<SourceFile[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [speed, setSpeed] = useState(1.5)
  const [preservePitch, setPreservePitch] = useState(true)
  const [status, setStatus] = useState('Choose a folder to begin.')
  const [processing, setProcessing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [summary, setSummary] = useState<BatchSummary>()
  const [conflictCount, setConflictCount] = useState(0)
  const [showConflicts, setShowConflicts] = useState(false)
  const engineRef = useRef(new FfmpegEngine())
  const cancelledRef = useRef(false)

  const options = useMemo<ProcessingOptions>(() => ({ speed, preservePitch, overwriteConfirmed: false }), [speed, preservePitch])
  const readyCount = queue.filter((item) => item.status === 'ready').length
  const activeItems = queue.filter((item) => item.status !== 'skipped')
  const overallProgress = activeItems.length
    ? activeItems.reduce((total, item) => total + (item.status === 'complete' ? 1 : item.progress), 0) / activeItems.length
    : 0

  const rebuildQueue = useCallback((nextSources: readonly SourceFile[], nextOptions: ProcessingOptions) => {
    setQueue(createQueue(nextSources, nextOptions))
    setSummary(undefined)
  }, [])

  const chooseFolder = async () => {
    if (!compatible || processing) return
    setScanning(true)
    setStatus('Waiting for folder permission…')
    try {
      const selected = await window.showDirectoryPicker({ mode: 'readwrite' })
      setStatus('Scanning folders for supported audio…')
      const discovered = await scanDirectory(selected)
      setRoot(selected)
      setSources(discovered)
      rebuildQueue(discovered, options)
      setStatus(discovered.length ? `Selected “${selected.name}”.` : 'No supported audio files were found in that folder.')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus(errorText(error))
    } finally {
      setScanning(false)
    }
  }

  const changeSpeed = (value: number) => {
    const nextSpeed = clampSpeed(value)
    setSpeed(nextSpeed)
    rebuildQueue(sources, { ...options, speed: nextSpeed })
  }

  const changePitch = (value: boolean) => {
    setPreservePitch(value)
    rebuildQueue(sources, { ...options, preservePitch: value })
  }

  const updateQueue = useCallback((id: string, update: Partial<QueueItem>) => {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...update } : item))
  }, [])

  const runBatch = async (confirmed: boolean) => {
    if (!root || processing || readyCount === 0) return
    setShowConflicts(false)
    setProcessing(true)
    setSummary(undefined)
    cancelledRef.current = false
    const runOptions = { ...options, overwriteConfirmed: confirmed }
    try {
      await engineRef.current.load(setStatus)
      const result = await processBatch({
        root,
        items: queue,
        options: runOptions,
        engine: engineRef.current,
        update: updateQueue,
        onStatus: setStatus,
        isCancelled: () => cancelledRef.current,
      })
      setSummary(result)
      setStatus(result.cancelled
        ? 'Processing cancelled. Completed outputs were kept.'
        : `Batch complete: ${result.processed} processed, ${result.failed} failed.`)
    } catch (error) {
      setStatus(errorText(error))
    } finally {
      setProcessing(false)
    }
  }

  const prepareBatch = async () => {
    if (!root || processing) return
    setStatus('Checking for existing output files…')
    try {
      const conflicts = await countConflicts(root, queue)
      setConflictCount(conflicts)
      if (conflicts > 0) {
        setShowConflicts(true)
        setStatus(`${conflicts} existing output ${conflicts === 1 ? 'file needs' : 'files need'} confirmation.`)
      } else {
        await runBatch(false)
      }
    } catch (error) {
      setStatus(errorText(error))
    }
  }

  const cancel = () => {
    cancelledRef.current = true
    setStatus('Cancelling the current file…')
    engineRef.current.cancel()
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Voice Speeder home">
          <span className="brand-mark"><WaveIcon /></span>
          <span>Voice Speeder</span>
        </a>
        <span className="local-badge"><LockIcon width={15} />Runs locally</span>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Batch audio, minus the busywork</p>
            <h1>Hear more.<br /><em>Wait less.</em></h1>
            <p className="hero-intro">Speed up folders of recordings while keeping voices natural. Your files stay on your computer, processed privately with WebAssembly.</p>
            <div className="hero-actions">
              <button className="button primary large" onClick={chooseFolder} disabled={!compatible || scanning || processing}>
                <FolderIcon />{scanning ? 'Scanning…' : root ? 'Choose another folder' : 'Choose audio folder'}
              </button>
              <span className="format-note">MP3 · WAV · FLAC · OGG · OPUS · M4A · AAC</span>
            </div>
          </div>
          <div className="sound-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="wave-disc"><WaveIcon width={84} height={84} /></div>
            <span className="speed-chip chip-one">1.5×</span>
            <span className="speed-chip chip-two">2×</span>
            <span className="privacy-chip"><LockIcon width={15} />Private by design</span>
          </div>
        </section>

        {!compatible && (
          <section className="compatibility-banner" role="alert">
            <AlertIcon />
            <div><strong>A compatible Chromium browser is required.</strong><span>Open this HTTPS page in desktop Chrome, Edge, or Brave to select and write a folder.</span></div>
          </section>
        )}

        <section className="workspace" aria-labelledby="settings-heading">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">Your processing desk</p>
              <h2 id="settings-heading">Set the pace</h2>
            </div>
            {root && <span className="folder-label"><FolderIcon width={17} />{root.name}</span>}
          </div>

          <div className="controls-grid">
            <div className="control-panel speed-panel">
              <div className="control-title">
                <div><span className="step-number">01</span><h3>Playback speed</h3></div>
                <output htmlFor="speed-range speed-number" className="speed-output">{speed.toFixed(2)}×</output>
              </div>
              <input
                id="speed-range"
                className="speed-range"
                type="range"
                min="1.1"
                max="4"
                step="0.05"
                value={speed}
                style={{ background: `linear-gradient(to right, var(--orange) 0%, var(--orange) ${((speed - 1.1) / 2.9) * 100}%, #d9d9d1 ${((speed - 1.1) / 2.9) * 100}%)` }}
                onChange={(event) => changeSpeed(Number(event.target.value))}
                disabled={processing}
              />
              <div className="range-labels"><span>1.10×</span><span>4.00×</span></div>
              <div className="speed-presets" aria-label="Speed presets">
                {speedPresets.map((preset) => <button key={preset} className={speed === preset ? 'active' : ''} onClick={() => changeSpeed(preset)} disabled={processing}>{preset}×</button>)}
                <label className="custom-speed">Custom <input id="speed-number" type="number" min="1.1" max="4" step="0.05" value={speed} onChange={(event) => changeSpeed(Number(event.target.value))} disabled={processing} aria-label="Custom speed" /></label>
              </div>
            </div>

            <div className="control-panel pitch-panel">
              <div className="control-title">
                <div><span className="step-number">02</span><h3>Voice character</h3></div>
              </div>
              <label className="toggle-row">
                <span><strong>Preserve pitch</strong><small>Keep voices sounding natural at higher speeds</small></span>
                <input type="checkbox" checked={preservePitch} onChange={(event) => changePitch(event.target.checked)} disabled={processing} />
                <span className="toggle" aria-hidden="true"><span /></span>
              </label>
              <div className="pitch-explainer"><WaveIcon /><p><strong>{preservePitch ? 'Natural voice mode' : 'Pitch-shifted mode'}</strong>{preservePitch ? 'Timing changes, vocal character stays familiar.' : 'Speed and pitch rise together for a classic fast-forward sound.'}</p></div>
            </div>
          </div>

          <div className="run-bar">
            <div className="run-status">
              <span className={`status-dot ${processing ? 'active' : ''}`} />
              <div><strong>{status}</strong>{queue.length > 0 && !processing && <small>{folderSummary(queue, options)} · outputs go to _sped-up</small>}</div>
            </div>
            {processing ? (
              <button className="button stop" onClick={cancel}><StopIcon />Cancel processing</button>
            ) : (
              <button className="button primary" onClick={prepareBatch} disabled={!root || readyCount === 0 || !compatible}><BoltIcon />Process {readyCount || ''} {readyCount === 1 ? 'file' : 'files'}</button>
            )}
          </div>

          {(processing || summary) && (
            <div className="overall-progress" aria-label={`Overall progress ${Math.round(overallProgress * 100)} percent`}>
              <span style={{ width: `${overallProgress * 100}%` }} />
            </div>
          )}

          {summary && (
            <div className="summary" role="status">
              <CheckIcon />
              <div><strong>{summary.processed} completed</strong><span>{summary.failed} failed · {summary.skipped} skipped · {summary.overwritten} replaced · {formatDuration(summary.elapsedMs)}</span></div>
            </div>
          )}
        </section>

        <FileQueue items={queue} />

        <section className="trust-strip" aria-label="Application guarantees">
          <div><LockIcon /><span><strong>Never uploaded</strong>Your audio stays on this device</span></div>
          <div><BoltIcon /><span><strong>WASM powered</strong>FFmpeg runs inside your browser</span></div>
          <div><FolderIcon /><span><strong>Folder friendly</strong>Nested structure is preserved</span></div>
        </section>
      </main>

      <footer><span>Voice Speeder</span><span>Private, local audio processing.</span></footer>
      <p className="sr-only" aria-live="polite">{status}</p>

      {showConflicts && <OverwriteDialog count={conflictCount} onCancel={() => setShowConflicts(false)} onConfirm={() => runBatch(true)} />}
    </div>
  )
}
