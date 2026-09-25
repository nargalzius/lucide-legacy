#!/usr/bin/env node
/**
 * scripts/sync.mjs — lucide-legacy icon data sync (Task 4)
 *
 * Pure Node >= 18, ZERO runtime dependencies: node: builtins + global fetch +
 * system `tar` (via node:child_process) for tarball extraction. No npm packages.
 *
 * Usage:
 *   node scripts/sync.mjs                  # sync upstream `latest`
 *   node scripts/sync.mjs --version 1.48.0 # sync a specific version
 *   node scripts/sync.mjs --dry-run        # report delta, write nothing
 *   node scripts/sync.mjs --offline        # use cache only; error if absent
 *   node scripts/sync.mjs --offline-ok     # use cache only; silent no-op if absent
 *
 * Reproducible: same lucide version in => identical generated output out.
 *
 * Sources (per lucide version V):
 *   - lucide-static-V.tgz  -> package/icon-nodes.json            (kebab -> node tuples)
 *   - lucide-V.tgz         -> package/dist/esm/iconsAndAliases.mjs (name -> kebab map)
 *
 * Removed-upstream rule: icons that existed in a previously synced dataset but
 * no longer exist upstream are NEVER deleted from src/icons/. They are kept
 * with a "deprecated upstream" header comment and persisted in
 * scripts/seed-icons.json (single source of truth).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'lucide-legacy');
const SRC_ICONS_DIR = join(ROOT, 'src', 'icons');
const SEED_FILE = join(ROOT, 'scripts', 'seed-icons.json');
const SYNC_META_FILE = join(ROOT, 'sync-meta.json');
const REGISTRY = 'https://registry.npmjs.org';
const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g']);
const KEBAB_RE = /^[a-z0-9-]+$/;
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const ALIAS_RE = /export\s*\{\s*([^}]+)\s*\}\s*from\s*'\.\/icons\/([a-z0-9-]+)\.mjs'/g;

// Baseline of export names truly removed upstream (lucide 1.48.0 is NOT a
// superset of deprecated lucide-vue 0.517.0). Applied only on the FIRST sync
// (when scripts/seed-icons.json does not yet exist); afterwards
// scripts/seed-icons.json is the single source of truth.
const SEED_BASELINE = {
  "chrome": {
    "exportNames": [
      "Chrome"
    ],
    "iconName": "ChromeIcon",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "4"
        }
      ],
      [
        "line",
        {
          "x1": "21.17",
          "x2": "12",
          "y1": "8",
          "y2": "8"
        }
      ],
      [
        "line",
        {
          "x1": "3.95",
          "x2": "8.54",
          "y1": "6.06",
          "y2": "14"
        }
      ],
      [
        "line",
        {
          "x1": "10.88",
          "x2": "15.46",
          "y1": "21.94",
          "y2": "14"
        }
      ]
    ]
  },
  "codepen": {
    "exportNames": [
      "Codepen"
    ],
    "iconName": "CodepenIcon",
    "nodes": [
      [
        "polygon",
        {
          "points": "12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "22",
          "y2": "15.5"
        }
      ],
      [
        "polyline",
        {
          "points": "22 8.5 12 15.5 2 8.5"
        }
      ],
      [
        "polyline",
        {
          "points": "2 15.5 12 8.5 22 15.5"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "2",
          "y2": "8.5"
        }
      ]
    ]
  },
  "codesandbox": {
    "exportNames": [
      "Codesandbox"
    ],
    "iconName": "CodesandboxIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        }
      ],
      [
        "polyline",
        {
          "points": "7.5 4.21 12 6.81 16.5 4.21"
        }
      ],
      [
        "polyline",
        {
          "points": "7.5 19.79 7.5 14.6 3 12"
        }
      ],
      [
        "polyline",
        {
          "points": "21 12 16.5 14.6 16.5 19.79"
        }
      ],
      [
        "polyline",
        {
          "points": "3.27 6.96 12 12.01 20.73 6.96"
        }
      ],
      [
        "line",
        {
          "x1": "12",
          "x2": "12",
          "y1": "22.08",
          "y2": "12"
        }
      ]
    ]
  },
  "dribbble": {
    "exportNames": [
      "Dribbble"
    ],
    "iconName": "DribbbleIcon",
    "nodes": [
      [
        "circle",
        {
          "cx": "12",
          "cy": "12",
          "r": "10"
        }
      ],
      [
        "path",
        {
          "d": "M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94"
        }
      ],
      [
        "path",
        {
          "d": "M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32"
        }
      ],
      [
        "path",
        {
          "d": "M8.56 2.75c4.37 6 6 9.42 8 17.72"
        }
      ]
    ]
  },
  "facebook": {
    "exportNames": [
      "Facebook"
    ],
    "iconName": "FacebookIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
        }
      ]
    ]
  },
  "figma": {
    "exportNames": [
      "Figma"
    ],
    "iconName": "FigmaIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"
        }
      ],
      [
        "path",
        {
          "d": "M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"
        }
      ],
      [
        "path",
        {
          "d": "M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"
        }
      ],
      [
        "path",
        {
          "d": "M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"
        }
      ],
      [
        "path",
        {
          "d": "M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"
        }
      ]
    ]
  },
  "framer": {
    "exportNames": [
      "Framer"
    ],
    "iconName": "FramerIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M5 16V9h14V2H5l14 14h-7m-7 0 7 7v-7m-7 0h7"
        }
      ]
    ]
  },
  "github": {
    "exportNames": [
      "Github"
    ],
    "iconName": "GithubIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
        }
      ],
      [
        "path",
        {
          "d": "M9 18c-4.51 2-5-2-7-2"
        }
      ]
    ]
  },
  "gitlab": {
    "exportNames": [
      "Gitlab"
    ],
    "iconName": "GitlabIcon",
    "nodes": [
      [
        "path",
        {
          "d": "m22 13.29-3.33-10a.42.42 0 0 0-.14-.18.38.38 0 0 0-.22-.11.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18l-2.26 6.67H8.32L6.1 3.26a.42.42 0 0 0-.1-.18.38.38 0 0 0-.26-.08.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18L2 13.29a.74.74 0 0 0 .27.83L12 21l9.69-6.88a.71.71 0 0 0 .31-.83Z"
        }
      ]
    ]
  },
  "instagram": {
    "exportNames": [
      "Instagram"
    ],
    "iconName": "InstagramIcon",
    "nodes": [
      [
        "rect",
        {
          "width": "20",
          "height": "20",
          "x": "2",
          "y": "2",
          "rx": "5",
          "ry": "5"
        }
      ],
      [
        "path",
        {
          "d": "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"
        }
      ],
      [
        "line",
        {
          "x1": "17.5",
          "x2": "17.51",
          "y1": "6.5",
          "y2": "6.5"
        }
      ]
    ]
  },
  "linkedin": {
    "exportNames": [
      "Linkedin"
    ],
    "iconName": "LinkedinIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"
        }
      ],
      [
        "rect",
        {
          "width": "4",
          "height": "12",
          "x": "2",
          "y": "9"
        }
      ],
      [
        "circle",
        {
          "cx": "4",
          "cy": "4",
          "r": "2"
        }
      ]
    ]
  },
  "pocket": {
    "exportNames": [
      "Pocket"
    ],
    "iconName": "PocketIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M20 3a2 2 0 0 1 2 2v6a1 1 0 0 1-20 0V5a2 2 0 0 1 2-2z"
        }
      ],
      [
        "path",
        {
          "d": "m8 10 4 4 4-4"
        }
      ]
    ]
  },
  "rail-symbol": {
    "exportNames": [
      "RailSymbol"
    ],
    "iconName": "RailSymbolIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M5 15h14"
        }
      ],
      [
        "path",
        {
          "d": "M5 9h14"
        }
      ],
      [
        "path",
        {
          "d": "m14 20-5-5 6-6-5-5"
        }
      ]
    ]
  },
  "slack": {
    "exportNames": [
      "Slack"
    ],
    "iconName": "SlackIcon",
    "nodes": [
      [
        "rect",
        {
          "width": "3",
          "height": "8",
          "x": "13",
          "y": "2",
          "rx": "1.5"
        }
      ],
      [
        "path",
        {
          "d": "M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5"
        }
      ],
      [
        "rect",
        {
          "width": "3",
          "height": "8",
          "x": "8",
          "y": "14",
          "rx": "1.5"
        }
      ],
      [
        "path",
        {
          "d": "M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5"
        }
      ],
      [
        "rect",
        {
          "width": "8",
          "height": "3",
          "x": "14",
          "y": "13",
          "rx": "1.5"
        }
      ],
      [
        "path",
        {
          "d": "M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5"
        }
      ],
      [
        "rect",
        {
          "width": "8",
          "height": "3",
          "x": "2",
          "y": "8",
          "rx": "1.5"
        }
      ],
      [
        "path",
        {
          "d": "M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5"
        }
      ]
    ]
  },
  "trello": {
    "exportNames": [
      "Trello"
    ],
    "iconName": "TrelloIcon",
    "nodes": [
      [
        "rect",
        {
          "width": "18",
          "height": "18",
          "x": "3",
          "y": "3",
          "rx": "2",
          "ry": "2"
        }
      ],
      [
        "rect",
        {
          "width": "3",
          "height": "9",
          "x": "7",
          "y": "7"
        }
      ],
      [
        "rect",
        {
          "width": "3",
          "height": "5",
          "x": "14",
          "y": "7"
        }
      ]
    ]
  },
  "twitch": {
    "exportNames": [
      "Twitch"
    ],
    "iconName": "TwitchIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7"
        }
      ]
    ]
  },
  "twitter": {
    "exportNames": [
      "Twitter"
    ],
    "iconName": "TwitterIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"
        }
      ]
    ]
  },
  "youtube": {
    "exportNames": [
      "Youtube"
    ],
    "iconName": "YoutubeIcon",
    "nodes": [
      [
        "path",
        {
          "d": "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"
        }
      ],
      [
        "path",
        {
          "d": "m10 15 5-3-5-3z"
        }
      ]
    ]
  }
};

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { version: null, offline: false, offlineOk: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) fail(`--version requires a value (got ${v ?? 'nothing'})`);
      if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`--version must be semver X.Y.Z (got ${v})`);
      args.version = v;
    } else if (a === '--offline') args.offline = true;
    else if (a === '--offline-ok') args.offlineOk = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

function fail(msg) {
  console.error(`sync: error: ${msg}`);
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchTarball(url, destPath) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  return buf.byteLength;
}

/**
 * Extract a single member from a .tgz using system tar, into its own staging
 * dir under CACHE_DIR (tarballs all use a top-level `package/` dir, so
 * concurrent members of different packages must not share a target dir).
 */
