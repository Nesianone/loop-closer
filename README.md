# Loop Closer

A personal PWA that makes switching harder than finishing, and keeps an honest record of what you actually complete — instead of letting projects quietly die near the finish line.

New to the app? Read the [User Guide](guide.html) — once deployed, it's at `https://<username>.github.io/<repo>/guide.html`.

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
5. **Important:** every time you deploy a real change, bump the `CACHE_NAME` version string at the top of `service-worker.js` (e.g. `loopcloser-v2` → `loopcloser-v3`). The service worker only checks for updates when its own file content changes — if `CACHE_NAME` stays the same, phones that already installed the app will keep serving the old cached files forever, no matter how many times the page is refreshed. Bumping it forces every device to fetch the new version on next load. Even after bumping it, an already-installed phone may need to fully close and reopen the app (not just refresh the tab) to pick up the new service worker.

## Data & backups

All data lives in your browser's `localStorage` on whichever device/browser you use — it does not sync between devices. Use Settings → "Export JSON backup" periodically, and "Import JSON backup" to restore or move to a new device.

## Current version and recent fixes (v4, 2026-10-04)

The version is shown at the bottom of the onboarding screen and Settings. If your phone shows an older number, it hasn't picked up the latest deploy.

- **Onboarding trap fixed.** If an earlier onboarding was interrupted after an Active loop was saved, onboarding used to re-run with "Set Active" permanently disabled and no explanation. The app now treats onboarding as complete when loops already exist.
- **Onboarding progress is saved** after every step and resumes if the app is closed.
- **Blocked actions explain themselves.** "Set Active" stays tappable and shows why it's blocked (e.g. "You already have an active loop: X") instead of silently doing nothing.
- **Service worker is network-first**, so fixes reach installed phones without clearing site data. The old cache-first behaviour is what kept stale code on phones.

**Open item:** v4 is committed locally but still needs `git push` (or pasting the changed files into the GitHub web editor) before the live site updates.

## Phase 2 (explicitly out of scope for v1)

- Sending weekly digests to another person
- Temptation bundling
- Blocking access to external course sites
- Points/badges/gamification beyond the streak count
- Multi-user support, cloud sync, or accounts
