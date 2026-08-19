# Validation notes

The Berlin radio-dispatch redesign was validated locally before merge with:

- `node --test` — 9/9 tests passing
- syntax checks for `src/game.js`, `src/main.js`, `src/render.js`, and `src/berlin.js`
- multi-seed full-network routing tests
- 40 seeded six-minute simulation smoke runs
- static HTTP load smoke test

The test suite specifically guards the indirect-dispatch rule by asserting that the direct `assign` API is absent and that an idle rider autonomously claims a called job.
