# Send It — self-contained Windows app

The Windows 64-bit desktop app packages the existing Berlin acceptance game with its own Electron/Chromium runtime. It serves bundled files from `sendit://app` inside the process. There is no localhost server, open listening port, map API key, account or runtime download.

## Play

- **Folder portable · recommended:** right-click `Send-It-0.23.0-Windows-Portable-Folder.zip`, choose **Extract All**, then open **Send It.exe** inside the extracted folder. Keep the whole folder together. Extraction happens once; later launches open the bundled runtime directly. Do not run the executable from inside the ZIP preview.
- **Installed:** run `Send-It-0.23.0-Windows-Setup.exe`, choose a location, then open **Send It** from Start or its desktop shortcut. Installation also keeps the runtime ready for later launches. The installer is per-user and does not require elevation.
- **Single-file portable · optional:** double-click `Send-It-0.23.0-Windows-Portable.exe`. This convenience format expands the entire runtime to a temporary directory **on every launch**, before the game can display a window. Use the ZIP or installer if this wait is noticeable.
- Choose a locality and shift length, then Prepare shift. Select a job, click a broadcast once to preview and again to confirm, then start the clock at the top. Couriers make their own decisions. See [the unified desk guide](UNIFIED_DESK.md).
- Enable sound to hear **Spokes & Postcards**, or use **Menu → Sound & music** for rider/rhythm previews and mix controls. Everything is playable while muted.
- The app includes full Berlin, the original Inner Ring, all 926 building-detail tiles, bike icons and the synthesized score. Close-up detail still uses a bounded cache, reading files from the app package.

## Saves and app controls

Shifts are stored under `%APPDATA%\Send It Berlin`. All three downloads use that persistent profile; switching from the single-file EXE to the extracted folder or installed app preserves the existing saves. Neither the ZIP's folder nor the portable executable's temporary extraction directory holds your saves. This profile is separate from the browser version's saved data.

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

`app:windows` creates the folder-portable ZIP, portable executable and installer in `dist`. `app:pack` creates the unpacked self-contained app for faster iteration. Build tools and the initial Electron binary download require internet on the developer machine; users receive the complete runtime in every download. Dependency versions and integrity hashes are locked in `package-lock.json`.

The packaged About dialog identifies the source commit. `desktop/build.json` also records whether the checkout contained changes during packaging. A build from an extracted source archive identifies itself as `source-archive` if Git metadata is absent.

The app icon is the repository's orange-and-ink arrow mark. Its editable SVG and generated PNG/ICO are in `desktop`; `tools/render-app-icon.py` regenerates the raster sizes with Playwright/Chromium and Pillow. Those tools are optional for normal builds.

## Validation and distribution status

The `Test` workflow includes a Windows job that builds all three formats and exercises the packaged runtime with DNS resolution blocked, then puts its browser context offline. Acceptance covers full-city loading, bundled building detail, bike types, rider resources, satisfaction ranges and last-tour timing, two-click preview and confirmation, personal invitations, sound previews and mute, client negotiations, a real autonomous delivery, closing/relaunching, exact save restoration, minimize/pause, source-page navigation and local export. It also checks that the renderer has no Node API, that the native window is visible while the desk prepares, and that gameplay makes no external HTTP requests. Screenshots, launch observations and results accompany the Windows artifacts.

The existing game and browser regression suites remain separate. Native packaging does not establish player enjoyment or physical-phone acceptance and does not alter rider assignment authority.

## Startup diagnosis and measurement

The 0.22 single-file portable was measured on a Windows laptop with 7,456 MiB usable RAM. A fresh test profile was used for each run. The exact same app directory was copied from the portable's temporary extraction and then launched directly, without rebuilding its code:

| Observed launch | Actual Electron process | Debug endpoint | Playable setup |
| --- | ---: | ---: | ---: |
| Self-extracting 0.22 EXE | 41.13 s | 41.90 s | 50.14 s |
| Same 0.22 runtime, already extracted | 0.33 s | 1.13 s | 9.40 s |

The app/map portion after Electron started was approximately nine seconds in both observations. Most of the extra wait occurred before Electron existed, while the launcher expanded the app. These are individual measurements in that order, with 558–714 MiB free RAM at launch; they are not a cold-cache benchmark, a cross-device promise, or a measurement of the final 0.23 release. The recommended ZIP removes that repeated extraction step. The native window now appears immediately after creation and the game's existing loading screen explains Berlin preparation.

For a bounded measurement of an exact artifact:

```powershell
node desktop/startup-benchmark.mjs --exe "dist/win-unpacked/Send It.exe" --report reports/startup-direct.json
node desktop/startup-benchmark.mjs --exe "dist/Send-It-0.23.0-Windows-Portable.exe" --report reports/startup-portable.json --timeout-ms 180000
```

This opt-in developer tool uses a separate temporary profile, blocks external DNS, records native process timing and renderer preparation marks, then requests a normal window close and verifies native process exit. Its debugging port is used only by this test, never by a normal launch. It does not read or change player saves. A startup or close timeout leaves its own launcher/profile intact for diagnosis without keeping the measurement script running indefinitely; reports cannot overwrite earlier results. Native process identity is tied to this test's endpoint, launcher ancestry and unique profile. Optional `--copy-unpacked reports/startup-copy` preserves the self-extractor's exact app directory for a direct comparison; the destination must not exist. Wait for one launch to finish before starting another, especially on a memory-constrained host.

These acceptance builds are **unsigned**. An earlier development Electron runtime was blocked by this PC's Device Guard policy; the packaged 0.14 portable app subsequently launched normally. Verify each exact packaged build separately. GitHub's Windows-runner results must be reported separately; they do not prove this PC will allow the executable. Distribution to a policy-managed device requires a publisher signature or an application allowance accepted by that device's administrator. The app does not change Windows security policy.

Implementation follows Electron's [custom protocol API](https://www.electronjs.org/docs/latest/api/protocol/) and [renderer isolation guidance](https://www.electronjs.org/docs/latest/tutorial/security), with electron-builder's [Windows packaging targets](https://www.electron.build/v26/docs/win/). The game renderer is sandboxed, has no Node integration, and can fetch only its bundled origin. Native code handles app lifecycle, menus and normal file downloads.
