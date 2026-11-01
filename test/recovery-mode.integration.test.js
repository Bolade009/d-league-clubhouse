'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const s = net.createServer();
  await new Promise((resolve, reject) => s.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Render Free empty disk starts normally and still allows full backup upload', { timeout: 25000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dleague-restore-'));
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  let logs = '';
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV:'production', DEMO_MODE:'false',
      DATA_DIR:dir, PORT:String(port), DLEAGUE_EPHEMERAL_RECOVERY:'true',
      SYNC_TOKEN:'TEST_ONLY_SYNC_TOKEN', EXPORT_TOKEN:'TEST_ONLY_EXPORT_TOKEN',
      ADMIN_ACCESS_CODE:'TEST_ONLY_ADMIN_CODE',
      DLEAGUE_MIN_MANAGERS:'2', DLEAGUE_MIN_PAYMENTS:'1', DLEAGUE_MIN_LEDGER:'1',
      PAYSTACK_SECRET_KEY:'', PAYSTACK_PUBLIC_KEY:'', SMTP_HOST:'' },
    stdio:['ignore','pipe','pipe']
  });
  server.stdout.on('data', d => { logs += d.toString().slice(0, 20000); });
  server.stderr.on('data', d => { logs += d.toString().slice(0, 20000); });
  t.after(() => {
    if (server.exitCode === null) server.kill('SIGTERM');
    fs.rmSync(dir, { recursive:true, force:true });
  });
  let ready = false;
  for(let i=0;i<90;i++){
    if(server.exitCode !== null) break;
    try {
      const r = await fetch(base+'/health',{signal:AbortSignal.timeout(400)});
      if(r.ok){ ready=true; break; }
    }catch{}
    await sleep(100);
  }
  assert.ok(ready, 'Server failed to start recovery: '+logs.slice(-2800));
  let response = await fetch(base+'/api/recovery/status');
  assert.equal(response.status,200);
  let status = await response.json();
  assert.equal(status.recoveryRequired,false);

  response = await fetch(base+'/api/community');
  assert.equal(response.status,200,'Normal league API must be accessible with an empty DB');
  response = await fetch(base+'/api/paystack/webhook', {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'charge.success'})});
  assert.notEqual(response.status,503,'No recovery-mode shutdown of payment API');

  const backup = {
    managers:[
      { id:'mgr_test_alpha', email:'alpha@example.invalid', displayName:'Example Alpha', accessCode:'test-only', fpl:{teamId:'1809490'}, ucl:{} },
      { id:'mgr_test_beta', email:'beta@example.invalid', displayName:'Example Beta', accessCode:'test-only', fpl:{teamId:'3724900'}, ucl:{} }
    ],
    payments:[{id:'payment_test_1',managerId:'mgr_test_alpha',competition:'fpl',amount:30000,status:'confirmed',reference:'test-only'}],
    ledger:[{id:'ledger_test_1',managerId:'mgr_test_alpha',competition:'fpl',amount:325,round:8,type:'manual_credit'}],
    settings:{seasonName:'BACKUP VALIDATED',currentRound:{fpl:9,ucl:4},leagueIds:{fplClassic:'',fplH2h:'346910',ucl:''},
      totalFplRevenue:30000, lastPersistedAt:'2026-10-31T23:00:00.000Z', testSentinel:'backup-recovered'},
    scores:[],events:[],beefs:[],sponsorships:[],h2h:[],challenges:[]
  };

  // Real commissioner file-upload flow: log in, then present private export token.
  let loginResponse = await fetch(base+'/api/auth/login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'bolade.oladejo@gmail.com',code:'TEST_ONLY_ADMIN_CODE'})
  });
  assert.equal(loginResponse.status,200);
  const login=await loginResponse.json();
  assert.ok(login.token);
  response=await fetch(base+'/api/export/full',{headers:{'x-export-token':'TEST_ONLY_EXPORT_TOKEN'}});
  assert.equal(response.status,200,'Normal export route must be available');
  response = await fetch(base+'/api/admin/restore-from-export', {
    method:'POST',headers:{'Authorization':'Bearer '+login.token,'Content-Type':'application/json'},
    body:JSON.stringify({data:backup})
  });
  assert.equal(response.status,403,'Backup upload requires separate private export token');
  response = await fetch(base+'/api/admin/restore-from-export', {
    method:'POST',
    headers:{'Authorization':'Bearer '+login.token,'x-export-token':'TEST_ONLY_EXPORT_TOKEN','Content-Type':'application/json'},
    body:JSON.stringify({data:backup})
  });
  const body = await response.json();
  assert.equal(response.status,200, 'Restore failed: '+JSON.stringify(body)+' logs='+logs.slice(-2500));
  assert.equal(body.ok,true);

  status=await (await fetch(base+'/api/recovery/status')).json();
  assert.equal(status.recoveryRequired,false);
  assert.equal(status.counts.managers,3);
  assert.equal(status.counts.payments,1);
  assert.equal(status.counts.ledger,1);

  response = await fetch(base+'/api/export/full',{headers:{'x-export-token':'TEST_ONLY_EXPORT_TOKEN'}});
  assert.equal(response.status,200);
  const restored=await response.json();
  assert.equal(restored.settings.testSentinel,'backup-recovered');
  assert.equal(restored.settings.leagueIds.fplH2h,'346910');
  assert.ok(restored.payments.some(x=>x.id==='payment_test_1'));
  assert.ok(restored.ledger.some(x=>x.id==='ledger_test_1'));
  assert.ok(restored.managers.some(x=>x.id==='mgr_test_beta'));
  console.log('RESTORE INTEGRATION: empty disk starts normally -> upload -> 3 managers, 1 payment, 1 ledger, settings intact');
});
