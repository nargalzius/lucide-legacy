// Node 26's test runner only auto-discovers files named test[.-]*.* or
// *.test.* inside non-`test` directories; `smoke.mjs` does not match, so
// `node --test tests/` (npm test) would find 0 files. This one-line shim
// imports the real test file so its node:test() registrations run under
// the standard discovery pattern.
await import('./smoke.mjs');
