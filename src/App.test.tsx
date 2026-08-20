import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    load = vi.fn()
    terminate = vi.fn()
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'showDirectoryPicker')
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
})

describe('Voice Speeder interface', () => {
  it('shows the processing controls and privacy promise', () => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: vi.fn() })
    render(<App />)
    expect(screen.getByRole('heading', { name: /hear more/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /preserve pitch/i })).toBeChecked()
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument()
  })

  it('changes the pitch mode description', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: vi.fn() })
    render(<App />)
    await userEvent.click(screen.getByRole('checkbox', { name: /preserve pitch/i }))
    expect(screen.getByText('Pitch-shifted mode')).toBeInTheDocument()
  })

  it('explains browser incompatibility and disables folder selection', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('compatible Chromium browser')
    expect(screen.getByRole('button', { name: /choose audio folder/i })).toBeDisabled()
  })
})
