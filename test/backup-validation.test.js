'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { snapshotCounts, validateSnapshot } = require('../backup-validation');
const record = id => ({ id: String(id), email: 'person' + id + '@example.invalid' });
const backup = () => ({
  managers: [record(1), record(2)],
  payments: [{ id: 'pay1', amount: 30000, status: 'confirmed' }],
  ledger: [{ id: 'led1', amount: 8000 }],
  settings: { deletedManagerIds: [] }
});

test('summarizes complete backups', () => {
  assert.deepEqual(snapshotCounts(backup()), { managers: 2, payments: 1, ledger: 1 });
  assert.deepEqual(validateSnapshot(backup()), { managers: 2, payments: 1, ledger: 1 });
});
test('rejects incomplete and admin-only snapshots', () => {
  const bad = backup();
  delete bad.ledger;
  assert.throws(() => validateSnapshot(bad), /FULL/);
  const empty = backup(); empty.managers = [record(1)];
  assert.throws(() => validateSnapshot(empty), /fewer than two/);
});
test('refuses to lose live manager, payment or ledger records', () => {
  const existing = backup();
  const older = backup();
  older.payments = [];
  assert.throws(() => validateSnapshot(older, existing), /missing 1 current payments/);
  older.payments = existing.payments;
  older.ledger = [];
  assert.throws(() => validateSnapshot(older, existing), /missing 1 current ledger/);
  older.ledger = existing.ledger;
  older.managers = [record(2), record(3)];
  assert.throws(() => validateSnapshot(older, existing), /missing 1 current managers/);
});
test('refuses to resurrect deleted managers from older snapshots', () => {
  const existing = backup();
  existing.settings.deletedManagerIds = ['deleted_mgr_123'];
  assert.throws(() => validateSnapshot(backup(), existing), /older than current manager deletion/);
});
test('allows full recovery of an ephemeral admin-only database', () => {
  const current = { managers: [{ id:'temp_admin', email:'bolade.oladejo@gmail.com' }], payments:[], ledger:[], settings:{} };
  assert.deepEqual(validateSnapshot(backup(), current, true), { managers:2, payments:1, ledger:1 });
});
