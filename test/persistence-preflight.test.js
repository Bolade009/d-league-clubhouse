'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { enforcePersistedDataFloor, persistedCounts } = require('../persistence-preflight');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dleague-preflight-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const recs = n => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test('refuses production boot with a fresh empty disk and configured baseline', t => {
  const dir = tempDir(t);
  assert.throws(() => enforcePersistedDataFloor(dir,
    { DLEAGUE_MIN_MANAGERS: '2', DLEAGUE_MIN_PAYMENTS: '1', DLEAGUE_MIN_LEDGER: '1' }),
    /DATA PROTECTION.*managers=0/);
});

test('accepts preserved state from atomic snapshots and backup files', t => {
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, 'current-managers.json'), JSON.stringify(recs(43)));
  fs.writeFileSync(path.join(dir, 'current-payments.json'), JSON.stringify(recs(30)));
  const backup = path.join(dir, 'backups');
  fs.mkdirSync(backup);
  fs.writeFileSync(path.join(backup, 'store-latest.json'), JSON.stringify({ managers: recs(43), ledger: recs(41) }));
  assert.deepEqual(persistedCounts(dir), { managers: 43, payments: 30, ledger: 41 });
  const result = enforcePersistedDataFloor(dir,
    { DLEAGUE_MIN_MANAGERS: '2', DLEAGUE_MIN_PAYMENTS: '1', DLEAGUE_MIN_LEDGER: '1' });
  assert.equal(result.checked, true);
});

test('requires all configured data collections to meet their floors', t => {
  const dir = tempDir(t);
  fs.writeFileSync(path.join(dir, 'current-managers.json'), JSON.stringify(recs(43)));
  assert.throws(() => enforcePersistedDataFloor(dir,
    { DLEAGUE_MIN_MANAGERS: '2', DLEAGUE_MIN_PAYMENTS: '5', DLEAGUE_MIN_LEDGER: '5' }),
    /payments=0/);
});

test('demo mode and unconfigured production do not block boot', t => {
  const dir = tempDir(t);
  assert.equal(enforcePersistedDataFloor(dir, { DLEAGUE_MIN_MANAGERS: 2 }, true).checked, false);
  assert.equal(enforcePersistedDataFloor(dir, {}, false).checked, false);
});

test('rejects malformed deployment floors instead of silently disabling checks', t => {
  const dir = tempDir(t);
  assert.throws(() => enforcePersistedDataFloor(dir, { DLEAGUE_MIN_MANAGERS: 'abc' }), /nonnegative integer/);
});
