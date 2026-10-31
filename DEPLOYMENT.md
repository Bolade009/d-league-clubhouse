# D League Clubhouse — Deployment Guide

## Render Free backup-and-upload recovery (temporary workaround)

Render Free has **no persistent disks**, and local SQLite/JSON can disappear on every
deploy, restart, or idle spin-down. For a live league accepting payments, this is
**not a durable storage solution**. Use an external persistent database (or paid
persistent disk) for reliable operation. Do NOT rely on a 5-minute pinger.

### Before deploying this branch — on the current working DLeague app

1. Open the Admin Cockpit and click **DOWNLOAD FULL EXPORT** (works on the current
   live app). Enter your private `EXPORT_TOKEN` if configured.
2. Store the complete downloaded JSON **off Render and off GitHub**, and verify it
   includes the real expected counts of `managers`, `payments`, `ledger` and
   `settings`. This export contains sensitive manager/payment information.
3. Only AFTER downloading the full backup, in Render → your EXISTING production
   web service → Environment, set:
   - `DLEAGUE_EPHEMERAL_RECOVERY=true`
   - `EXPORT_TOKEN` to a long private secret (required for upload and export).
   - Optional: `DLEAGUE_MIN_MANAGERS`, `DLEAGUE_MIN_PAYMENTS`, `DLEAGUE_MIN_LEDGER`
     to the actual verified counts, to detect partial data loss.
   - Leave `DEMO_MODE=false` and existing Paystack settings as they are.
   **Changing Render environment settings can restart the service and erase local
   data on Free — do not do so until that off-host export is safe.**
4. Merge/deploy the PR only after confirming the full export is stored and readable.

### After the new release deploys (and whenever Render Free loses data)

1. Open `https://d-league-clubhouse.onrender.com/recovery.html`.
2. Sign in as commissioner with the Admin login and the private `EXPORT_TOKEN`.
3. Choose the saved FULL export JSON file. Inspect the shown counts.
4. Click **Verify & Restore Backup** and confirm.
5. Confirm the app reports recovery complete, then reload, sign in and inspect
   managers, paid statuses, ledger, wallet totals and H2H fixtures.
6. Download a fresh full export after every significant change or transaction.

When the app detects fewer than the configured count floors, it serves the
recovery page and admin login while ordinary APIs (including Paystack webhook)
return **503**. Automatic sync and settlements remain paused until the backup
is successfully restored.

The upload endpoint accepts at most 12 MB JSON and requires both an authenticated
admin token AND the separate private export token before accepting a large request.
Older snapshots that would discard existing manager, payment or ledger records are
rejected. A successful restore is verified before recovery mode is lifted.

**Caution:** If someone pays between the previous backup and a server reset, their
local payment record may be lost. Webhook retries are not a substitute for a
permanent transaction database or reconciliation against Paystack. Perform
independent payment reconciliation before resuming financial activity when
recovering from older exports.

---

## CRITICAL: Protect paid DLeague records before any production deploy

DLeague is a live, funded league. **A code rollback does NOT restore missing database records.**
Render only retains SQLite and JSON changes across deployments when the actual web service
has a paid persistent disk attached at exactly the directory used by `DATA_DIR`.
The checked-in `render.yaml` is not proof that a manually created Render service has a disk.

1. In the production Render dashboard, verify the web service is Starter (or higher), its
   **Disk** is mounted at `/app/data`, and **Environment** includes `DATA_DIR=/app/data`.
   Never switch the service to Free; Free has no persistent disk.
2. In DLeague Admin, use **DOWNLOAD FULL EXPORT** and store the downloaded JSON file
   **outside Render**, in a secure private location. Confirm the JSON contains the expected
   counts for `managers`, `payments` and `ledger`. Exports may include sensitive
   manager information and access codes: **never commit them to GitHub**.
3. Compare the Admin **PERSISTENCE HEALTH** panel values for DB managers, sidecar
   managers, backup managers and atomic collections. Investigate any unexpectedly low value.
   Never click restore without verifying which snapshot is actually current.
