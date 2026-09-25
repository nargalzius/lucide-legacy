#!/usr/bin/env node
/**
 * scripts/verify-parity.mjs
 *
 * PARITY VERIFICATION for the generated icon set (from scripts/sync.mjs)
 * against the real deprecated npm package lucide-vue@0.517.0.
 *
 * Zero runtime dependencies: Node >= 18 builtins + global fetch + system tar
 * (via child_process, only needed when fetching/unpacking 0.517.0).
 *
 * Usage:
 *   node scripts/verify-parity.mjs                  # fetch 0.517.0 (cached) and verify
 *   node scripts/verify-parity.mjs --baseline DIR   # use an already-unpacked 0.517.0 dist/esm dir
 *   node scripts/verify-parity.mjs --icons N        # how many common icons to node-compare (default 20)
 *
 * HARD PASS criterion (exit 0 iff both hold):
 *   1. Every EXPORT NAME in 0.517.0's entry is present in the generated export
 *      surface (src/icons/index.js union src/aliases.js). Consumers import by
 *      PascalCase export name, not kebab filename — so kebab-file renames in
 *      lucide 1.48.0 are reported but are NOT failures.
 *   2. Every 0.517.0 alias (non-primary export name) is present in the
 *      generated surface.
 *
 * Path-data changes between 0.517.0 and 1.48.0 are EXPECTED and reported,
 * never a failure.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.517.0';
const REGISTRY = 'https://registry.npmjs.org/lucide-vue/-/';
const TARBALL_URL = `${REGISTRY}lucide-vue-${VERSION}.tgz`;

// The 18 brand/social export names lucide 1.48.0 truly removed and that
// scripts/sync.mjs seeds back into the generated set.
const SEEDED_REMOVALS = [
  'Chrome', 'Codepen', 'Codesandbox', 'Dribbble', 'Facebook', 'Figma',
  'Framer', 'Github', 'Gitlab', 'Instagram', 'Linkedin', 'Pocket',
  'RailSymbol', 'Slack', 'Trello', 'Twitch', 'Twitter', 'Youtube',
];

// Icons that MUST be included in the node comparison (by 0.517.0 export name).
const REQUIRED_COMPARE = ['Activity', 'Home', 'Settings', 'Check', 'X', 'AlertTriangle'];

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { baseline: null, icons: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--baseline') {
      if (!argv[i + 1]) fail('--baseline requires a PATH');
      args.baseline = argv[++i];
    } else if (a === '--icons') {
      if (!argv[i + 1]) fail('--icons requires a number');
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) fail('--icons must be a positive integer');
      args.icons = n;
    } else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/verify-parity.mjs [--baseline PATH] [--icons N]');
      process.exit(0);
    } else {
      fail(`unknown flag: ${a}`);
    }
  }
  return args;
}

function fail(msg) {
  console.error(`[verify-parity] ERROR: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Obtain 0.517.0
// ---------------------------------------------------------------------------
async function obtainBaseline(args) {
  let esmDir;
  if (args.baseline) {
    esmDir = resolve(args.baseline);
    if (!existsSync(join(esmDir, 'lucide-vue.js')) &&
        !existsSync(join(esmDir, 'icons'))) {
      fail(`--baseline ${esmDir} does not look like an unpacked dist/esm dir (no lucide-vue.js or icons/)`);
    }
    console.log(`[baseline] using --baseline: ${esmDir}`);
  } else {
    const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'lucide-legacy');
    const tgzPath = join(cacheDir, `lucide-vue-${VERSION}.tgz`);
    const extractDir = join(cacheDir, `lucide-vue-${VERSION}`);
    esmDir = join(extractDir, 'package', 'dist', 'esm');

    if (existsSync(esmDir) && existsSync(join(esmDir, 'lucide-vue.js'))) {
      console.log(`[cache] using cached ${VERSION} at ${esmDir}`);
      return esmDir;
    }
    mkdirSync(cacheDir, { recursive: true });
    console.log(`[fetch] downloading ${TARBALL_URL}`);
    const res = await fetch(TARBALL_URL);
    if (!res.ok) fail(`npm registry fetch failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFileSync } = await import('node:fs');
    writeFileSync(tgzPath, buf);
    console.log(`[fetch] saved ${buf.length} bytes -> ${tgzPath}`);

    mkdirSync(extractDir, { recursive: true });
    const tar = spawnSync('tar', ['-xzf', tgzPath, '-C', extractDir], { stdio: 'inherit' });
    if (tar.status !== 0) fail(`tar extraction failed (status ${tar.status})`);
    if (!existsSync(join(esmDir, 'lucide-vue.js'))) {
      fail(`expected entry file missing after extraction: ${esmDir}/lucide-vue.js`);
    }
    console.log(`[extract] unpacked -> ${esmDir}`);
  }
  if (!existsSync(join(esmDir, 'lucide-vue.js'))) fail(`missing ${esmDir}/lucide-vue.js`);
  if (!existsSync(join(esmDir, 'icons'))) fail(`missing ${esmDir}/icons/`);
  return esmDir;
}

// ---------------------------------------------------------------------------
// 2/3. Parse export surfaces
// ---------------------------------------------------------------------------
/**
 * Parse `export { default as NAME, default as NAME2 } from './kebab.js';`
 * lines. Returns { names: Set, nameToKebab: Map(name -> kebab),
 *                  lines: [{names:[], kebab}] }.
 */
