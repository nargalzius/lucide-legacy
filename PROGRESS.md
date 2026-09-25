# PROGRESS

Current stage: Phase 2 — task 8 of 12 — dispatching Task 8 (7 of 12 tasks done)

## Phase 0 — Bootstrap the engine and package (tasks 1–3)
- [x] Task 1 — Initial git commit `0100715` "docs: add plan and progress tracker" (4 planning files, clean tree) (2026-09-25)
- [x] Task 2 — Engine frozen at `src/createLucideIcon.js` + `src/defaultAttributes.js` (plain ESM, types stripped, deprecation warn + `@lucide/shared` import removed/inlined, verified 1:1 vs upstream `1d6b5d6`; import check → function, functional:true); `nuxt.js` byte-identical to upstream. Engine ships as ESM. (2026-09-25)
- [x] Task 3 — `package.json` (exact keys, NO `type` field — CJS default per orchestrator decision; parses OK), `LICENSE` (ISC, Lucide/Bemis copyright, byte-for-byte from upstream `1d6b5d6`), `README.md` (all 6 sections, all 5 install options marked `verified: pending`, 0.517.0-shape usage). (2026-09-25)

## Phase 1 — Sync script (tasks 4–5)
- [x] Task 4 — `scripts/sync.mjs` (1079 lines, zero deps: node: builtins + fetch + system `tar` via execFileSync). Real run `--version 1.48.0`: wrote 1872 `src/icons/*.js` (1854 live + 18 seeded), `src/icons/index.js` (1872 unique primaries, 0 dups), `src/aliases.js` (2132 unique names, 0 dups; union 2132 — no dup export names; every index name ⊆ aliases names), `scripts/seed-icons.json` (18), `sync-meta.json` (icons:1872, added:1872, removed:0), `package.json` version → `1.48.0-legacy.1` (no type field). Zero `key:` attrs repo-wide; seeded files carry `/* deprecated upstream */`; reproducibility verified (re-run: added 0 / unchanged 1872). Offline flags work. GOTCHA: no `.gitignore` yet — fold into Task 8 (ignore `node_modules/`). (2026-09-25)
- [x] Task 5 — `scripts/verify-parity.mjs` (zero deps). Run: **exit 0** (both runs, idempotent). **Export-name coverage 1808/1808 (100%, 0 missing)**; **alias coverage 405/405 (100%)**; 20-icon node comparison (6 named icons present: Activity/Home/Settings/Check/X/AlertTriangle); 6/20 changed path data (expected), 1 shape diff (album→square-bookmark rename, informational). 55 kebab renames + 18 seeded removals confirmed present. CORRECTION to plan: real data gives **55** renamed kebabs (not ~73; the plan's ~73 conflated renames+removals); export-name criterion is the correct parity gate. (2026-09-25)

## Phase 2 — Build script and out-of-the-box dist (tasks 6–8)
- [x] Task 6 — `scripts/build.mjs` (zero deps: node:fs/path/url only; local inline char-scanner minifier, no devDependency). Emits all 5 artifacts: dist/esm/ (mirror of src, 1873 icon files + index; entry = `import * as index from './icons/index.js'; export { index as icons }; export * from './aliases.js'`), dist/cjs/lucide-vue.js (single-file bundle, engine INLINED, no require), dist/umd/lucide-vue.js + .min.js (UMD, global LucideVue, vue NOT a UMD dep), dist/types/lucide-vue.d.ts (2133 `export declare const` + icons ns). VERIFIED: CJS 2133 keys (2132 names + icons), icons ns = 1872 primaries, ESM entry 2132 names, UMD 2133; render correct (functional, ActivityIcon, defaultClass `lucide-icon lucide lucide-activity`, render fn); ZERO console.warn/Deprecat in any bundle; min.js valid + identifier-intact (793683→579953 B); idempotent (sha identical on 2nd run); `--clean` works. (2026-09-25)
- [x] Task 7 — `tests/smoke.mjs` (node:test, 4 tests) + `tests/smoke.test.mjs` shim (REQUIRED: Node 26 test runner only auto-discovers `test[.-]*` / `*.test.*` files; without the shim `node --test tests/` vacuously runs 0 tests). devDependencies added (vue@2.7.14 + vue-server-renderer@2.7.14, test-only; NO type field, NO dependencies). `npm test` → **pass 4 / fail 0, exit 0** (both runs). Prepare hook on install: sync no-op'd (0/0/1872/0 cached), build re-emitted dist/ byte-identical. VERIFIED: CJS+ESM same 2132 names; no dup/lost exports; Activity + AlarmCheck render to valid SVG via vue-server-renderer; size=48→width/height=48, color=crimson→stroke=crimson. NOTE: vue-server-renderer 2.7 uses `createRenderer().renderToString(vm,cb)` (no top-level renderToString — that's Vue 3). `icons.AlarmClockCheck` correctly absent (primary-only ns; 1.48.0 made AlarmCheck the canonical primary — upstream data change, not a bug; both export names still map to the same component). (2026-09-25)
- [ ] Task 8 — Commit generated output and tag

