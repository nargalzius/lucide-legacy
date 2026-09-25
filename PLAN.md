# PLAN — lucide-legacy: maintain a fork of the deprecated `lucide-vue` package, kept in sync with new Lucide icon data

Work strictly in this order. Phases are grouped; task numbers are global.

## Background (read first)

The npm package `lucide-vue` (Vue 2, last release 0.517.0) is deprecated upstream
— Lucide removed the Vue 2 package from the monorepo at commit `7bbb1e1` (last
source at parent commit `1d6b5d6`). This repo becomes a maintained fork: same
package name, same engine, but icon data auto-regenerated from current Lucide
releases, so consumers can install it (via git URL / pnpm override / file:) and
import icons exactly as before, plus get new icons each sync.

**Why it works:** a Lucide icon is just data — a name plus an array of SVG nodes
`[["path", {d: "…"}], …]`. The deprecated `lucide-vue` was a thin engine
(Vue 2 functional-component factory `createLucideIcon`) over that data. The
engine never changed; only the data did. Freeze the engine, regenerate the data.

**Verified facts (checked 2026-09-25 — re-verify if sources moved):**

- `lucide-vue@0.517.0` is deprecated but still installable on npm. Published
  shape: `main: dist/cjs/lucide-vue.js`, `module: dist/esm/lucide-vue.js`,
  `unpkg: dist/umd/lucide-vue.min.js`, `files: ["dist", "nuxt.js"]`,
  `sideEffects: false`, `peerDependencies: { vue: "^2.6.12" }`.
- Per-icon published file format (`dist/esm/icons/activity.js`):
  `import createLucideIcon from '../createLucideIcon.js';` then
  `const Activity = createLucideIcon("ActivityIcon", [ /* node array */ ]);`
  then `export { Activity as default };`. Entry `lucide-vue.js` re-exports
  icons + aliases and adds `export * as icons from './icons/index.js'`.
- Engine source: monorepo `lucide-icons/lucide` @
  `1d6b5d68581cd90589e51cc326837c3bad9fed44`, path `packages/lucide-vue/` —
  files `src/createLucideIcon.ts`, `src/defaultAttributes.ts`, `nuxt.js`.
  (Full `createLucideIcon.ts` was already read during planning; re-fetch via
  `git show 1d6b5d6:packages/lucide-vue/src/createLucideIcon.ts` from a
  sparse clone of `lucide-icons/lucide`.)
- Icon data source (primary): `lucide-static@<v>` npm tarball →
  `icon-nodes.json` = `{ "kebab-name": [["tag", {attrs}], …] }` — the **exact**
  node-array format the engine consumes, no transformation needed. Also ships
  `icons/*.svg` and `tags.json`.
- Alias source: `lucide@<v>` npm tarball → `dist/esm/iconsAndAliases.mjs` —
  lines of the form `export { default as AlarmCheck, default as
  AlarmClockCheck } from './icons/alarm-clock-check.mjs';` (regex-parseable;
  first name is primary, rest are aliases).
- Fallback source (only if npm tarball shapes change): GitHub raw
  `lucide-icons/lucide` main → `icons/*.json` (fields incl. `aliases`) +
  `icons/*.svg`.
- Current upstream version at planning time: lucide / lucide-static `1.48.0`
  (1854 icons). Always query the registry for `latest` at sync time.

**Repo state at start:** remote `git@github.com:nargalzius/lucide-legacy.git`,
files `IDEA.md`, `PLAN.md`, `PROGRESS.md` (commit state per PROGRESS.md journal).

---

## Phase 0 — Bootstrap the engine and package (tasks 1–3)

Context: freeze the old engine verbatim (minus the deprecation warning and the
`@lucide/shared` import) so the public component API stays compatible with
0.517.0: functional Vue 2 component, props
`color/size/strokeWidth/absoluteStrokeWidth/defaultClass`, class
`lucide-icon lucide lucide-<kebab>`, 24×24 default, stroke-width math,
attrs/style passthrough.

### Task 1: Initial git commit of planning files
Goal: commit `IDEA.md`, `PLAN.md`, `PROGRESS.md` to `main` as the first commit
of the repo (message: `docs: add plan and progress tracker`).
Completion criteria: `git log --oneline` shows exactly one commit containing
those three files; working tree clean.