function parseExportSurface(file) {
  const text = readFileSync(file, 'utf8');
  const names = new Set();
  const nameToKebab = new Map();
  const lines = [];
  for (const m of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const namesInLine = m[1].split(',').map((s) => s.trim().replace(/^default\s+as\s+/, '')).filter(Boolean);
    let kebab = m[2].replace(/^\.\/icons\//, '').replace(/^\.?\//, '').replace(/\.js$/, '');
    if (kebab === 'index') continue; // `import * as index` re-export line
    for (const n of namesInLine) {
      names.add(n);
      if (!nameToKebab.has(n)) nameToKebab.set(n, kebab);
    }
    if (namesInLine.length) lines.push({ names: namesInLine, kebab });
  }
  return { names, nameToKebab, lines };
}

/** Kebab names referenced by the from-paths of an export-surface file. */
function kebabSet(file) {
  const text = readFileSync(file, 'utf8');
  const s = new Set();
  for (const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
    const kebab = m[1].replace(/^\.\/icons\//, '').replace(/^\.?\//, '').replace(/\.js$/, '');
    if (kebab !== 'index') s.add(kebab);
  }
  return s;
}

// ---------------------------------------------------------------------------
// 6. Per-icon node parsing & comparison
// ---------------------------------------------------------------------------
/**
 * Parse the node array of an icon file:
 *   const X = createLucideIcon("XIcon", [ ["tag", { d: "...", ... }], ... ]);
 * Returns [{ tag, d, attrsText }] (d is null for non-path nodes).
 */
function parseIconNodes(file) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/createLucideIcon\(\s*"[^"]*"\s*,\s*\[([\s\S]*)\]\s*\)\s*;/);
  if (!m) fail(`could not locate createLucideIcon node array in ${file}`);
  const nodes = [];
  // Each node is  ["tag", { ...attrs }]  — attrs are flat (no nested objects).
  for (const nm of m[1].matchAll(/["']([A-Za-z][\w-]*)["']\s*,\s*\{([\s\S]*?)\}\s*\]/g)) {
    const tag = nm[1];
    const attrsText = nm[2];
    const dm = attrsText.match(/\bd\s*:\s*"((?:\\.|[^"\\])*)"/);
    nodes.push({ tag, d: dm ? dm[1] : null, attrsText });
  }
  if (nodes.length === 0) fail(`parsed 0 nodes from ${file}`);
  return nodes;
}

/**
 * Compare the node arrays of two versions of one icon.
 * - shape: same node count and same tag per node. (Upstream sometimes
 *   converts primitive nodes to paths, e.g. polyline -> path; that IS a
 *   shape difference and is reported, but per the parity contract the
 *   hard gate is export names, so shape diffs are informational.)
 * - data: per node, compare the d string for path nodes; for non-path
 *   nodes compare the normalized attribute map (0.517.0 files carry an
 *   extra `key` attribute and different attr ordering — both stripped
 *   before comparison).
 */
function normAttrs(text) {
  const attrs = [];
  for (const m of text.matchAll(/([A-Za-z-]+)\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
    if (m[1] === 'key') continue;
    attrs.push(`${m[1]}=${m[2]}`);
  }
  return attrs.sort().join(' ');
}

function compareNodes(oldNodes, newNodes) {
  const sameCount = oldNodes.length === newNodes.length;
  const sameShape = sameCount && oldNodes.every((n, i) => n.tag === newNodes[i].tag);
  let dataDiffers = false;
  for (let i = 0; i < Math.min(oldNodes.length, newNodes.length); i++) {
    const o = oldNodes[i];
    const nw = newNodes[i];
    if (o.d !== null || nw.d !== null) {
      if (o.d !== nw.d) dataDiffers = true;
    } else if (normAttrs(o.attrsText) !== normAttrs(nw.attrsText)) {
      dataDiffers = true;
    }
  }
  if (!sameCount) dataDiffers = true;
  return { sameCount, sameShape, dataDiffers };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));
const ROOT = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));