## Phase 3 — Consumer install path (tasks 9–10)
- [ ] Task 9 — Verify install-from-git works end to end
- [ ] Task 10 — Finish README with the verified install recipes

## Phase 4 — Ongoing maintenance (tasks 11–12)
- [ ] Task 11 — Smoke-test CI + sync workflow
- [ ] Task 12 — Final handover

## Notes
- Phase plan: all phases, in order (1 → 4) — decided 2026-09-25 at run start
- Repo state (2026-09-25): remote `git@github.com:nargalzius/lucide-legacy.git`;
  files on disk: `IDEA.md`, `PLAN.md`, `PROGRESS.md`, `PROMPT.md`;
  **no commits yet**.
- Research done during planning (2026-09-25) — all re-verifiable facts are in
  PLAN.md "Verified facts": engine source at upstream commit `1d6b5d6`
  (`packages/lucide-vue/`); data from `lucide-static` npm tarball
  (`icon-nodes.json`); aliases from `lucide` npm tarball
  (`dist/esm/iconsAndAliases.mjs`); current upstream version 1.48.0 (1854
  icons). Scratch unpacks under `~/.hermes/cache/scratch` may have been
  pruned — re-download is cheap.
- 2026-09-25: module-format decision (binding for Tasks 3/6/7): `package.json` must NOT
  set `"type":"module"` (keeps CJS default so `main: dist/cjs/...` is `require()`-able and
  matches real lucide-vue). Node v26.9 auto-detects ESM syntax in `.js` files even under a
  CJS-default package (prints a MODULE_TYPELESS_PACKAGE_JSON warning, then reparses as ESM —
  harmless). Verified: dynamic `import()` of ESM-syntax `src/*.js` works; `require()` of CJS
  main works. GOTCHA confirmed: with `type:module`, `require()` on a CJS `.js` main returns
  `undefined`. So: no `type` field; `dist/esm/` + `src/` = ESM syntax (auto-detected),
  `dist/cjs/` = CJS, `dist/umd/` = UMD, `dist/types/` = d.ts.
- 2026-09-25: parity/seed decision (binding, verified against real 0.517.0 + 1.48.0 tarballs):
  lucide 1.48.0 is NOT a kebab-superset of 0.517.0 (73 kebab files differ) BUT only 18 export
  NAMES are truly gone — all brand/social icons: Chrome, Codepen, Codesandbox, Dribbble,
  Facebook, Figma, Framer, Github, Gitlab, Instagram, Linkedin, Pocket, RailSymbol, Slack,
  Trello, Twitch, Twitter, Youtube. The other 55 "missing" kebab files were just RENAME
  upstream (their export names survive under new filenames). Seeding all 73 would create
  duplicate export names (the 55 renamed ones' names already exist in 1.48.0) and break the
  entry bundle + Task 7's no-duplicate assertion. So: SEED ONLY the 18 truly-gone names from
  the 0.517.0 baseline; no kebab-filename collision exists, so it's clean. Parity criterion
  is EXPORT-NAME level (consumers import by PascalCase name, not kebab filename) — this is
  what "keep all previously-shipped icons" actually means and what Task 5's superset check
  must test. Ground truth (verified): 1.48.0 = 1854 icons / 2114 export names, 0.517.0 =
  1603 icons / 1808 names; 249 icons have aliases; valid node tags = path|circle|rect|line|
  polyline|polygon|ellipse|g; NO `key` attr in 1.48.0 icon-nodes.json (but 0.517.0 dist files
  DO have `key` — drop it when emitting). Per-icon published shape: license header +
  `import createLucideIcon from '../createLucideIcon.js';` + `const <P> = createLucideIcon("<P>Icon", [nodes]);`
  + `export { <P> as default };`. Entry re-exports ALL names (primary + aliases) per icon
  file + `icons` namespace; CJS main = single-file bundle with engine inlined,
  `exports.<P> = <primaryConst>` per name + `exports.icons = index`. Scratch ground truth at
  /Users/nargalzius/.hermes/cache/scratch/task4-probe/ (both tarballs unpacked + analyze*.js).
- 2026-09-25: plan restructured into the 5-phase / 12-task linear format for
  the master/slave executor; `PROMPT.md` added.