4. The production boot has a *read-only data floor gate*. Without `DLEAGUE_EPHEMERAL_RECOVERY=true`, it refuses to
   boot with fewer than **2 managers**, **1 payment**, or **1 ledger entry** in the surviving
   SQLite/sidecar/atomic/backup files. This stops a new blank directory from silently
   serving an admin-only league. It cannot recover a missing disk or replace off-host backups.
   For stronger protection, set Render Environment variables
   `DLEAGUE_MIN_MANAGERS`, `DLEAGUE_MIN_PAYMENTS`, and `DLEAGUE_MIN_LEDGER`
   to conservative counts from the verified export before merging/deploying. These are
   *minimums*, not secret values. To intentionally initialize a new league, explicitly
   set all three to `0`, after ensuring you are not wiping production data.
5. If a deployment is rejected with `[DATA PROTECTION]`, **do not bypass the guard**.
   Confirm the disk mount, directory and source of truth, restore records from a verified
   off-host export if necessary, and only retry after the preflight passes.
6. After deployment, confirm that managers, payments, ledger and H2H data still match
   the pre-deploy baseline. Only then resume administration.

**IMPORTANT:** A cron pinger or uptime monitor cannot make an ephemeral filesystem persistent.
A backup saved to the same ephemeral Render filesystem can disappear with it.

---

## Production Checklist

1. Set `DEMO_MODE=false`
2. Use strong random values for `EXPORT_TOKEN` and `SYNC_TOKEN`
3. Provide real Paystack **live** keys (or test for staging)
4. Configure Paystack webhook URL
5. Use persistent disk for `./data`

## 1. Local Development

```bash
npm install
cp .env.example .env
# Edit .env — set DEMO_MODE=true for testing
npm start
```

Visit: http://localhost:4174

**Demo accounts** (only shown when DEMO_MODE=true):
- bolade.oladejo@gmail.com / DLeagueAdmin!2026@*
  (this is the ONLY admin account with backend view access)
- etc.

In demo mode use the **Simulate Paystack Success** button.

## 2. Docker (Recommended for consistency)

```bash
docker build -t dleague-clubhouse .
docker run -p 4174:4174 \
  -e DEMO_MODE=false \
  -e PAYSTACK_SECRET_KEY=sk_live_xxx \
  -e PAYSTACK_PUBLIC_KEY=pk_live_xxx \
  -e EXPORT_TOKEN=xxx \
  -e SYNC_TOKEN=xxx \
  -v $(pwd)/data:/app/data \
  dleague-clubhouse
```

Health endpoint: `GET /health`

## 3. Render Deployment (One-click ready)

1. Push this folder to GitHub.
2. On Render → New Web Service → Connect repo.
3. Use the included `render.yaml` as blueprint.
4. After first deploy:
   - Add the disk (already configured in yaml).
   - Set `DEMO_MODE=false`
   - Add your real `PAYSTACK_*` keys + tokens.
5. Deploy.

**Render health check** is already configured at `/health`.

## 4. Paystack Webhook Setup (CRITICAL)

Go to your Paystack Dashboard → Settings → Webhooks

Set the webhook URL to:

```
https://your-production-domain.com/api/paystack/webhook
```

**Verify the following**:
- Webhook is set to **Live** mode when using live keys.
- Only `charge.success` events matter for us (handled).
- Signature verification uses your Paystack **secret key**.

**Never** manually mark anyone paid. The webhook is the only truth.

Test with Paystack test keys + webhook.site or ngrok for local testing if needed.

## 5. Sync Endpoints (for cron or manual)

Protected by `SYNC_TOKEN` (header `x-sync-token` or `?token=`).

```bash
curl -X POST https://yourdomain.com/api/sync/run \
  -H "x-sync-token: YOUR_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comp":"fpl"}'
```

Same for `"comp":"ucl"`.