const esmDir = await obtainBaseline(args);
console.log(`\n=== verify-parity: lucide-vue@${VERSION} vs generated (lucide 1.48.0) ===\n`);

// --- 0.517.0 export surface ------------------------------------------------
const base = parseExportSurface(join(esmDir, 'lucide-vue.js'));
console.log(`[0517] export names: ${base.names.size}, icon files referenced: ${new Set(base.lines.map(l => l.kebab)).size}`);

// --- generated export surface ----------------------------------------------
const genIndex = parseExportSurface(join(ROOT, 'src', 'icons', 'index.js'));
const genAli = parseExportSurface(join(ROOT, 'src', 'aliases.js'));
const genNames = new Set([...genIndex.names, ...genAli.names]);
console.log(`[gen ] index.js names: ${genIndex.names.size}, aliases.js names: ${genAli.names.size}, union: ${genNames.size}`);

// --- HARD CHECK: export-name superset ---------------------------------------
const missing = [...base.names].filter((n) => !genNames.has(n)).sort();
console.log(`\n--- HARD CHECK: 0.517.0 export names present in generated surface ---`);
console.log(`covered: ${base.names.size - missing.length}/${base.names.size} (${((100 * (base.names.size - missing.length)) / base.names.size).toFixed(1)}%)`);
if (missing.length) {
  console.log(`MISSING (${missing.length}):`);
  for (const n of missing) console.log(`  - ${n}`);
  fail(`${missing.length} 0.517.0 export name(s) missing from generated surface`);
}
console.log('missing: 0');

// --- TRANSPARENCY: kebab-level differences (not a failure) ------------------
const kebab0517 = new Set(base.lines.map((l) => l.kebab));
const kebabGen = new Set([...kebabSet(join(ROOT, 'src', 'icons', 'index.js')), ...kebabSet(join(ROOT, 'src', 'aliases.js'))]);
const kebabMissing = [...kebab0517].filter((k) => !kebabGen.has(k)).sort();
console.log(`\n--- TRANSPARENCY: kebab filename differences (informational, NOT a failure) ---`);
console.log(`0.517.0 kebab icons not present by the same kebab in generated: ${kebabMissing.length}`);
console.log('these are the icons lucide 1.48.0 RENAMED (kebab changed, export names preserved)');
console.log('plus the truly-removed brand icons that sync.mjs seeds back under new kebab names:');
const seededPresent = SEEDED_REMOVALS.filter((n) => genNames.has(n));
const seededAbsent = SEEDED_REMOVALS.filter((n) => !genNames.has(n));
console.log(`seeded removals present in generated surface: ${seededPresent.length}/${SEEDED_REMOVALS.length}`);
console.log(`  ${seededPresent.join(', ')}`);
if (seededAbsent.length) console.log(`  (NOT seeded: ${seededAbsent.join(', ')})`);
// renamed = kebab missing but whose export names all still exist
const renamed = kebabMissing.filter((k) => {
  const line = base.lines.find((l) => l.kebab === k);
  return line && line.names.every((n) => genNames.has(n));
});
console.log(`of those, export names fully preserved (pure renames): ${renamed.length}; kebab gone entirely: ${kebabMissing.length - renamed.length}`);

