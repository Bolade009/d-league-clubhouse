'use strict';
const $ = id => document.getElementById(id);
const MAX_SIZE = 11 * 1024 * 1024;
let backup = null;

function counts(data) {
  return { managers: data.managers.length, payments: data.payments.length, ledger: data.ledger.length };
}
function message(text, error = false) {
  $('result').textContent = text;
  $('result').style.color = error ? '#ffc18e' : '#00ff85';
}
async function loadStatus() {
  try {
    const response = await fetch('/api/recovery/status', { cache: 'no-store' });
    const info = await response.json();
    const c = info.counts || {};
    $('service-status').textContent = info.recoveryRequired
      ? 'RECOVERY MODE: live operations are paused until you upload a verified backup. '
        + 'Currently loaded: ' + (c.managers || 0) + ' managers / '
        + (c.payments || 0) + ' payments / ' + (c.ledger || 0) + ' ledger records.'
      : 'DLeague is active. Restore only if you have a verified, newer backup. '
        + 'Currently loaded: ' + (c.managers || 0) + ' managers / '
        + (c.payments || 0) + ' payments / ' + (c.ledger || 0) + ' ledger records.';
    $('service-status').classList.toggle('warn', !!info.recoveryRequired);
  } catch (error) {
    $('service-status').textContent = 'Could not read server recovery status: ' + error.message;
  }
}
$('file').addEventListener('change', async () => {
  backup = null;
  $('restore').disabled = true;
  $('preview').classList.add('hidden');
  const file = $('file').files[0];
  if (!file) return;
  if (file.size > MAX_SIZE) return message('This backup exceeds the 11 MB upload limit.', true);
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.managers) ||
        !Array.isArray(parsed.payments) || !Array.isArray(parsed.ledger) ||
        !parsed.settings || parsed.managers.length < 2) {
      throw new Error('Choose a FULL export containing managers, payments, ledger and settings.');
    }
    backup = parsed;
    const c = counts(parsed);
    $('preview').textContent = 'Backup: ' + file.name + ' • ' +
      c.managers + ' managers • ' + c.payments + ' payments • ' +
      c.ledger + ' ledger records.';
    $('preview').classList.remove('hidden');
    $('restore').disabled = false;
    message('Backup loaded. Check the counts, then select Verify & Restore.');
  } catch (error) {
    message('Invalid backup: ' + error.message, true);
  }
});
$('restore').addEventListener('click', async () => {
  if (!backup) return;
  const email = $('email').value.trim();
  const code = $('password').value;
  const secret = $('backup-secret').value.trim();
  if (!email || !code || !secret) return message('Admin email, access code and private EXPORT_TOKEN are required.', true);
  const c = counts(backup);
  if (!confirm('Restore backup with ' + c.managers + ' managers, ' + c.payments +
      ' payments and ' + c.ledger + ' ledger records? Verify that this is the most recent valid copy.')) return;
  $('restore').disabled = true;
  message('Validating admin login and restoring backup…');
  try {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const login = await loginResponse.json();
    if (!loginResponse.ok || !login.token) throw new Error(login.error || 'Admin login failed');
    const response = await fetch('/api/admin/restore-from-export', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + login.token,
        'x-export-token': secret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: backup })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Restore failed (HTTP ' + response.status + ')');
    message('Backup restored successfully! ' + (result.message || '') +
      '\nReload DLeague and sign in again. Please download a fresh backup after changes.');
    $('file').value = '';
    backup = null;
    await loadStatus();
  } catch (error) {
    message('Restore NOT completed: ' + error.message, true);
  } finally {
    $('restore').disabled = !backup;
  }
});
loadStatus();