You can also enable `ENABLE_SCHEDULED_SYNC=true` (the server has basic support; production users should use an external cron or Render Cron jobs).

## 6. Data Export (Protected)

```bash
curl "https://yourdomain.com/api/export/full?token=YOUR_EXPORT_TOKEN" > export.json
```

## 7. Sharing with Friends (Test Deployment)

1. Deploy with `DEMO_MODE=true` (Render free tier is fine).
2. Share the URL + one of the demo emails + codes.
3. Everyone can log in, simulate payments, and see the full experience.
4. To graduate to real money: flip `DEMO_MODE=false`, replace keys, set real Paystack webhook, and seed real managers.

## 8. Production Hardening Recommendations

- Replace simple access codes with email magic links or WhatsApp OTP.
- Add admin role + separate treasurer dashboard.
- Add more frequent finalized round detection.
- Move `store.json` to Postgres/Supabase (model is flat and ready).
- Add rate limiting + IP allow for sync routes.
- Set up automated nightly sync via external job.

## Data Persistence & Recovery (IMPORTANT for Render free/starter)

The app uses SQLite + JSON backups in /app/data/backups (or $DATA_DIR/backups).

On every persist we write:
- Timestamped store-....json
- store-latest.json (always current)
- store-best.json (only updated on new high manager count)

On load / boot / wake / deploy:
- If DB reports fewer managers than the *best* backup (by manager count), it **automatically restores** the highest-count backup into DB and persists.
- recoverOrphanedPaidManagers + best-backup hydration will recreate stubs or full profiles (name/email/code/fplId) from payments + historical best backup.
- Smart pruning keeps high-count backups + recents + the two stable files.

If you ever see 0 (or 1 admin) managers after a wake/deploy:
1. Check Render logs for "[BOOT FINAL]" + "[store] Best backup found" + "FORCED restore".
2. As admin, POST to `/api/admin/restore-from-best-backup` (header `x-admin-token: YOUR_SYNC_TOKEN` or use your admin login bearer).
3. The endpoint forces the best snapshot and logs the before/after.

This is the permanent solution regardless of free tier sleeps (which can leave WAL in inconsistent state). The code now always recovers the known-good highest manager state. Free tier just makes restarts more frequent; paid instance is more "always on" but recovery is the same.

Backups are small. Disk is 1GB+. Do not delete data/backups manually.

## 9. Environment Variables Reference

| Variable                    | Required | Notes |
|----------------------------|----------|-------|
| `NODE_ENV`                 | Yes      | `production` |
| `DEMO_MODE`                | Yes      | `false` for prod |
| `PAYSTACK_SECRET_KEY`      | Yes (prod) | sk_... |
| `PAYSTACK_PUBLIC_KEY`      | Yes      | pk_... |
| `EXPORT_TOKEN`             | Yes      | Random 32+ chars |
| `SYNC_TOKEN`               | Yes      | Random 32+ chars |
| `LIVE_FPL_API_TEMPLATE`    | No       | Optional live projection |
| `UCL_FANTASY_API_TEMPLATE` | No       | Adapter template |
| `DATA_DIR`                 | No       | Defaults to ./data |

## 10. FPL & UCL Integrations

- FPL uses public endpoints only:
  - `bootstrap-static/`
  - `event/{gw}/live/`
  - `entry/{id}/`
  - `entry/{id}/event/{gw}/picks/`

- Live projection support: set `LIVE_FPL_API_TEMPLATE` with `{teamId}` and `{round}`.
- UCL: set `UCL_FANTASY_API_TEMPLATE`. The adapter will call and expect `{points: number}` or fall back gracefully.

## Launch Sequence

1. `npm install`
2. Configure env + secrets
3. `npm start` locally (test demo)
4. Deploy to Render / Docker
5. Set Paystack webhook
6. Send link + login codes to managers
7. Run first `/api/sync/run`
8. Celebrate clean money tracking

---

Questions? The app is built to be self-explanatory for managers.
No manual overrides. Everything through verified flows.
