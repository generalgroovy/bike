# Send It — self-contained Windows app

The Windows 64-bit desktop app packages the existing Berlin acceptance game with its own Electron/Chromium runtime. It serves bundled files from `sendit://app` inside the process. There is no localhost server, open listening port, map API key, account or runtime download.

## Play

- **Portable:** double-click `Send-It-0.14.0-Windows-Portable.exe`. It extracts its bundled runtime to a temporary directory and opens the desk.
- **Installed:** run `Send-It-0.14.0-Windows-Setup.exe`, choose a location, then open **Send It** from Start or its desktop shortcut. The installer is per-user and does not require elevation.
- Choose a locality and a guided or standard shift. Broadcast an offer, then start time. Couriers make their own decisions.
- Enable sound to hear **Spokes & Postcards**, or use **Sound & music** for rider/rhythm previews and mix controls. Everything is playable while muted.
- The app includes full Berlin, the original Inner Ring, all 926 building-detail tiles, courier portraits and the synthesized score. Close-up detail still uses a bounded cache, reading files from the app package.

## Saves and app controls

Shifts are stored under `%APPDATA%\Send It Berlin`. Both formats use that persistent profile; the portable executable's temporary extraction directory does not hold your saves. This profile is separate from the browser version's saved data.

The app pauses and saves on close, minimize, loss of focus or system suspend. Relaunch and choose **Resume saved shift** to return paused. **Desk → Pause and save** also supports Ctrl+S. **Desk → Saved data folder** opens the profile location; **View → Toggle Full Screen** uses the native fullscreen shortcut. The review's download button exports a JSON shift record to a normal file using the Windows save dialog.

**Help → Map sources · offline** opens the bundled provenance page in another app window. External source links open the system browser only when clicked and need internet. Map data and gameplay do not need those sites to be reachable.

The installer preserves saved data when uninstalled. Updating the app does not change a recorded shift's ruleset: earlier supported replays continue to use their recorded behavior.

## Build from source

Use Node 24 and a clean checkout on Windows:

```powershell
npm.cmd ci
npm.cmd run app:start
npm.cmd run app:windows
node desktop/smoke.mjs "dist/win-unpacked/Send It.exe"
```

`app:windows` creates the portable executable and installer in `dist`. `app:pack` creates the unpacked self-contained app for faster iteration. Build tools and the initial Electron binary download require internet on the developer machine; users receive the complete runtime in the resulting executables. Dependency versions and integrity hashes are locked in `package-lock.json`.

The packaged About dialog identifies the source commit. `desktop/build.json` also records whether the checkout contained changes during packaging. A build from an extracted source archive identifies itself as `source-archive` if Git metadata is absent.

The app icon is the repository's orange-and-ink arrow mark. Its editable SVG and generated PNG/ICO are in `desktop`; `tools/render-app-icon.py` regenerates the raster sizes with Playwright/Chromium and Pillow. Those tools are optional for normal builds.

## Validation and distribution status

The `Test` workflow now includes a Windows job that builds both formats and exercises the packaged runtime with DNS resolution blocked, then puts its browser context offline. Acceptance covers full-city loading, bundled building detail, portraits, sound previews and mute, client negotiations, a real autonomous delivery, closing/relaunching, exact save restoration, minimize/pause, source-page navigation and local export. It also checks that the renderer has no Node API and that gameplay makes no external HTTP requests. Screenshots and results accompany the Windows artifacts.

The existing game and browser regression suites remain separate. Native packaging does not establish player enjoyment or physical-phone acceptance and does not alter rider assignment authority.

These acceptance builds are **unsigned**. This development PC's Device Guard policy blocked the downloaded Electron runtime before the app could launch, so local native acceptance is unavailable under that policy. GitHub's Windows-runner results must be reported separately; they do not prove this PC will allow the executable. Distribution to a policy-managed device requires a publisher signature or an application allowance accepted by that device's administrator. The app does not change Windows security policy.

Implementation follows Electron's [custom protocol API](https://www.electronjs.org/docs/latest/api/protocol/) and [renderer isolation guidance](https://www.electronjs.org/docs/latest/tutorial/security), with electron-builder's [Windows packaging targets](https://www.electron.build/v26/docs/win/). The game renderer is sandboxed, has no Node integration, and can fetch only its bundled origin. Native code handles app lifecycle, menus and normal file downloads.
