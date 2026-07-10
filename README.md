# D League Clubhouse

**The premium manager-centric fantasy football command center for the D League community.**

Private friends league. Full transparency. No sponsors required. Everything runs on manager entry fees.

## Product Overview

D League is a season-long private competition with:

- **FPL**: 38 gameweeks. ₦20,000 season fee (₦19,000 contributions + ₦1,000 reserve/H2H/cup).
- **UCL Fantasy**: 17 matchdays. ₦10,000 season fee (₦8,500 contributions + ₦1,500 phase prizes).
- Weekly / matchday winner-takes-all pots (90% to winner(s), 10% to reserve).
- Automatic fines for managers under official average.
- Head-to-Head, Cup, Challenges with stakes flowing through the wallet.
- Fully auditable ledger + payout projections.
- **Payments only via verified Paystack webhooks**. No manual "mark paid".

## Core Principles

- Manager first experience — the paid dashboard is world-class.
- Only paid managers appear in standings and qualify for prizes.
- Late joiners pay full season fee.
- Everything is automated: scores, fines, pots, projections.
- Transparent money at all times.

## Tech Stack (Standalone)

- Node.js + Express backend
- Vanilla JS + Tailwind (CDN) + premium custom CSS for the frontend
- JSON file store (easily migratable to Postgres)
- Official FPL public APIs
- Configurable adapters for live projections and UCL Fantasy
- Paystack webhook signature verified payments

## Quick Start (Local / Demo)

**You must start the server — do NOT double-click the .html file.**

```bash
cd ~/d-league-clubhouse
npm install
npm start
```

Wait until you see:

```
D League Clubhouse running on http://localhost:4174
```

Then open your **browser** and go to:

```
http://localhost:4174
```

The login form should appear. Use the demo credentials shown on screen.

**Demo logins (visible only when DEMO_MODE=true):**

- Bolade Oladejo — bolade.oladejo@gmail.com — code: `DLeagueAdmin!2026@*` (ADMIN - backend view)
- And others (see seeded data)

In demo mode you can simulate full payments with the "Simulate Paystack Success" button.

## Production Mode

Set:
```
DEMO_MODE=false
NODE_ENV=production
```

Real Paystack keys required. Demo credentials hidden. Export/sync tokens enforced.

## Key Features Delivered

- Beautiful premium sports dashboard (dark, bold, modern, responsive)
- Live ticker + announcements
- Combined, FPL, UCL leaderboards + race views
- Per-manager cards and full table with filters
- Your stats + eligibility + projected pot position
- Automatic fines tracking + deduction
- H2H fixtures + standings
- Visual cup bracket
- Challenge room
- Full ledger + payout projections
- WhatsApp-ready summary generator
- Manager spotlight
- Secure backend: webhook-only paid confirmation, protected sync/export
- FPL public API sync
- UCL adapter-ready
- LiveFPL-style projection config

## Payments Flow (Real)

1. Manager registers fantasy accounts during login flow (or pre-seeded).
2. From dashboard, initiate Paystack payment for FPL or UCL (or both).
3. Paystack popup / redirect completes.
4. **Paystack sends verified webhook** to `/api/paystack/webhook`.
5. Server validates signature + marks payment confirmed.
6. Manager instantly eligible (refresh or auto).

No other way to become "paid".

## Data Sync

- `/api/sync/run` (protected by `SYNC_TOKEN` header or query)
- Scheduled sync optional via ENABLE_SCHEDULED_SYNC
- Sources labeled: `official-fpl`, `live-projection`, `ucl-adapter`, `pending`

## Folder Structure

```
d-league-clubhouse/
├── server.js              # Express app + all API + business logic
├── lib/
│   ├── store.js           # Hardened JSON persistence
│   ├── fpl.js             # FPL adapter
│   ├── ucl.js             # UCL adapter
│   ├── calculations.js    # Pots, fines, projections, ranks
│   └── payments.js        # Paystack helpers
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                  # store.json (gitignored in prod)
├── Dockerfile
├── render.yaml
├── .env.example
├── DEPLOYMENT.md
└── README.md
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Render, Docker, webhook setup, and sharing with the league.

## License / Use

Private league use only. Do not expose publicly without securing tokens and adding proper auth hardening for real money.

---

Built with pride for the D League managers. Let's win clean.

See [D_LEAGUE_PLAYBOOK.md](./D_LEAGUE_PLAYBOOK.md) — the full product pitch written as if explaining to a brand new manager what this is and why every detail (especially the bank form → Paystack) matters.
