#!/usr/bin/env node
/**
 * lucide-vue legacy — zero-runtime-dependency build script.
 *
 * Pure Node (>=18) using only node: builtins. No bundler, no npm install,
 * no network. Reads src/ and emits the five published artifacts into dist/:
 *
 *   dist/esm/lucide-vue.js     (+ mirror of src/ for tree-shaking)
 *   dist/cjs/lucide-vue.js     (single-file CJS bundle, engine inlined)
 *   dist/umd/lucide-vue.js     (UMD wrapper, global name LucideVue)
 *   dist/umd/lucide-vue.min.js (minified copy of the UMD)
 *   dist/types/lucide-vue.d.ts (TypeScript declarations)
 *
 * Reproducible: same src/ => byte-identical dist/.
 * Flags: --clean  (clean dist/ and stop, emit nothing)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const argv = process.argv.slice(2);
const CLEAN_ONLY = argv.includes('--clean');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
}
function read(p) {
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
}
function indent(s, n) {
  const pad = ' '.repeat(n);
  return s.split('\n').map((l) => (l.length ? pad + l : l)).join('\n');
}

const LICENSE = `/**
 * @license lucide-vue v1.48.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */`;

// ---------------------------------------------------------------------------
// Read source (byte-for-byte; these are the single source of truth)
// ---------------------------------------------------------------------------
const engineSrc = read(path.join(SRC, 'createLucideIcon.js'));
const attrsSrc = read(path.join(SRC, 'defaultAttributes.js'));
const aliasesSrc = read(path.join(SRC, 'aliases.js'));

// Inline defaultAttributes: drop the ESM `export default ...` line, keep the const.
const defaultAttributesConst = attrsSrc
  .replace(/export\s+default\s+defaultAttributes;?[\s\S]*$/m, '')
  .trimEnd();

// Inline the engine: drop the `import ...` line and the `const toKebabCase`
// line (both are emitted separately before the engine), then convert the
// `export default ( ... )` factory into a CJS `var createLucideIcon = ( ... )`.
// NO deprecation warning, NO console.warn (that is the whole point of the fork).
function buildEngine() {
  let t = engineSrc
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l))
    .filter((l) => !/^\s*const\s+toKebabCase\s*=/.test(l))
    .join('\n');
  t = t.replace(/export\s+default\s*\(/, 'var createLucideIcon = (');
  return t.trim();
}
const toKebabCaseConst = `const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();`;

// ---------------------------------------------------------------------------
// Parse every icon: primary const name + verbatim `const X = createLucideIcon(...)` block
// ---------------------------------------------------------------------------
const iconDir = path.join(SRC, 'icons');
const iconFiles = fs
  .readdirSync(iconDir)
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort();

const icons = [];
for (const f of iconFiles) {
  const c = read(path.join(iconDir, f));
  const m = c.match(/^const (\w+) = createLucideIcon\("(\w+)", \[[\s\S]*?\n\]\);/m);
  if (!m) throw new Error(`Failed to parse icon: ${f}`);
  icons.push({ primary: m[1], iconName: m[2], block: m[0], kebab: f.replace(/\.js$/, '') });
}
const primaryByKebab = new Map(icons.map((i) => [i.kebab, i.primary]));

// ---------------------------------------------------------------------------
// Parse aliases.js: every export name mapped to its primary const.
// Each line: export { default as NameA[, default as NameB...] } from './icons/<kebab>.js';
// All names on a line (primary + aliases) resolve to that file's primary const.
// ---------------------------------------------------------------------------
const exportNames = [];
for (const line of aliasesSrc.split('\n')) {
  const m = line.match(/^export \{ (.*) \} from '\.\/icons\/([\w-]+)\.js';/);
  if (!m) continue;
  const kebab = m[2];
  const primary = primaryByKebab.get(kebab);
  if (!primary) throw new Error(`No primary const for kebab: ${kebab}`);
  for (const part of m[1].split(',').map((s) => s.trim())) {
    const nm = part.match(/^default as (\w+)$/);
    if (!nm) throw new Error(`Bad export part: "${part}"`);
    exportNames.push({ name: nm[1], primary });
  }
}

// ---------------------------------------------------------------------------
// Shared bundle body (engine + all icon consts + icons namespace + exports)
// ---------------------------------------------------------------------------
function bundleBody() {
  const parts = [];
  parts.push(defaultAttributesConst);
  parts.push('');
  parts.push(toKebabCaseConst);
  parts.push('');
  parts.push(buildEngine());
  parts.push('');
  for (const ic of icons) {
    parts.push(ic.block);
    parts.push('');
  }
  // icons namespace: ONLY the 1872 primaries (primary name -> primary const)
  parts.push('var index = /*#__PURE__*/Object.freeze({');
  parts.push('  __proto__: null,');
  for (const ic of icons) parts.push(`  ${ic.primary}: ${ic.primary},`);
  parts.push('});');
  parts.push('');
  // export every name (primaries + aliases); aliases point to the same primary const
  for (const e of exportNames) parts.push(`exports.${e.name} = ${e.primary};`);
  parts.push('exports.icons = index;');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Inline minifier (no devDependency — keep the package friction-free / CI dep-free).
// A character-scanner that strips // and /* */ comments and collapses runs of
// whitespace, while keeping string literals, template literals and the one
// regex literal (in the engine) byte-intact.
// ---------------------------------------------------------------------------
function couldBeRegex(prev) {
  if (prev === null) return true;
  if (/[A-Za-z0-9_$)\]]/.test(prev)) return false; // end of identifier/number/closing token
  return true; // a regex may follow ( , ! & | ? { = etc.
}
function minify(src) {
  const n = src.length;
  let i = 0;
  let out = '';
  // lastSigChar/lastSigIdx: the char + source index of the last significant
  // (non-whitespace) token written. Used to decide whether two emitted word
  // chars were separated by whitespace in the ORIGINAL source (=> separate
  // tokens, keep a space) or were adjacent (=> same identifier, no space).
  let lastSigChar = null;
  let lastSigIdx = -1;
  const word = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c);
  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';
  function put(ch, at) {
    // "gap" = source distance between previous significant char and this one;
    // a gap means only whitespace/comments lay between them => distinct tokens.
    if (lastSigChar !== null && word(lastSigChar) && word(ch) && at > lastSigIdx + 1) out += ' ';
    out += ch;
    lastSigChar = ch;
    lastSigIdx = at;
  }
  function putRaw(s, endIdx) {
    out += s;
    // For the token-separation heuristic, remember the last word char in the
    // literal (or keep the previous context if the literal has none). The
    // source index points to the literal's final char.
    for (let k = s.length - 1; k >= 0; k--) {
      if (word(s[k])) { lastSigChar = s[k]; break; }
    }
    lastSigIdx = endIdx;
  }
  while (i < n) {
    const c = src[i];
    // line comment
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // regex literal
    if (c === '/' && couldBeRegex(lastSigChar)) {
      const start = i;
      i++;
      let inClass = false;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '\n') break; // actually a division; fall through to emit
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; break; }
        i++;
      }
      while (i < n && /[a-z]/.test(src[i])) i++; // flags
      putRaw(src.slice(start, i), i - 1);
      continue;
    }
    // single/double-quoted string
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        j++;
      }
      putRaw(src.slice(i, j), j - 1);
      i = j;
      continue;
    }
    // template literal
    if (c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') { j++; break; }
        if (src[j] === '$' && src[j + 1] === '{') {
          j += 2;
          let depth = 1;
          while (j < n && depth > 0) {
            const ch = src[j];
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
            else if (ch === '"' || ch === "'") { j += 2; continue; }
            j++;
          }
          continue;
        }
        j++;
      }
      putRaw(src.slice(i, j), j - 1);
      i = j;
      continue;
    }
    if (isWs(c)) { i++; continue; }
    put(c, i);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
cleanDist();
if (CLEAN_ONLY) {
  console.log('build: dist/ cleaned (--clean); emitted nothing.');
  process.exit(0);
}

// (1) ESM: mirror src/ + entry
fs.cpSync(path.join(SRC, 'createLucideIcon.js'), path.join(DIST, 'esm', 'createLucideIcon.js'));
fs.cpSync(path.join(SRC, 'defaultAttributes.js'), path.join(DIST, 'esm', 'defaultAttributes.js'));
fs.cpSync(path.join(SRC, 'icons'), path.join(DIST, 'esm', 'icons'), { recursive: true });
fs.cpSync(path.join(SRC, 'aliases.js'), path.join(DIST, 'esm', 'aliases.js'));
const esmEntry = `${LICENSE}\n\nimport * as index from './icons/index.js';\nexport { index as icons };\nexport * from './aliases.js';\n`;
write(path.join(DIST, 'esm', 'lucide-vue.js'), esmEntry);

// (2) CJS single-file bundle (engine inlined)
const body = bundleBody();
const cjs = `${LICENSE}\n\n'use strict';\n\n${body}\n`;
write(path.join(DIST, 'cjs', 'lucide-vue.js'), cjs);

// (3) UMD wrapper (global name LucideVue; factory depends only on 'exports')
const umd = `${LICENSE}\n\n(function (global, factory) {\n  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :\n  typeof define === 'function' && define.amd ? define(['exports'], factory) :\n  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.LucideVue = {}));\n})(this, (function (exports) { 'use strict';\n\n${indent(body, 2)}\n\n}));\n`;
write(path.join(DIST, 'umd', 'lucide-vue.js'), umd);

// (4) minified UMD
const umdMin = minify(umd);
write(path.join(DIST, 'umd', 'lucide-vue.min.js'), umdMin);

// (5) TypeScript declarations
const dtParts = [LICENSE];
for (const e of exportNames) dtParts.push(`export declare const ${e.name}: import('vue').FunctionalComponentOptions;`);
dtParts.push(`export declare const icons: { [name: string]: import('vue').FunctionalComponentOptions };`);
write(path.join(DIST, 'types', 'lucide-vue.d.ts'), dtParts.join('\n') + '\n');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const bytes = (p) => fs.statSync(p).size;
console.log('build: emitted dist/ (pure Node, zero runtime deps)');
console.log(`  icons (primaries):  ${icons.length}`);
console.log(`  export names:       ${exportNames.length} (+ icons namespace = ${exportNames.length + 1} top-level keys)`);
console.log(`  dist/cjs/lucide-vue.js   ${bytes(path.join(DIST, 'cjs', 'lucide-vue.js'))} B`);
console.log(`  dist/umd/lucide-vue.js   ${bytes(path.join(DIST, 'umd', 'lucide-vue.js'))} B`);
console.log(`  dist/umd/lucide-vue.min.js ${bytes(path.join(DIST, 'umd', 'lucide-vue.min.js'))} B (minifier: local inline, no devDependency)`);
console.log(`  dist/esm/lucide-vue.js   ${bytes(path.join(DIST, 'esm', 'lucide-vue.js'))} B`);
console.log(`  dist/types/lucide-vue.d.ts ${bytes(path.join(DIST, 'types', 'lucide-vue.d.ts'))} B`);
