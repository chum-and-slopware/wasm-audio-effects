# Voice Speeder

Voice Speeder is a private, client-side batch audio processor for desktop Chromium browsers. Select a folder, choose a speed, and write sped-up copies beneath `_sped-up` without uploading the source files anywhere.

The processing engine is FFmpeg compiled to WebAssembly. Supported v1 extensions are MP3, WAV, FLAC, OGG, Opus, M4A, and AAC.

## Requirements

- Node.js 20 or newer
- A current desktop version of Chrome, Edge, Brave, or another Chromium browser
- HTTPS in production (`localhost` is accepted for development)

## Development

```sh
npm install
npm run dev
```

The first processing run loads the self-hosted FFmpeg WASM core. Audio work is single-threaded and sequential to remain compatible with static GitHub Pages hosting.

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Install Playwright's Chromium binary once before the end-to-end suite:

```sh
npx playwright install chromium
```

## Processing behavior

- Files are discovered recursively; the root `_sped-up` directory is excluded.
- Files larger than 500 MB are shown as skipped.
- Output directories mirror the input tree.
- Output names include the selected speed and pitch mode, for example `chapter__1.50x-preserve-pitch.mp3`.
- Existing target files are never overwritten until the user explicitly confirms the conflict dialog.
- Only the first audio stream is processed. Text metadata is copied when the output container supports it. Attached artwork is attempted for MP3, FLAC, and M4A and retried without artwork if necessary.
- Cancelling stops the current worker. Outputs completed earlier in the batch remain on disk.

“Preserve format” means re-encoding into the same container/extension; compressed bytes and every codec-private setting cannot be retained after changing tempo.

## Privacy and limitations

Audio and metadata stay in the browser. The app has no backend, analytics, or runtime CDN dependency. Folder access is granted only through the browser's native picker.

FFmpeg WASM is substantially slower than native FFmpeg and holds each active file in browser memory. The app therefore enforces a 500 MB per-file limit and processes one file at a time. Closing the tab stops processing.

## GitHub Pages

Pushes to `main` run the checks and deploy the static `dist` artifact through GitHub Actions. Configure the repository's Pages source as **GitHub Actions**. The workflow builds with `/wasm-voice-speeder/` as the base path.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for bundled software notices.
