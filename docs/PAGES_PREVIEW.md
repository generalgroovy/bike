# GitHub Pages preview

The released game is published at <https://generalgroovy.github.io/bike/>.
The current tested Berlin branch has a separate preview:

- Preview entry: <https://generalgroovy.github.io/bike/preview/>
- Simplified desk: <https://generalgroovy.github.io/bike/preview/berlin/playtest.html>
- Full game on the preview branch: <https://generalgroovy.github.io/bike/preview/berlin/>
- Published source identity: <https://generalgroovy.github.io/bike/preview/berlin/build.json>

The repository Pages source is GitHub Actions. `Deploy GitHub Pages` runs
from `main` and builds one artifact containing released application files
at the root and `feature/berlin-playtest` application files below
`preview/berlin/`. Neither the feature implementation nor its generated
copy is merged into the released game sources.

After a successful push-triggered `Test` workflow on the playtest branch,
the deployment workflow publishes the exact tested source SHA. Only runs
from this repository and that branch qualify. A main push or manual run
checks out the latest preview branch and runs its Node and both Chromium
suites before publishing. Failed tests prevent deployment.

To refresh manually, use Actions > Deploy GitHub Pages > Run workflow on
`main`, or `gh workflow run pages.yml --ref main`. The existing
`github-pages` environment continues to allow deployments from main.

`tools/build-pages.mjs` copies tracked application files only. It excludes
Git metadata, workflows, tests, reports and local configuration. Its output
must be a new or empty directory outside both checkouts. `build.json`
records both source commits for hosted verification.

The preview root and its two application entries should be checked after
deployment. Compare `build.json` with the tested commit and verify radio,
first delivery, pause, and canvas behavior on the hosted URL.
