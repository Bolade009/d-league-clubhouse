'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('production restart preserves full saved state when manager atomics tie with full sidecar', { timeout: 25000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dleague-boot-recovery-'));
  const port = await freePort();
  const managers = [
    { id: 'mgr_test_alpha', displayName: 'Example Alpha', email: 'alpha@example.invalid', accessCode: 'test-only', fpl: { teamId: '1809490' } },
    { id: 'mgr_test_beta', displayName: 'Example Beta', email: 'beta@example.invalid', accessCode: 'test-only', fpl: { teamId: '3724900' } }
  ];
  const payments = [{ id: 'pay_test_1', managerId: managers[0].id, competition: 'fpl', amount: 30000, status: 'confirmed', reference: 'test-only-ref' }];
  const ledger = [{ id: 'ldg_test_1', managerId: managers[0].id, competition: 'fpl', round: 8, type: 'manual_credit', amount: 321 }];
  const settings = { seasonName: 'TEST SEASON PERSISTENCE', currentRound: { fpl: 9, ucl: 4 },
    leagueIds: { fplClassic: '', fplH2h: '346910', ucl: '' }, totalFplRevenue: 30000, testSentinel: 'saved-settings-preserved' };
  const sample = { managers, payments, ledger, settings, scores: [], events: [], h2h: [], beefs: [], sponsorships: [] };

  fs.writeFileSync(path.join(dir, 'current-state.json'), JSON.stringify(sample));
  // This is the actual regression: an equal-sized managers-only atomic must NOT win
  // over the complete sidecar and overwrite payments, ledger and settings.
  fs.writeFileSync(path.join(dir, 'current-managers.json'), JSON.stringify(managers));

  let logs = '';
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', DEMO_MODE: 'false', PORT: String(port), DATA_DIR: dir,
      EXPORT_TOKEN: 'TEST_ONLY_EXPORT_TOKEN', SYNC_TOKEN: 'TEST_ONLY_SYNC_TOKEN',
      DLEAGUE_MIN_MANAGERS: '2', DLEAGUE_MIN_PAYMENTS: '1', DLEAGUE_MIN_LEDGER: '1',
      PAYSTACK_SECRET_KEY: '', PAYSTACK_PUBLIC_KEY: '', SMTP_HOST: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', d => { logs += d.toString().slice(0, 20000); });
  child.stderr.on('data', d => { logs += d.toString().slice(0, 20000); });
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGTERM');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  let healthy = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) break;
    try {
      const health = await fetch('http://127.0.0.1:' + port + '/health',
        { signal: AbortSignal.timeout(450) });
      if (health.ok) { healthy = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(healthy, 'Server failed to boot: ' + logs.slice(-3000));

  const exported = await fetch('http://127.0.0.1:' + port + '/api/export/full',
    { headers: { 'x-export-token': 'TEST_ONLY_EXPORT_TOKEN' }, signal: AbortSignal.timeout(2000) });
  assert.equal(exported.status, 200);
  const state = await exported.json();
  assert.equal(state.settings.testSentinel, 'saved-settings-preserved');
  assert.equal(state.settings.totalFplRevenue, 30000);
  assert.equal(state.settings.leagueIds.fplH2h, '346910');
  assert.ok(state.managers.some(m => m.email === 'alpha@example.invalid'));
  assert.ok(state.managers.some(m => m.email === 'beta@example.invalid'));
  assert.ok(state.payments.some(p => p.id === 'pay_test_1'));
  assert.ok(state.ledger.some(p => p.id === 'ldg_test_1'));
  console.log('INTEGRATION: surviving managers=' + state.managers.length +
    ', payments=' + state.payments.length + ', ledger=' + state.ledger.length +
    ', settings preserved');
});