// --- ALIAS COVERAGE ----------------------------------------------------------
// 0.517.0 alias = any export name on a multi-name export line (primary + its
// aliases); all must exist in the generated surface (aliases.js or index.js).
const aliasNames = new Set();
for (const l of base.lines) {
  if (l.names.length > 1) for (const n of l.names) aliasNames.add(n);
}
const aliasMissing = [...aliasNames].filter((n) => !genNames.has(n)).sort();
console.log(`\n--- ALIAS COVERAGE ---`);
console.log(`0.517.0 alias names (multi-name export lines): ${aliasNames.size}`);
if (aliasMissing.length) {
  console.log(`MISSING ALIASES (${aliasMissing.length}):`);
  for (const n of aliasMissing) console.log(`  - ${n}`);
  fail(`${aliasMissing.length} 0.517.0 alias name(s) missing from generated surface`);
}
console.log(`covered: ${aliasNames.size}/${aliasNames.size} (100%)`);

// --- NODE COMPARISON ---------------------------------------------------------
const chosen = [];
const chosenKebabs = new Set();
const pushChosen = (name) => {
  const kOld = base.nameToKebab.get(name);
  if (!kOld || chosen.includes(name) || chosenKebabs.has(kOld)) return;
  chosen.push(name);
  chosenKebabs.add(kOld);
};
for (const req of REQUIRED_COMPARE) {
  if (!base.nameToKebab.has(req)) fail(`required compare icon '${req}' not found in 0.517.0 exports`);
  pushChosen(req);
}
for (const name of [...base.names].sort()) {
  if (chosen.length >= args.icons) break;
  if (!genNames.has(name)) continue;
  pushChosen(name);
}

console.log(`\n--- NODE COMPARISON: ${chosen.length} common icons (node-compare) ---`);
let changedCount = 0;
let shapeDiffer = 0;
const shapeDiffNames = [];
for (const name of chosen) {
  const kOld = base.nameToKebab.get(name);
  const kNew = genIndex.nameToKebab.get(name) ?? genAli.nameToKebab.get(name);
  if (!kNew) {
    // cannot happen (hard check passed), but keep the script total
    console.log(`${name}: SKIP (no generated kebab found)`);
    shapeDiffer++;
    continue;
  }
  const oldFile = join(esmDir, 'icons', `${kOld}.js`);
  const newFile = join(ROOT, 'src', 'icons', `${kNew}.js`);
  if (!existsSync(oldFile) || !existsSync(newFile)) {
    fail(`expected icon file missing: ${existsSync(oldFile) ? 'new' : 'old'} (${oldFile} / ${newFile})`);
  }
  const oldNodes = parseIconNodes(oldFile);
  const newNodes = parseIconNodes(newFile);
  const { sameShape, dataDiffers } = compareNodes(oldNodes, newNodes);
  if (dataDiffers) changedCount++;
  if (!sameShape) {
    shapeDiffer++;
    shapeDiffNames.push(kOld);
  }
  const renameNote = kNew !== kOld ? ` [renamed: ${kOld} -> ${kNew}]` : '';
  console.log(`${kOld} (${name}): nodes=${oldNodes.length}/${newNodes.length} ${sameShape ? 'same shape' : 'SHAPE DIFFERS'}, d: ${dataDiffers ? 'changed' : 'identical'}${renameNote}`);
}

// --- RESULT ------------------------------------------------------------------
console.log(`\n=== SUMMARY ===`);
console.log(`export-name coverage : ${base.names.size}/${base.names.size} (100%), missing 0`);
console.log(`alias coverage       : ${aliasNames.size}/${aliasNames.size} (100%)`);
console.log(`node comparison      : ${chosen.length} icons; ${changedCount} with changed path/attribute data (expected), ${shapeDiffer} with differing node shape (informational, upstream primitive->path or count changes)`);
if (shapeDiffer) console.log(`shape differences    : ${shapeDiffNames.join(', ')}`);
console.log(`kebab renames (info) : ${kebabMissing.length} 0.517.0 kebab names not used by generated set (not a failure)`);
console.log(`\nPASS: generated icon set is a faithful superset of lucide-vue@${VERSION} at the export-name level.`);
process.exit(0);
