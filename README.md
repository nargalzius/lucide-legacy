# lucide-vue (legacy fork)

`lucide-vue` is a maintained legacy fork of the [deprecated `lucide-vue` npm package](https://www.npmjs.com/package/lucide-vue). It keeps the exact same package name and the exact same API (Vue 2 only), and the icon data is auto-regenerated from current Lucide releases on every sync — so existing `import { X } from 'lucide-vue'` calls keep working, new icons show up automatically, and removed/renamed upstream icons are tracked in the sync report.

## Why it exists

The original `lucide-vue` package (`0.517.0`, the Vue 2 build of Lucide) is deprecated upstream: Lucide removed the Vue 2 package from its monorepo and only ships `lucide` for Vue 3 / framework-agnostic usage now. This fork preserves that frozen engine **verbatim** and only regenerates the icon data from current [lucide-static](https://github.com/lucide-icons/lucide-static) / [lucide](https://github.com/lucide-icons/lucide) releases. No API changes, no Vue 3 migration, no surprises — the component factory and default attributes are byte-identical to `lucide-vue@0.517.0`.

## Install

> Status of each option: **verified: pending** — each one will be exercised and confirmed in a later task; the commands below are the intended form.

**npm from git URL** *(verified: pending)*

```sh
npm install git+https://github.com/nargalzius/lucide-legacy.git
# or the SSH form:
npm install git+ssh://git@github.com/nargalzius/lucide-legacy.git
```

**npm from a packed tarball** *(verified: pending)*

```sh
# in a checkout of this repo:
npm pack
# then, in your consuming project:
npm install ./lucide-vue-1.48.0-legacy.1.tgz
```

**pnpm overrides** — pin the name to the git URL so transitive/legacy deps resolve to this fork *(verified: pending)*. In `pnpm-workspace.yaml`:

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

**yarn resolutions** — same idea for Yarn *(verified: pending)*:

```json
{
  "resolutions": {
    "lucide-vue": "git+https://github.com/nargalzius/lucide-legacy.git"
  }
}
```

**`file:` protocol** — install from a local checkout path *(verified: pending)*:

```sh
npm install file:./path-to-lucide-legacy
```

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

## Keep up to date

```sh
npm run sync
```

`sync` pulls the latest `lucide-static` / `lucide` data, regenerates `src/icons` and the `dist/` bundles, prints an added / removed / unchanged delta report, and is meant to be committed (the sync script re-commits the regenerated data when run in a git checkout).

- Pin a specific upstream version: `npm run sync -- --version X.Y.Z`
- Preview without writing files: `npm run sync -- --dry-run`

## Deprecation safety / scope note

- This is a **community-maintained legacy fork**, provided as-is for Vue 2 projects that cannot or will not migrate.
- **Vue 2 only.** If you are on Vue 3, use the official [`lucide`](https://lucide.dev) package directly instead of this fork.
- This package is **NOT published to the npm registry** under the name `lucide-vue` — that name is still live (and deprecated) on the registry. Install it **only** via the git URL, package-manager overrides, or `file:` protocol as shown above.