function extractMember(tgzPath, memberName, staging, outPath) {
  if (existsSync(outPath)) return;
  const out = join(CACHE_DIR, staging);
  mkdirSync(out, { recursive: true });
  const memberDest = join(out, memberName);
  try {
    execFileSync('tar', ['-xzf', tgzPath, '-C', out, memberName], { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`system tar failed extracting ${memberName} from ${tgzPath}: ${err.stderr?.toString().trim() || err.message}`);
  }
  if (!existsSync(memberDest)) throw new Error(`member ${memberName} not found in ${tgzPath}`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, readFileSync(memberDest));
}

// ---------------------------------------------------------------------------
// Source resolution & download
// ---------------------------------------------------------------------------

function tarballFile(pkg, version) {
  return join(CACHE_DIR, `${pkg}-${version}.tgz`);
}

function cacheComplete(version) {
  return existsSync(tarballFile('lucide-static', version)) && existsSync(tarballFile('lucide', version));
}

async function ensureSources(version, args) {
  if (cacheComplete(version)) {
    console.log(`[cache] using cached tarballs for ${version}`);
    return;
  }
  if (args.offline || args.offlineOk) {
    console.error(`[offline] cache miss for lucide version ${version}; leaving committed src/ and dist/ unchanged.`);
    if (args.offline) process.exit(1); // strict
    process.exit(0);                   // --offline-ok: silent no-op
  }
  if (NODE_MAJOR < 18) {
    fail(`downloading lucide-${version} requires Node >= 18 (global fetch); running Node ${process.versions.node}. Run this sync on Node >= 18, or use --offline-ok (committed src/+dist/ are already present, so a plain install works without re-downloading).`);
  }
  const [staticPkg, lucidePkg] = await Promise.all([
    fetchJson(`${REGISTRY}/lucide-static`),
    fetchJson(`${REGISTRY}/lucide`),
  ]);
  const staticTar = staticPkg.versions?.[version]?.dist?.tarball;
  const lucideTar = lucidePkg.versions?.[version]?.dist?.tarball;
  if (!staticTar) fail(`lucide-static@${version} not found on npm`);
  if (!lucideTar) fail(`lucide@${version} not found on npm`);
  console.log(`[fetch] downloading ${staticTar}`);
  await fetchTarball(staticTar, tarballFile('lucide-static', version));
  console.log(`[fetch] downloading ${lucideTar}`);
  await fetchTarball(lucideTar, tarballFile('lucide', version));
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseIconNodes(text) {
  const nodes = JSON.parse(text);
  if (typeof nodes !== 'object' || nodes === null || Array.isArray(nodes)) {
    throw new Error('icon-nodes.json: expected a plain object mapping kebab name -> node array');
  }
  return nodes;
}

function parseAliases(text) {
  ALIAS_RE.lastIndex = 0;
  const byKebab = new Map();
  let m;
  while ((m = ALIAS_RE.exec(text)) !== null) {
    const names = m[1].split(',').map((s) => s.trim()).map((s) => s.replace(/^default\s+as\s+/, ''));
    if (byKebab.has(m[2])) throw new Error(`iconsAndAliases.mjs: duplicate kebab entry '${m[2]}'`);
    byKebab.set(m[2], names);
  }
  if (byKebab.size === 0) throw new Error('iconsAndAliases.mjs: no export lines matched');
  return byKebab;
}

// ---------------------------------------------------------------------------
// Node serialization / file emission
// ---------------------------------------------------------------------------

/** Strip the decorative `key` attribute if present (upstream 1.x may add it). */
function cleanNodes(rawNodes) {
  return rawNodes.map((node) => {
    const [tag, attrs] = node;
    const cleaned = { ...attrs };
    delete cleaned.key;
    return [tag, cleaned];
  });
}

/**
 * Pretty-serialize a node array exactly like the published 0.517.0 files:
 * 2-space indent, each node as a two-element ["tag", {...}] tuple, attr
 * object keys UNQUOTED (d: "..." / transform: "..."), values double-quoted.
 */
function serializeNodes(nodes) {
  const lines = [];
  lines.push('[');
  nodes.forEach((node, i) => {
    const [tag, attrs] = node;
    const keys = Object.keys(attrs);
    const attrStr = keys.length === 0
      ? '{}'
      : '{\n' + keys.map((k, j) =>
        `    ${k}: ${JSON.stringify(attrs[k])}${j < keys.length - 1 ? ',' : ''}`
      ).join('\n') + '\n  }';
    const comma = i < nodes.length - 1 ? ',' : '';
    lines.push(`  ["${tag}", ${attrStr}]${comma}`);
  });
  lines.push(']');
  return lines.join('\n');
}

function licenseHeader(version) {
  return [
    '/**',
    ` * @license lucide-vue v${version} - ISC`,
    ' *',
    ' * This source code is licensed under the ISC license.',
    " * See the LICENSE file in the root directory of this source tree.",
    ' */',
    '',
  ].join('\n');
}

function iconFileContent(record, version) {
  const parts = [licenseHeader(version)];
  if (record.seeded) parts.push('/* deprecated upstream */', '');
  parts.push("import createLucideIcon from '../createLucideIcon.js';", '');
  parts.push(`const ${record.primary} = createLucideIcon("${record.iconName}", ${serializeNodes(record.nodes)});`);
  parts.push('', `export { ${record.primary} as default };`, '');
  return parts.join('\n');
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRecord(record, issues) {
  const label = `${record.kebab} (${record.primary})`;
  if (!KEBAB_RE.test(record.kebab)) issues.push(`${label}: kebab name fails /^[a-z0-9-]+$/`);
  for (const name of [record.primary, ...record.aliases]) {
    if (!NAME_RE.test(name)) issues.push(`${label}: export name '${name}' is not a valid PascalCase JS identifier`);
  }
  if (!Array.isArray(record.nodes) || record.nodes.length === 0) {
    issues.push(`${label}: node array is empty or not an array`);
    return;
  }
  record.nodes.forEach((node, i) => {
    if (!Array.isArray(node) || node.length !== 2) {
      issues.push(`${label}: node[${i}] is not a two-element [tag, attrs] array`);
      return;
    }
    const [tag, attrs] = node;
    if (typeof tag !== 'string' || !ALLOWED_TAGS.has(tag)) {
      issues.push(`${label}: node[${i}] tag ${JSON.stringify(tag)} not in ${[...ALLOWED_TAGS].join('|')}`);
    }
    if (typeof attrs !== 'object' || attrs === null || Array.isArray(attrs)) {
      issues.push(`${label}: node[${i}] attrs is not a plain object`);
    } else {
      for (const [k, v] of Object.entries(attrs)) {
        if (typeof v !== 'string' && typeof v !== 'number') {
          issues.push(`${label}: node[${i}] attr '${k}' has non-string/number value ${JSON.stringify(v)}`);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Seed store
// ---------------------------------------------------------------------------

function loadSeedStore() {
  if (existsSync(SEED_FILE)) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
    } catch (err) {
      fail(`seed store ${SEED_FILE} is corrupt: ${err.message}`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('seed store must be a JSON object keyed by kebab name');
    return { entries: raw, fromBaseline: false };
  }
  // FIRST sync: seed from the embedded baseline.
  console.log('[seed] first sync (no scripts/seed-icons.json) — seeding baseline of 18 removed icons');
  const entries = {};
  for (const [kebab, s] of Object.entries(SEED_BASELINE)) {
    entries[kebab] = {
      exportNames: [...s.exportNames],
      iconName: s.iconName,
      nodes: cleanNodes(s.nodes),
    };
  }
  return { entries, fromBaseline: true };
}

function seedRecordsFromStore(store, liveKebabs, liveExportNames, dryRun) {
  const records = [];
  const keep = {};
  for (const [kebab, s] of Object.entries(store.entries)) {
    if (!KEBAB_RE.test(kebab)) fail(`seed store: bad kebab name '${kebab}'`);
    const exportNames = Array.isArray(s.exportNames) ? s.exportNames : null;
    if (!exportNames || exportNames.length === 0) fail(`seed store '${kebab}': exportNames missing/empty`);
    const primary = exportNames[0];
    // Upstream re-added this name: prefer live data, drop from the seed store.
    if (liveExportNames.has(primary)) {
      console.log(`[seed] dropping '${kebab}' from seed store — upstream re-added '${primary}'`);
      continue;
    }
    if (liveKebabs.has(kebab)) {
      console.log(`[seed] dropping '${kebab}' from seed store — upstream re-added the kebab name`);
      continue;
    }
    keep[kebab] = {
      exportNames: [...exportNames],
      iconName: s.iconName ?? `${primary}Icon`,
      nodes: cleanNodes(s.nodes),
    };
    records.push({
      kebab,
      primary,
      aliases: exportNames.slice(1),
      iconName: s.iconName ?? `${primary}Icon`,
      nodes: cleanNodes(s.nodes),
      seeded: true,
    });
  }
  if (!dryRun) {
    // Persist the current removed-but-kept set (single source of truth).
    const sorted = {};
    for (const k of Object.keys(keep).sort()) sorted[k] = keep[k];
    writeFileSync(SEED_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  }
  return records;
}

// ---------------------------------------------------------------------------
// Delta vs existing src/icons/
// ---------------------------------------------------------------------------

function readExistingIconFiles() {
  const existing = new Map(); // kebab -> { hash, content }
  if (!existsSync(SRC_ICONS_DIR)) return existing;
  for (const f of readdirSync(SRC_ICONS_DIR)) {
    if (!f.endsWith('.js')) continue;
    const content = readFileSync(join(SRC_ICONS_DIR, f), 'utf8');
    existing.set(f.replace(/\.js$/, ''), { hash: sha256(content), content });
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('usage: node scripts/sync.mjs [--version X.Y.Z] [--dry-run] [--offline | --offline-ok]');
    return;
  }

  // 1. Resolve version
  //
  // In offline mode (--offline / --offline-ok) we must NOT hit the network —
  // and we must NOT use global `fetch` (only defined on Node >= 18). So offline
  // mode resolves the version purely from local state (a --version arg, else the
  // committed sync-meta.json), then lets ensureSources() do the cache check. If
  // the cache is incomplete, ensureSources() exits (0 for --offline-ok) before
  // any network call. This is what makes the `prepare` hook safe to run on a
  // fresh clone / consumer Node (< 18, no network) — it no-ops instead of
  // crashing with "fetch is not defined".
  let version = args.version;
  const offline = args.offline || args.offlineOk;

  if (!version && offline) {
    try {
      const meta = JSON.parse(readFileSync(SYNC_META_FILE, 'utf8'));
      version = meta.lucideVersion;
    } catch { /* no committed sync-meta.json — stay versionless and let ensureSources no-op */ }
    if (version) {
      console.log(`[offline] resolving version from sync-meta.json: ${version}`);
    } else {
      console.log('[offline] no --version given and no sync-meta.json; no-op.');
      process.exit(args.offline ? 1 : 0);
    }
  }

  if (!version) {
    // Online path: query the registry for `latest`. Requires Node >= 18 (fetch).
    if (NODE_MAJOR < 18) {
      fail(`resolving 'latest' online requires Node >= 18 (global fetch); running Node ${process.versions.node}. Use --version X.Y.Z (with cache) or --offline-ok.`);
    }
    const [staticPkg, lucidePkg] = await Promise.all([
      fetchJson(`${REGISTRY}/lucide-static`),
      fetchJson(`${REGISTRY}/lucide`),
    ]);
    version = staticPkg['dist-tags']?.latest;
    if (!version) fail('lucide-static registry has no dist-tags.latest');
    const lucideLatest = lucidePkg['dist-tags']?.latest;
    if (lucideLatest !== version) {
      fail(`version mismatch: lucide-static latest is ${version} but lucide latest is ${lucideLatest}`);
    }
    console.log(`[version] no --version given; using upstream latest ${version}`);
  }

  // 2. Ensure tarballs (cache or download), then extract the two needed members
  await ensureSources(version, args);
  const staticOut = join(CACHE_DIR, 'lucide-static', 'icon-nodes.json');
  const aliasOut = join(CACHE_DIR, 'lucide', 'iconsAndAliases.mjs');
  extractMember(tarballFile('lucide-static', version), 'package/icon-nodes.json', 'lucide-static', staticOut);
  extractMember(tarballFile('lucide', version), 'package/dist/esm/iconsAndAliases.mjs', 'lucide', aliasOut);

  // 3. Parse sources
  const iconNodes = parseIconNodes(readFileSync(staticOut, 'utf8'));
  const aliasMap = parseAliases(readFileSync(aliasOut, 'utf8'));

  // Build live records (every kebab must appear in BOTH sources)
  const records = [];
  const liveKebabs = new Set();
  const liveExportNames = new Set();
  const parseIssues = [];
  for (const kebab of Object.keys(iconNodes)) {
    const names = aliasMap.get(kebab);
    if (!names) {
      parseIssues.push(`kebab '${kebab}' in icon-nodes.json but has no iconsAndAliases.mjs export line`);
      continue;
    }
    liveKebabs.add(kebab);
    const [primary, ...aliases] = names;
    for (const n of names) liveExportNames.add(n);
    records.push({
      kebab,
      primary,
      aliases,
      iconName: `${primary}Icon`,
      nodes: cleanNodes(iconNodes[kebab]),
      seeded: false,
    });
  }
  for (const kebab of aliasMap.keys()) {
    if (!iconNodes[kebab]) parseIssues.push(`kebab '${kebab}' in iconsAndAliases.mjs but missing from icon-nodes.json`);
  }

  // Seeds (first sync: from baseline; afterwards: scripts/seed-icons.json)
  const store = loadSeedStore();
  const seedRecords = seedRecordsFromStore(store, liveKebabs, liveExportNames, args.dryRun);
  records.push(...seedRecords);

  // 4. Validate
  const issues = [];
  for (const rec of records) validateRecord(rec, issues);
  // Duplicate export names across the whole entry surface?
  const nameCount = new Map();
  for (const rec of records) for (const n of [rec.primary, ...rec.aliases]) nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
  for (const [n, c] of nameCount) if (c > 1) issues.push(`export name '${n}' is emitted ${c} times (duplicate)`);

  if (issues.length > 0) {
    console.error(`\nsync: VALIDATION FAILED (${issues.length} issue${issues.length === 1 ? '' : 's'}):\n`);
    const shown = issues.slice(0, 50);
    for (const i of shown) console.error(`  - ${i}`);
    if (issues.length > shown.length) console.error(`  ... and ${issues.length - shown.length} more`);
    console.error('\nFix the upstream data interpretation or the sources, then re-run.');
    process.exit(1);
  }

  // 5. Delta vs existing src/icons/
  const existing = readExistingIconFiles();
  const targetFiles = new Map();
  for (const rec of records) targetFiles.set(rec.kebab, { content: iconFileContent(rec, version) });

  const added = [];
  const removed = []; // previously shipped icon files no longer in the target set (kept on disk)
  const unchanged = [];
  const changed = [];
  for (const [kebab, { content }] of targetFiles) {
    const prev = existing.get(kebab);
    if (!prev) added.push(kebab);
    else if (prev.hash === sha256(content)) unchanged.push(kebab);
    else changed.push(kebab);
  }
  for (const kebab of existing.keys()) {
    if (kebab === 'index') continue; // barrel file, not an icon
    if (!targetFiles.has(kebab)) removed.push(kebab);
  }

  // 6-10. Emit files
  const indexLines = records.slice().sort((a, b) => a.kebab < b.kebab ? -1 : a.kebab > b.kebab ? 1 : 0)
    .map((rec) => `export { default as ${rec.primary} } from './${rec.kebab}.js';`);
  const indexContent = licenseHeader(version) + indexLines.join('\n') + '\n';
  const aliasesContent = licenseHeader(version) + records.slice().sort((a, b) => a.kebab < b.kebab ? -1 : a.kebab > b.kebab ? 1 : 0)
    .map((rec) => `export { default as ${[rec.primary, ...rec.aliases].join(', default as ')} } from './icons/${rec.kebab}.js';`)
    .join('\n') + '\n';

  const deltaOut = [
    `sync delta (lucide v${version}) vs src/icons/:`,
    `  added:     ${added.length}`,
    `  removed:   ${removed.length} (kept on disk with '/* deprecated upstream */' header)`,
    `  unchanged: ${unchanged.length}`,
    `  changed:   ${changed.length} (data updated in place)`,
    `  total to emit: ${targetFiles.size} files (${records.length - seedRecords.length} live + ${seedRecords.length} seeded)`,
  ];
  if (added.length) deltaOut.push(`  added sample: ${added.sort().slice(0, 10).join(', ')}${added.length > 10 ? `, ... (+${added.length - 10} more)` : ''}`);
  if (removed.length) deltaOut.push(`  removed sample: ${removed.sort().slice(0, 10).join(', ')}`);
  if (changed.length) deltaOut.push(`  changed sample: ${changed.sort().slice(0, 10).join(', ')}${changed.length > 10 ? `, ... (+${changed.length - 10} more)` : ''}`);

  if (args.dryRun) {
    console.log(deltaOut.join('\n'));
    console.log(`\n[dry-run] no files written. Would write:\n`);
    console.log(`  ${targetFiles.size} files under src/icons/ (incl. index.js)`);
    console.log(`  src/aliases.js`);
    console.log(`  scripts/seed-icons.json (${Object.keys(store.entries).length} seeded entries, ${seedRecords.length} kept after re-add filter)`);
    console.log(`  sync-meta.json`);
    console.log(`  package.json version -> ${nextVersion(version)}`);
    return;
  }

  console.log(deltaOut.join('\n'));

  // Write everything
  mkdirSync(SRC_ICONS_DIR, { recursive: true });
  for (const [kebab, { content }] of targetFiles) writeFileSync(join(SRC_ICONS_DIR, `${kebab}.js`), content, 'utf8');
  writeFileSync(join(SRC_ICONS_DIR, 'index.js'), indexContent, 'utf8');
  writeFileSync(join(ROOT, 'src', 'aliases.js'), aliasesContent, 'utf8');

  // package.json version: replace leading lucide version, keep existing -legacy.N
  writeFileSync(SYNC_META_FILE, JSON.stringify({
    lucideVersion: version,
    syncedAt: new Date().toISOString(),
    icons: targetFiles.size,
    added: added.length,
    removed: removed.length,
  }, null, 2) + '\n', 'utf8');

  const pkgRaw = readFileSync(join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const m = pkg.version?.match(/^(\d+\.\d+\.\d+)(-legacy\.\d+)?$/);
  if (!m) fail(`cannot derive legacy version from package.json version ${JSON.stringify(pkg.version)} (expected X.Y.Z[-legacy.N])`);
  pkg.version = `${version}${m[2] ?? '-legacy.1'}`;
  writeFileSync(join(ROOT, 'package.json'), JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  console.log(`\nsync: wrote ${targetFiles.size} icon files + index.js + aliases.js`);
  console.log(`sync: seed store: ${SEED_FILE} (${Object.keys(store.entries).length} entries, ${seedRecords.length} active)`);
  console.log(`sync: package.json version -> ${pkg.version}`);
  console.log(`sync: sync-meta.json written`);
}

function nextVersion(version) {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const m = pkg.version?.match(/^(\d+\.\d+\.\d+)(-legacy\.\d+)?$/);
    return `${version}${m?.[2] ?? '-legacy.1'}`;
  } catch {
    return `${version}-legacy.1`;
  }
}

main().catch((err) => {
  console.error(`sync: fatal: ${err.stack || err.message}`);
  process.exit(1);
});