### Task 2: Copy and adapt the engine into `src/`
Goal: create `src/createLucideIcon.js` (from
`1d6b5d6:packages/lucide-vue/src/createLucideIcon.ts`, types stripped),
`src/defaultAttributes.js` (same source), and copy `nuxt.js` to the repo root
— all from the upstream monorepo commit `1d6b5d6`, path
`packages/lucide-vue/`. Modifications, and only these:
1. Strip TypeScript types (plain JS, no build step for the engine).
2. Remove the `showDeprecationWarning` console.warn block entirely.
3. Replace `import { toKebabCase } from '@lucide/shared'` with an in-file
   implementation: `s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()`.
4. Keep the exported factory signature and the render function identical in
   behavior to the original.
Completion criteria: `src/createLucideIcon.js` and `src/defaultAttributes.js`
exist, are plain importable JS, contain no `@lucide` imports and no
deprecation warning; `nuxt.js` at repo root matches upstream; a quick dynamic
import of `src/createLucideIcon.js` succeeds and the default export is a
function (record whether the engine source ships as ESM or CJS in
PROGRESS.md).

### Task 3: Write `package.json`, `LICENSE`, `README.md`
Goal: author the package manifest and docs skeleton:
- `package.json`: `name: "lucide-vue"`, `version: "1.48.0-legacy.1"`,
  description mentioning the maintained legacy fork, `license: "ISC"`,
  `main: "dist/cjs/lucide-vue.js"`, `module: "dist/esm/lucide-vue.js"`,
  `unpkg: "dist/umd/lucide-vue.min.js"`, `types: "dist/types/lucide-vue.d.ts"`,
  `sideEffects: false`, `files: ["dist", "nuxt.js"]`,
  `peerDependencies: { "vue": "^2.6.12" }`, scripts:
  `"sync": "node scripts/sync.mjs && node scripts/build.mjs"`,
  `"prepare": "node scripts/sync.mjs --offline-ok && node scripts/build.mjs"`,
  `"test": "node --test tests/"`, repository/bugs/homepage pointing at
  `nargalzius/lucide-legacy` / lucide.dev.
- `LICENSE`: ISC, Lucide copyright (copy from a `lucide-static` tarball or the
  monorepo LICENSE).
- `README.md`: what this is, why it exists, install options (npm git URL,
  pnpm overrides, yarn resolutions, file:), usage example identical to
  0.517.0 usage, `npm run sync` instructions, deprecation-safety note
  (community-maintained legacy fork, Vue 2 only).
Completion criteria: `node -e "require('./package.json')"` parses; the README
contains all install options and the usage example.

## Phase 1 — Sync script (tasks 4–5)

Context: `scripts/sync.mjs` is pure Node ≥ 18, **zero runtime dependencies**
(no transpilers, no build tools). It makes the repo reproducible: running it
with a given lucide version yields identical generated output.

### Task 4: Implement `scripts/sync.mjs`
Goal: script that (default: latest) syncs icon data for a given lucide version
(`--version X.Y.Z`):
1. Resolve version: `--version` arg, else fetch
   `https://registry.npmjs.org/lucide-static` and use `dist-tags.latest`
   (assert `lucide` has the same version).
2. Download `lucide-static-<v>.tgz` and `lucide-<v>.tgz` from
   `https://registry.npmjs.org/` into `node_modules/.cache/lucide-legacy/`.
   Support `--offline`/`--offline-ok` using an existing cache (for the
   `prepare` hook, where network may be absent — then keep the committed
   `src/` + `dist/` unchanged and exit 0).
3. Parse `icon-nodes.json` (kebab → nodes) from lucide-static, and
   `dist/esm/iconsAndAliases.mjs` from lucide with the regex
   `/export\s*\{\s*([^}]+)\}\s*from\s*'\.\/icons\/([a-z0-9-]+)\.mjs'/g` →
   per icon: list of exported PascalCase names (first = primary).
4. Validate: every node array non-empty; every node is `[tag, attrs]` with
   tag in `path|circle|rect|line|polyline|polygon|ellipse|g`; every alias
   target exists. On failure: print a diff summary and exit non-zero.
5. Delta report vs existing `src/icons/`: added / removed / unchanged counts.
   **Removed icons stay** (they remain in `src/icons/` with a
   `/* deprecated upstream */` header comment) — deleting a previously-shipped
   icon breaks consumer builds.
