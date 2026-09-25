# lucide-vue (legacy fork)

`lucide-vue` is a maintained legacy fork of the [deprecated `lucide-vue` npm package](https://www.npmjs.com/package/lucide-vue). It keeps the exact same package name and the exact same API (Vue 2 only), and the icon data is auto-regenerated from current Lucide releases on every sync — so existing `import { X } from 'lucide-vue'` calls keep working, new icons show up automatically, and removed/renamed upstream icons are tracked in the sync report.

## Why it exists

The original `lucide-vue` package (`0.517.0`, the Vue 2 build of Lucide) is deprecated upstream: Lucide removed the Vue 2 package from its monorepo and only ships `lucide` for Vue 3 / framework-agnostic usage now. This fork preserves that frozen engine **verbatim** and only regenerates the icon data from current [lucide-static](https://github.com/lucide-icons/lucide-static) / [lucide](https://github.com/lucide-icons/lucide) releases. No API changes, no Vue 3 migration, no surprises — the component factory and default attributes are byte-identical to `lucide-vue@0.517.0`.

## Install

The package is **not** published to the npm registry under the name `lucide-vue` (see [Troubleshooting](#troubleshooting)), so it is installed from git, a packed tarball, or a local checkout. Every runnable command below was actually executed and confirmed to install `lucide-vue@1.48.0-legacy.1` (exit 0). The two package-manager override sections are config examples only.

**npm from git URL** — HTTPS works anonymously (the repo is public); the SSH form uses your git auth.

```sh
# anonymous, no auth needed:
npm install git+https://github.com/nargalzius/lucide-legacy.git
# or the SSH form (uses your git SSH auth):
npm install git+ssh://git@github.com/nargalzius/lucide-legacy.git
```

Verified output (fresh consumer dir, npm 11):

```
added 14 packages, and audited 15 packages in 10s
…
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   lucide-vue@1.48.0-legacy.1 (prepare: node scripts/sync.mjs --offline-ok && node scripts/build.mjs)
```

> The `prepare` warning is expected and harmless — `dist/` is already committed (see [Troubleshooting](#troubleshooting)). Use exactly the `git+ssh://git@github.com/nargalzius/lucide-legacy.git` form above for SSH (the SCP-style "user@host:repo" shorthand is **not** a valid npm git spec).

**For existing projects — swap the dependency value (cleanest migration).** If your project already uses the deprecated `lucide-vue`, you don't need to change any import or component — just repoint the dependency. In your `package.json`, change the `lucide-vue` value to the fork and run `npm install`:

```json
"dependencies": {
  ...
  "lucide-vue": "github:nargalzius/lucide-legacy#main",
  ...
}
```

```sh
npm install
```

This works with **no code changes** because the fork keeps the exact package name (`lucide-vue`), the exact API, and every icon + alias the deprecated package shipped (see [Preserved removed icons](#preserved-removed-icons)). Existing `import { Activity } from 'lucide-vue'` calls keep resolving — now to the maintained fork. Verified: a project on the registry `lucide-vue@0.517.0` switched to this value resolves to `lucide-vue@1.48.0-legacy.1` and `require('lucide-vue')` works (2133 exports, `Github` present). A fresh clone of any project whose `package.json` already has this value installs the fork the same way.

> `github:owner/repo#ref` is npm's short form of the git URL above (it installs `main` by default; pin a tag like `#v1.48.0-legacy.1` if you want a fixed revision). It is functionally identical to `npm install git+https://github.com/nargalzius/lucide-legacy.git` — both clone the repo, run its `prepare`, and install the committed `dist/`.

**npm from a packed tarball** — pack in a checkout of this repo, then install the tarball from your consuming project.

```sh
# in a checkout of this repo:
npm pack
# then, in your consuming project:
npm install ./lucide-vue-1.48.0-legacy.1.tgz
```

Verified `npm pack` output (tail):

```
npm notice filename: lucide-vue-1.48.0-legacy.1.tgz
npm notice package size: 577.5 kB
npm notice unpacked size: 3.6 MB
npm notice total files: 1885
lucide-vue-1.48.0-legacy.1.tgz
```

Verified `npm install ./lucide-vue-1.48.0-legacy.1.tgz` output (fresh consumer dir):

```
added 14 packages, and audited 15 packages in 3s
```

**pnpm overrides** — *config example (not a run command)*. Pin the name to the git URL so transitive/legacy deps resolve to this fork. In `pnpm-workspace.yaml`:

```yaml
overrides:
  lucide-vue: 'git+https://github.com/nargalzius/lucide-legacy.git'
```

or in the consuming package.json (`pnpm` key):

```json
{
  "pnpm": {
    "overrides": {
      "lucide-vue": "git+https://github.com/nargalzius/lucide-legacy.git"
    }
  }
}
```

**yarn resolutions** — *config example (not a run command)*. Same idea for Yarn, in the consuming package.json:

```json
{
  "resolutions": {
    "lucide-vue": "git+https://github.com/nargalzius/lucide-legacy.git"
  }
}
```

**`file:` protocol** — install from a local checkout path.

```sh
npm install file:/path/to/lucide-legacy
```

Verified output (fresh consumer dir, npm 11):

```
added 1 package, and audited 3 packages in 1s
found 0 vulnerabilities
```

(After any of these, `require('lucide-vue')` exposes 2133 top-level keys — 2132 named exports plus the `icons` namespace of 1872 — and `Activity` is a component object.)

## Usage

Usage is identical in shape to `lucide-vue@0.517.0` — plain Vue 2 components:

```vue
<template>
  <div>
    <Activity :size="24" />
    <AlarmCheck color="crimson" :stroke-width="1.5" />
  </div>
</template>

<script>
import { Activity } from 'lucide-vue';
import { AlarmCheck } from 'lucide-vue';

export default {
  name: 'App',
  components: {
    Activity,
    AlarmCheck,
  },
};
</script>
```

Every icon (including aliases such as `AlarmCheck` for `AlarmClockCheck`) is a named export. Standard Lucide props are supported: `color`, `size`, `strokeWidth`, `absoluteStrokeWidth`, and `defaultClass`.

## Preserved removed icons

Current upstream Lucide (1.48.0) has **removed** a set of icons that the deprecated `lucide-vue@0.517.0` shipped — almost all brand / social-media logos, which Lucide deprecated for trademark reasons. Deleting them from a consumer's dependency would break `import { Github } from 'lucide-vue'` in existing projects, so this fork **keeps them** and marks each `src/icons/` file with a `/* deprecated upstream */` header (they are tracked in `scripts/seed-icons.json` and reported as "removed (kept)" in every sync delta).

The 18 preserved icons (import name → kebab file):

| Icon (named export) | Kebab file |
| --- | --- |
| `Chrome` | `chrome` |
| `Codepen` | `codepen` |
| `Codesandbox` | `codesandbox` |
| `Dribbble` | `dribbble` |
| `Facebook` | `facebook` |
| `Figma` | `figma` |
| `Framer` | `framer` |
| `Github` | `github` |
| `Gitlab` | `gitlab` |
| `Instagram` | `instagram` |
| `Linkedin` | `linkedin` |
| `Pocket` | `pocket` |
| `RailSymbol` | `rail-symbol` |
| `Slack` | `slack` |
| `Trello` | `trello` |
| `Twitch` | `twitch` |
| `Twitter` | `twitter` |
| `Youtube` | `youtube` |

So `import { Github, Twitter, Dribbble } from 'lucide-vue'` still works even though those icons no longer exist in current upstream Lucide. If upstream ever **re-adds** one of these, a sync prefers the live upstream version and drops it from the seed store automatically. (Icons that upstream merely **renamed** — e.g. `AlertTriangle` → `TriangleAlert` — are not in this list; both names stay exported as aliases, so old imports keep working too.)

## Keep up to date

```sh
npm run sync
```

`sync` pulls the latest `lucide-static` / `lucide` data, regenerates `src/icons` and the `dist/` bundles, prints an added / removed / unchanged delta report, and re-commits the regenerated data when run in a git checkout. Verified `--dry-run` output (no-op write, safe to run):

```
sync delta (lucide v1.48.0) vs src/icons/:
  added:     0
  removed:   0 (kept on disk with '/* deprecated upstream */' header)
  unchanged: 1872
  changed:   0 (data updated in place)
  total to emit: 1872 files (1854 live + 18 seeded)
```

- Pin a specific upstream version: `npm run sync -- --version X.Y.Z`
- Preview without writing files: `npm run sync -- --dry-run`
- Re-check parity against `lucide-vue@0.517.0` (engine + exports): `node scripts/verify-parity.mjs`

## Troubleshooting

- **Vue 2 only.** The peer dependency is `vue ^2.6.12`. This fork targets Vue 2 — on Vue 3, use the official [`lucide`](https://lucide.dev) package directly instead of this fork. (Server-rendering note: with Vue 2 you use `vue-server-renderer`'s `createRenderer().renderToString(vm, cb)`; there is no top-level `renderToString` export in Vue 2, and the Vue 3 SSR API is different.)
- **Not on the npm registry as `lucide-vue`.** This package is NOT published to the npm registry under the name `lucide-vue` — that name is still live (and deprecated) on the registry. Install this fork **only** via the git URL, package-manager overrides, or the `file:` protocol shown above.
- **Fresh offline clone.** The `prepare` script runs on install; on a fresh clone with no cache and no network it no-ops — it prints `[offline] cache miss for lucide version …; leaving committed src/ and dist/ unchanged.` and exits 0, keeping the committed `src/` and `dist/`. If you see a deprecation warning from an **older** `lucide-vue`, you have the deprecated registry package, not this fork.
- **npm install-script gating.** If your npm version gates dependency lifecycle scripts and skips this package's `prepare` (you'll see an `install-scripts … not yet covered by allowScripts` warning), it is harmless because `dist/` is already committed and shipped — `require('lucide-vue')` works either way. To force regeneration-on-install, run `npm install-scripts approve lucide-vue`.

## Deprecation safety / scope note

- This is a **community-maintained legacy fork**, provided as-is for Vue 2 projects that cannot or will not migrate.
- **Vue 2 only.** If you are on Vue 3, use the official [`lucide`](https://lucide.dev) package directly instead of this fork.
- This package is **NOT published to the npm registry** under the name `lucide-vue` — that name is still live (and deprecated) on the registry. Install it **only** via the git URL, package-manager overrides, or `file:` protocol as shown above.
