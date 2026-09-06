# SEND IT v13 — continuation checkpoint

This is a **draft development branch**, not the deployed v0.12 release. The invariant remains **YOU CONTROL INFORMATION, NOT RIDERS**. No simulation, RNG, radio-choice, route-authority, cargo, progression or rider-autonomy module was changed by this continuation.

## Native interaction slice

- The normal HTML entry point no longer imports the historical Google bridge, its stylesheet or map host. Stored Google preferences cannot activate it or prompt for a key. Historical v12 integration sources remain for reference; they are not a supported v13 map switch.
- The native source badge distinguishes loading, validated local detail and the bundled curated fallback. The **official generated Berlin asset is still absent** at this checkpoint. Do not describe the visible fallback as an official street network.
- Runtime decoding rejects malformed quantization, geometry, names/classes, bounds, LOD indices and spatial bins before drawing. Queries handle invalid/extreme viewports without an unbounded grid walk. Loading is cancelable and has an eight-second request timeout.
- New shifts dispose the old renderer. Late asynchronous responses cannot paint the old game or overwrite the new map-source badge.
- The contract inspector accepts multiple cargo-icon CSS classes without the previous DOM token exception. Cargo icons and rider portraits have bounded dimensions in comfortable and compact layouts.
- Distance, difficulty and cargo have separate visual labels. Signed **ride margin** retains negative deficits. It is an estimate for the loaded ride only, not end-to-end rider feasibility: pickup travel, pickup waits and breaks are excluded. Dispatch Insight remains the rider-specific projection.
- Forecast events no longer count as active road exposure in route assessment. Estimated ride time observes existing speed/experience modifiers; overdue margins retain elapsed lateness.
- Native `+`/`-` keyboard zoom now works alongside wheel, drag and `0`/FIT. Main keyboard controls ignore editable targets, modifiers and held-key repeats.

## Validation

The imported baseline passed **204 Node tests**. This continuation passes **233 Node tests locally** (Node 22.16.0); CI uses Node 24. New tests exercise decoder failures, query safety, load cancellation/timeouts, retired-renderer responses, cargo DOM class handling, signed margins and presentation-only assessment changes.

`e2e/browser_smoke.py` supplies eight real Chromium acceptance scenarios: native startup with stale Google preferences, the inspector and all ten cargo types, radio pointer actions without forced claims, keyboard zoom/focus, map wheel/drag, responsive rails/density/focus, new-shift disposal and corrupt-asset fallback. It records screenshots and browser error/network evidence. It blocks third-party requests instead of relying on Google or another service.

The CI preview artifact is gated on **both** Node tests and browser acceptance. A failed browser job must not be mistaken for release acceptance, even when source-contract tests pass.

```sh
npm test
python -m pip install playwright==1.57.0
python -m playwright install chromium
python e2e/browser_smoke.py
```

The browser suite starts and stops its own local HTTP server. Browser/test tooling is development-only; the game has no new runtime package dependency. Reports are in `reports/browser/` and the CI `send-it-browser-evidence` artifact.

## Remaining release gates

1. Produce and inspect the official static Berlin snapshot, record its provenance/size and verify its projection against the curated simulation overlay. Native rendering readiness is not routing-authority approval.
2. Finish the broader CSS consolidation and visual review. The new v13 component stylesheet bounds icons/readouts, but does not remove all older override layers.
3. Measure representative 1x/2x/4x shifts with 10–20 concurrent contracts, pan/zoom, background-tab recovery and sound. Smoke tests are not a performance benchmark or human-playtest substitute.
4. Review route-assessment balance and label legibility, and update release-wide documentation before promoting or merging PR #16.

Do not merge solely because the incremental tests pass. `main` and the live GitHub Pages game remain unchanged by this checkpoint.
