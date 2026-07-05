# D League Clubhouse — Deployment Guide

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
