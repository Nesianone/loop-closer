# Loop Closer

A personal PWA that makes switching harder than finishing, and keeps an honest record of what you actually complete — instead of letting projects quietly die near the finish line.

## Run locally

No build step. Serve the folder with any static file server (a service worker requires http(s), not `file://`):

    npx serve .

or

    python -m http.server 8000

Open the printed URL, then use your browser's "Add to Home Screen" / "Install" option to install it as an app.

**If you edit the code and your changes don't show up**, the service worker's cache-first strategy is serving the old files. In devtools, go to Application → Service Workers → Unregister, then Application → Storage → Clear site data, and reload.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo's Settings → Pages, set the source to the `main` branch, root folder.
3. GitHub publishes at `https://<username>.github.io/<repo>/`. Open that URL on your phone and "Add to Home Screen".
4. Every future push to `main` redeploys automatically — nothing to build.

## Data & backups

All data lives in your browser's `localStorage` on whichever device/browser you use — it does not sync between devices. Use Settings → "Export JSON backup" periodically, and "Import JSON backup" to restore or move to a new device.

## Phase 2 (explicitly out of scope for v1)

- Sending weekly digests to another person
- Temptation bundling
- Blocking access to external course sites
- Points/badges/gamification beyond the streak count
- Multi-user support, cloud sync, or accounts
