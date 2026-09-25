// End-to-end Vue 2 smoke test for the lucide-vue legacy fork.
// Loads dist/ via both CJS (require) and ESM (dynamic import), renders icons
// with vue-server-renderer, and asserts structural invariants.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

// Vue 2.7's vue-server-renderer has NO top-level `renderToString` export
// (that's the Vue 3 API). Its API is createRenderer().renderToString(vm, cb)
// with a callback. Wrap it in a promise.
const { createRenderer } = require('vue-server-renderer');
const ssrRenderer = createRenderer();
const renderToString = (vm) =>
  new Promise((resolve, reject) =>
    ssrRenderer.renderToString(vm, (err, html) =>
      err ? reject(err) : resolve(html),
    ),
  );

const Vue = require('vue');

const cjsPath = fileURLToPath(new URL('../dist/cjs/lucide-vue.js', import.meta.url));
const esmPath = new URL('../dist/esm/lucide-vue.js', import.meta.url);

const cjsMod = require(cjsPath);
const esmMod = await import(esmPath);

const cjsKeys = Object.keys(cjsMod).filter((k) => k !== 'icons');
const esmKeys = Object.keys(esmMod).filter((k) => k !== 'icons');

test('CJS and ESM entries expose the same export names', () => {
  const cjsSorted = [...cjsKeys].sort();
  const esmSorted = [...esmKeys].sort();
  assert.deepStrictEqual(esmSorted, cjsSorted);
  // icons namespace exists on both and has the same size
  assert.ok('icons' in cjsMod, 'CJS entry must expose the icons namespace');
  assert.ok('icons' in esmMod, 'ESM entry must expose the icons namespace');
  assert.strictEqual(
    Object.keys(esmMod.icons).length,
    Object.keys(cjsMod.icons).length,
    'icons namespace must have the same size on both entries',
  );
});

test('no duplicate / lost exports: CJS and ESM each declare 2132 names', () => {
  const uniqueEsm = new Set(esmKeys);
  assert.strictEqual(uniqueEsm.size, esmKeys.length, 'ESM export names must be unique');
  assert.strictEqual(esmKeys.length, 2132, `ESM export names (excl. icons) === 2132, got ${esmKeys.length}`);
  assert.strictEqual(cjsKeys.length, 2132, `CJS export names (excl. icons) === 2132, got ${cjsKeys.length}`);
  // icons namespace size is a secondary invariant (primary icons)
  assert.strictEqual(Object.keys(cjsMod.icons).length, 1872);
});

test('renders Activity icon and AlarmCheck alias to valid SVG (vue-server-renderer)', async () => {
  const icons = cjsMod.icons;
  assert.ok(icons.Activity, 'icons.Activity must exist');

  const activityVm = new Vue({
    render: (h) => h(icons.Activity, { props: { size: 24 } }),
  });
  const activityHtml = await renderToString(activityVm);
  assert.ok(activityHtml.includes('<svg'), 'Activity render must contain <svg');
  assert.ok(
    activityHtml.includes('lucide-activity'),
    `Activity render must contain class lucide-activity, got: ${activityHtml}`,
  );
  const pathMatch = activityHtml.match(/<path[^>]*\sd="([^"]+)"/);
  assert.ok(pathMatch, `Activity render must contain <path d="...": ${activityHtml}`);
  assert.ok(pathMatch[1].length > 0, 'Activity path d attribute must be non-empty');

  const { AlarmCheck, AlarmClockCheck } = cjsMod;
  assert.ok(AlarmCheck, 'CJS entry must expose the AlarmCheck alias');
  assert.ok(AlarmClockCheck, 'CJS entry must expose the AlarmClockCheck primary');
  // The alias export must BE the primary component (same object reference).
  assert.strictEqual(
    AlarmCheck,
    AlarmClockCheck,
    'AlarmCheck must be an alias of the same component object as AlarmClockCheck',
  );
  const aliasVm = new Vue({
    render: (h) => h(AlarmCheck, { props: { size: 24 } }),
  });
  const aliasHtml = await renderToString(aliasVm);
  assert.ok(aliasHtml.includes('<svg'), 'AlarmCheck alias render must contain <svg');
  // NOTE: the upstream Lucide 1.48.0 icon data ships defaultClass
  // 'lucide-alarm-check' for this icon (icon file is alarm-clock-check.js;
  // the exported component name is AlarmCheckIcon), so the rendered class is
  // 'lucide-alarm-check', not 'lucide-alarm-clock-check'. The alias-to-primary
  // mapping is proven by the strictEqual above + this class + the path.
  assert.ok(
    aliasHtml.includes('lucide-alarm-check'),
    `AlarmCheck alias must render the AlarmClockCheck component (class lucide-alarm-check per Lucide data), got: ${aliasHtml}`,
  );
  const aliasPath = aliasHtml.match(/<path[^>]*\sd="([^"]+)"/);
  assert.ok(aliasPath, `AlarmCheck alias render must contain <path d="...": ${aliasHtml}`);
});

test('size and color props affect the rendered SVG output', async () => {
  const icons = cjsMod.icons;

  const sizedVm = new Vue({
    render: (h) => h(icons.Activity, { props: { size: 48 } }),
  });
  const sizedHtml = await renderToString(sizedVm);
  assert.ok(sizedHtml.includes('width="48"'), `size=48 must set width="48", got: ${sizedHtml}`);
  assert.ok(sizedHtml.includes('height="48"'), `size=48 must set height="48", got: ${sizedHtml}`);

  const coloredVm = new Vue({
    render: (h) => h(icons.Activity, { props: { color: 'crimson' } }),
  });
  const coloredHtml = await renderToString(coloredVm);
  assert.ok(
    coloredHtml.includes('stroke="crimson"'),
    `color=crimson must set stroke="crimson", got: ${coloredHtml}`,
  );
});
