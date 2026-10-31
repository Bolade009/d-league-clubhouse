'use strict';

// Read-only boot guard. Never creates, replaces, or copies live league data.
// When configured, a deploy cannot serve an empty fresh directory as a new league.
const fs = require('node:fs');
const path = require('node:path');

function nonnegativeFloor(value, name) {
  if (value == null || String(value).trim() === '') return 0;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(name + ' must be a nonnegative integer');
  return n;
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function collectionLength(snapshot, name) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  if (Array.isArray(snapshot)) return snapshot.length;
  return Array.isArray(snapshot[name]) ? snapshot[name].length : 0;
}

function persistedCounts(dataDir) {
  const counts = { managers: 0, payments: 0, ledger: 0 };
  const backupsDir = path.join(dataDir, 'backups');
  const snapshots = [
    path.join(dataDir, 'current-state.json'),
    path.join(backupsDir, 'store-latest.json'),
    path.join(backupsDir, 'store-best.json')
  ];
  for (const file of snapshots) {
    const parsed = readJSON(file);
    if (parsed) for (const name of Object.keys(counts)) {
      counts[name] = Math.max(counts[name], collectionLength(parsed, name));
    }
  }
  for (const name of Object.keys(counts)) {
    counts[name] = Math.max(counts[name],
      collectionLength(readJSON(path.join(dataDir, 'current-' + name + '.json')), name));
  }
  // SQLite may be the only surviving source after a partial disk or JSON-sidecar failure.
  const dbPath = path.join(dataDir, 'dleague.db');
  if (fs.existsSync(dbPath)) {
    let db;
    try {
      const Database = require('better-sqlite3');
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      for (const name of Object.keys(counts)) {
        const row = db.prepare('SELECT value FROM store WHERE key = ?').get(name);
        if (row) counts[name] = Math.max(counts[name],
          collectionLength(JSON.parse(row.value), name));
      }
    } catch (e) {
      console.warn('[DATA PROTECTION] Read-only SQLite check unavailable:', e.message);
    } finally {
      try { if (db) db.close(); } catch {}
    }
  }
  return counts;
}

function enforcePersistedDataFloor(dataDir, env = process.env, demoMode = false) {
  if (demoMode) return { checked: false, reason: 'demo mode' };
  const expected = {
    // This is a live, already-populated league. A blank admin-only datastore must not serve production.
    // Operators can raise floors to known pre-deploy counts, or explicitly set 0 for a new installation.
    managers: nonnegativeFloor(env.DLEAGUE_MIN_MANAGERS ?? '2', 'DLEAGUE_MIN_MANAGERS'),
    payments: nonnegativeFloor(env.DLEAGUE_MIN_PAYMENTS ?? '1', 'DLEAGUE_MIN_PAYMENTS'),
    ledger: nonnegativeFloor(env.DLEAGUE_MIN_LEDGER ?? '1', 'DLEAGUE_MIN_LEDGER')
  };
  if (!Object.values(expected).some(Boolean)) return { checked: false, reason: 'no protection floor configured' };
  const actual = persistedCounts(dataDir);
  const violations = Object.keys(expected).filter(name => actual[name] < expected[name]);
  if (violations.length) {
    throw new Error('[DATA PROTECTION] Refusing boot: persistent data below deployment baseline: ' +
      violations.map(name => name + '=' + actual[name] + ' (expected at least ' + expected[name] + ')').join(', ') +
      '. Confirm the Render disk mount and DATA_DIR; restore from an independent verified backup if needed.');
  }
  return { checked: true, actual, expected };
}

module.exports = { persistedCounts, enforcePersistedDataFloor };