6. Regenerate `src/icons/<kebab>.js` per icon in the exact 0.517.0 published
   shape: `import createLucideIcon from '../createLucideIcon.js';` +
   `const <Pascal> = createLucideIcon('<Pascal>Icon', <nodes JSON>);` +
   `export { <Pascal> as default };` (drop upstream's decorative `key`
   attribute if present).
7. Regenerate `src/aliases.js` (`export { default as <Alias>, default as
   <Primary> } from './icons/<kebab>.js';` for every icon with extra export
   names) and `src/icons/index.js` (re-export every icon under its primary
   PascalCase name, sorted).
8. Update `package.json` `version` to `<v>-legacy.1` (bump `-legacy.N` only on
   engine changes) and write a `sync-meta.json` at repo root:
   `{ "lucideVersion": "<v>", "syncedAt": "<iso>", "icons": <n>, "added": <n>, "removed": <n> }`.
9. `--dry-run` prints the delta without writing anything.
Completion criteria: `node scripts/sync.mjs --dry-run` prints a sane delta
against the current `src/icons/` (empty at first run: it should list ~1854
added); `node scripts/sync.mjs` (or `--version 1.48.0`) then writes
`src/icons/` (~1854 files), `src/aliases.js`, `src/icons/index.js`,
`sync-meta.json`; spot-check `src/icons/activity.js` matches the 0.517.0
published shape (node data may differ from 0.517.0 — that's the point).

### Task 5: Verify sync correctness against the real npm package
Goal: prove the generated data is faithful: unpack `lucide-vue@0.517.0`
(`npm pack lucide-vue@0.517.0`) into a scratch dir and run a comparison:
- every icon kebab-name in 0.517.0's `dist/esm/icons/` must exist in the
  generated `src/icons/` (superset check: generated may add icons, never
  drop);
- for 20 common icons (e.g. activity, home, settings, x, check,
  alert-triangle), compare node arrays: identical shape; record which differ
  (path updates are expected and fine — report, don't fail);
- alias exports of 0.517.0's entry (grep the `export { default as X, default
  as Y }` lines in `dist/esm/lucide-vue.js`) must all be present in the new
  `src/aliases.js` or as primary exports in `src/icons/index.js`.
Completion criteria: comparison script (save it as `scripts/verify-parity.mjs`
for reuse) exits 0 with a printed report; no missing icons/aliases.

## Phase 2 — Build script and out-of-the-box dist (tasks 6–8)

Context: no rollup — emit the published formats directly from `src/` with a
plain Node script, so the repo has zero build dependencies.

### Task 6: Implement `scripts/build.mjs`
Goal: from `src/`, produce:
- `dist/esm/…`: mirror of `src/` (per-file modules → tree-shaking), entry
  `dist/esm/lucide-vue.js` = `export * from './icons'; export * as icons
  from './icons'; export * from './aliases';` with import specifiers intact.
- `dist/cjs/lucide-vue.js`: single-file CJS bundle (engine inlined + all
  icons + aliases), `module.exports` with every PascalCase export + `icons`
  namespace.
- `dist/umd/lucide-vue.js` and `dist/umd/lucide-vue.min.js`: UMD wrapper,
  `vue` external → global `Vue`, global name `LucideVue`; minified with a
  tiny local minifier or a devDependency (record the choice).
- `dist/types/lucide-vue.d.ts`: `declare const <Pascal>: import('vue').
  FunctionalComponentOptions;` for every icon + alias, plus `icons` namespace.
- Clean `dist/` before emitting; support a `--clean`-only flag.
Completion criteria: `node scripts/build.mjs` produces all five artifacts;
`node -e "const l=require('./dist/cjs/lucide-vue.js'); console.log(Object.keys(l).length, typeof l.Activity)"`
shows >1800 keys and `object` (functional component options).

### Task 7: End-to-end smoke test with real Vue 2
Goal: `tests/smoke.mjs` (node:test) using devDependencies `vue@2.7.14` and
`vue-server-renderer@2.7.14` (test-only, declared in `devDependencies`):
1. Load `dist/cjs/lucide-vue.js` (CJS) and `dist/esm/lucide-vue.js` (dynamic
   import) — both must expose the same export-name set.
2. Render `Activity` and one alias (e.g. `AlarmCheck`) with
   `vue-server-renderer`'s `renderToString`; assert the output contains
   `<svg`, class `lucide-activity`, and a `<path d="` with non-empty d.
3. Assert no duplicate export names in the entry.
4. Assert `size`/`color` props affect output (size=48 → `width="48"`).
Completion criteria: `npm test` passes with all four assertions; record the
actual test output in PROGRESS.md.

### Task 8: Commit generated output and tag
Goal: commit `src/icons/`, `src/aliases.js`, `src/icons/index.js`, `dist/`,
`sync-meta.json` to git (generated files **are** committed — so plain git-URL
installs work with no network at install time); create tag
`v1.48.0-legacy.1`.
Completion criteria: `git show --stat HEAD` includes the generated dirs;
`git tag -l` shows the tag; working tree clean.

## Phase 3 — Consumer install path (tasks 9–10)

Context: the goal is "people who want to use this version could just install
like normal and have it work out of the box."

### Task 9: Verify install-from-git works end to end
Goal: prove a fresh consumer can install and render: in a scratch dir (not
the repo), init a minimal package,
`npm install <git URL or local path of the repo>` — for a fully local test
use `npm pack` + `npm install ./<tarball>` first, then (if push is possible/
allowed) the real git URL:
`npm install git+ssh://git@github.com/nargalzius/lucide-legacy.git`.
Assert: install succeeds (watch what `prepare` does — it must succeed offline
or be a no-op via `--offline-ok`), `require('lucide-vue')` works, and
renderToString on `Activity` yields the expected SVG.
Completion criteria: a written-up verification (command + actual output)
appended to PROGRESS.md; install and render both succeed. If the git-URL
install is not yet possible (no push access), verify via `npm pack` + local
install and mark the git-URL check as "pending push" in Notes.

### Task 10: Finish README with the verified install recipes
Goal: update `README.md` so each install option is the *verified* command
with the *actual* output snippet: npm git URL, `npm install <path.tgz>`,
pnpm `overrides`, yarn `resolutions`, `file:`. Include a short
"keep up to date" section (`npm run sync`, what the delta report looks like)
and a troubleshooting note (peer dep vue ^2.6.12; this is Vue 2 only — Vue 3
users should use `lucide` directly).
Completion criteria: every command in the README was actually run at least
once; README committed.

## Phase 4 — Ongoing maintenance (tasks 11–12)

Context: make future syncs a one-liner now and a PR later.

### Task 11: Smoke-test CI + sync workflow
Goal:
- `.github/workflows/ci.yml`: on push/PR — `npm install`, `npm test`,
  `node scripts/verify-parity.mjs` (offline mode if it supports one).
- `.github/workflows/sync.yml`: `workflow_dispatch` + weekly `schedule` →
  `npm run sync`, if git diff is non-empty open a PR
  `chore: sync icons to lucide <v>` with the delta report in the body.
(If the repo has no GitHub Actions permissions yet, write the files anyway
and mark "pending first push" in Notes.)
Completion criteria: both YAML files exist and parse (validate with a YAML
parser available via node or npx); if Actions can't be verified yet, that is
recorded in Notes rather than assumed.

### Task 12: Final handover
Goal: set PROGRESS.md stage to Complete; write a final summary in PROGRESS.md
Notes: repo state, how to sync next time (exact commands), known caveats
(e.g. anything marked pending), and resolve the original open questions from
the journal.
Completion criteria: PROGRESS.md stage line is `Complete (<date>)`; the
summary section contains the sync recipe and caveats.

---

## Pitfalls / decisions (binding)

- Package name stays `lucide-vue` (drop-in); version scheme
  `<lucide-version>-legacy.N`; N bumps only on engine changes.
- Do NOT publish to the npm registry under that name (name is live/deprecated
  there). Consumers use git URL / overrides / file:.
- Keep all previously-shipped icons even when upstream deletes them
  (breaking-change safety); upstream deletions are marked, not removed.
- Zero runtime dependencies in the repo; devDependencies limited to what the
  smoke test / CI needs (vue 2.7, vue-server-renderer, maybe a YAML parser).
- The engine (`src/createLucideIcon.js`) is sacred: any change requires a
  `-legacy.N` bump and a re-run of Task 7's tests.
- `PROGRESS.md` is the single source of truth for stage — the master
  executor updates it, slaves never do.
