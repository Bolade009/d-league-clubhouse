'use strict';

// Validate complete DLeague backup snapshots before making any persistent writes.
function snapshotCounts(data) {
  return {
    managers: Array.isArray(data && data.managers) ? data.managers.length : 0,
    payments: Array.isArray(data && data.payments) ? data.payments.length : 0,
    ledger: Array.isArray(data && data.ledger) ? data.ledger.length : 0
  };
}

function validateSnapshot(data, existing = null, inRecovery = false) {
  if (!data || Array.isArray(data) || typeof data !== 'object' ||
      !Array.isArray(data.managers) || !Array.isArray(data.payments) ||
      !Array.isArray(data.ledger) || !data.settings ||
      Array.isArray(data.settings) || typeof data.settings !== 'object') {
    throw new Error('Backup must include managers, payments, ledger and settings from a FULL DLeague export');
  }
  const counts = snapshotCounts(data);
  if (counts.managers < 2) throw new Error('Backup contains fewer than two managers; refusing admin-only recovery');
  if (!data.managers.every(m => m && m.id && m.email) ||
      !data.payments.every(p => p && p.id) ||
      !data.ledger.every(l => l && l.id)) {
    throw new Error('Backup has incomplete manager, payment or ledger records');
  }
  const seenEmails = new Set();
  for (const manager of data.managers) {
    const email = String(manager.email).toLowerCase();
    if (seenEmails.has(email)) throw new Error('Backup contains duplicate manager emails');
    seenEmails.add(email);
  }
  if (existing && !inRecovery) {
    // Prevent an older file from removing legitimate live records.
    for (const key of ['managers', 'payments', 'ledger']) {
      const present = new Set(data[key].map(item => String(item.id)));
      const missing = (existing[key] || []).filter(item => item && item.id && !present.has(String(item.id)));
      // A freshly seeded admin after an ephemeral restart is allowed to change ID.
      const relevant = key === 'managers'
        ? missing.filter(m => String(m.email || '').toLowerCase() !== 'bolade.oladejo@gmail.com')
        : missing;
      if (relevant.length) {
        throw new Error('Uploaded backup is missing ' + relevant.length + ' current ' + key +
          ' records. Download a newer full backup before restoring.');
      }
    }
    const priorDeletes = (existing.settings && existing.settings.deletedManagerIds) || [];
    const incomingDeletes = new Set(data.settings.deletedManagerIds || []);
    if (priorDeletes.some(id => !incomingDeletes.has(id))) {
      throw new Error('Uploaded backup is older than current manager deletion records');
    }
  }
  return counts;
}

module.exports = { snapshotCounts, validateSnapshot };
