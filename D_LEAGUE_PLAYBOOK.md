# D LEAGUE CLUBHOUSE — THE MANAGER'S PITCH

**Welcome to the D League, Manager.**

**Website:** https://d-league-clubhouse.onrender.com

This is not another fantasy app.  
This is *our* closed circle, turned into a premium, transparent, money-moving machine.

If you are reading this as a new manager or thinking of joining, here is exactly what the D League is, how every naira moves, and why the automation matters. This is the real product story.

---

## What is the D League?

The D League is a private, invite-only fantasy football community of friends who compete seriously across two official fantasy platforms for an entire season:

- **Fantasy Premier League (FPL)** — 38 gameweeks of English Premier League
- **UCL Fantasy** — UEFA Champions League matchdays

We do not mix money pools. FPL contributions stay in FPL pots. UCL stays in UCL pots. Everything is tracked in a public, append-only ledger that any paid manager can see.

There are no random sponsors. The prize money comes *only* from the managers who paid to play.

**Example:** Ten managers pay for FPL. The league runs itself. Weekly pots build. At the end of a Gameweek, the winner (or split winners) gets paid straight to their bank. No commissioner typing numbers into a group chat.

---

## How You Join (Clean & Controlled)

1. Click **Request Access** on the Clubhouse.
2. Fill the short form: your name, email, FPL club name, and **your FPL Team ID** (required).
3. The commissioner reviews (usually same day via the admin cockpit).
4. You receive a personal access code by email.
5. Login with email + code.
6. Pay for FPL (₦30,000 total), UCL (₦15,000 total), or both — separately. Paystack only.

Once paid (confirmed by live Paystack webhook), you appear in standings, your lineup syncs live from the official FPL API, and you qualify for every pot.

Late joiners pay the full season fee. No discounts. Fairness is non-negotiable.

**Real example:** Chinedu requests access on Tuesday. Bolade (commissioner) approves Thursday morning. Chinedu pays Friday via Paystack. By Saturday his FPL squad is live in the D League dashboard and he is eligible for GW34 money.

---

## The Money (Fees + The Famous 5k House Fee)

### FPL
- Season fee: **₦30,000**
  - ₦25,000 goes into prize revenue (weekly pots, H2H, Cup, overall season)
  - **₦5,000** is the house/admin fee

### UCL
- Season fee: **₦15,000**
  - Most goes to pots
  - Smaller house slice (currently coded at ₦2,500)

**Why the 5k house fee exists and why it is honest:**

The ₦5,000 covers:
- Paystack processing + transfer fees on every payout
- Server, database, SSL, automated weekly syncs and settlement jobs that run 24/7
- Building and maintaining the beautiful dashboard (lineup viewer, live projections, H2H brackets, wallet)
- The guarantee that money moves *automatically* without anyone chasing the commissioner at 2am after a Monday night game

Everything else (90%+ of the real pot money) is distributed to managers via Paystack transfers.

We are transparent: when you pay, the ledger records revenue minus house. All future pot math derives from that.

---

## The Heart of It: Auto Everything + Real Paystack Payouts

### Bank Details = Real Automation

This is the part you must understand.

Click **"Update Bank Details"** in your wallet area (right under your name after login).

It immediately asks:

**Local (Nigeria) or International?**

- **Local (Nigeria):** Beautiful form + live dropdown of every Nigerian bank pulled directly from Paystack's bank list. Pick your bank (e.g. GTBank 058), type your exact account name and 10-digit number.
- **International:** Full form for account name, number/IBAN, bank name, SWIFT, country, currency.

When you hit SAVE, we store a clean structured JSON object.

**Example of what gets stored for a local manager:**

```json
{
  "type": "nuban",
  "account_name": "Bolade Oladejo",
  "bank_code": "058",
  "account_number": "0123456789"
}
```

**International example:**

```json
{
  "type": "international",
  "account_name": "Aisha Bello",
  "account_number": "DE89370400440532013000",
  "bank_name": "Commerzbank",
  "swift": "COBADEFFXXX",
  "country": "DE",
  "currency": "EUR"
}
```

### How Paystack uses it

Every time the system settles a pot (after a Gameweek or Matchday concludes), or you request a wallet withdrawal:

1. Backend reads your stored JSON.
2. Calls Paystack `/transferrecipient` with exactly those fields.
3. Gets back a `recipient_code`.
4. Immediately calls `/transfer` to send the exact amount from the league balance to your account.

No human ever copies your account number into a banking app. No commissioner logs into Paystack manually. It is automatic.

If you win the FPL weekly pot of ₦8,500 in GW 19, after the deadline passes and scores lock, the money leaves the league balance and lands in your bank.

Same for H2H, sponsored beefs, cup runs, and season-end overall pots.

The fields you enter are sent directly to Paystack. This guarantees automatic, accurate transfers when you win.

---

## What Actually Happens During a Season (Concrete Walkthrough)

**Week 1–3 (Build phase)**
- Managers pay.
- Weekly pots start small.
- You see live FPL-style lineup viewer (exact shirt numbers, captain badge, formation) pulled from your real FPL picks.

**GW 12 — Monday Night**
- Final whistle blows.
- Our auto-settlement job (triggered by FPL bootstrap "finished" + interval) detects the round is complete.
- It calculates:
  - Weekly winner(s) — 90% split if ties
  - 10% house slice logged
  - H2H results paid
- For every credited amount, Paystack transfer fires using the JSON bank details you provided.
- Your wallet updates. You get a line in the ledger. The projections update instantly.

**Mid-season sponsored beef**
- Two managers propose "Highest scorer this GW — ₦5,000 stake"
- One accepts.
- Money moves from their wallets into a locked pot.
- After the GW ends, winner is determined from real data and paid out (minus 10% house).

**Season pots**
- A slice of every paid fee builds overall winner pots, cup pots, H2H season leaderboard money.
- These pay at the end of phases or full season.

You never have to ask "has the money been sent?" You check the ledger and your bank.

---

## The Dashboard You Actually Use

After login you get a dark, premium command center:

- Your current wallet balance + one-click "Request Payout to Bank"
- Prominent **Update Bank Details** button that always launches the local/intl choice → full form flow
- Separate FPL and UCL pay blocks (you can play just one)
- Live standings (only paid managers count for prizes)
- FPL-tailored lineup view that looks and feels like the official FPL app
- Head-to-head fixtures
- Visual cup bracket
- Challenge room + preset sponsored awards ("Biggest riser", "Captain fail", "Rags to Riches")
- Payout projections (what you stand to win)
- Full transaction history

Everything auto-refreshes.

---

## Rules That Keep It Clean

- Admin (commissioner) has no team in the competition. Zero conflict.
- Paid = eligible. Unpaid = invisible for prizes.
- FPL Team ID is mandatory — we validate your picks come from a real team.
- League can be locked by admin button once the season is underway. No surprise late money.
- The ledger is the source of truth. Not WhatsApp screenshots.
- 10% house on all side pots and winnings settlements (explicit and logged).

---

## Why This Exists

Most private leagues die in chaos:
- Someone forgets to pay
- Commissioner spends weekends calculating Excel pots
- Winners chase money for three weeks
- Arguments about "I paid last week bro"

D League Clubhouse removes the friction.

You focus on your transfers, captaincy, and banter.  
The system focuses on collecting, tracking, projecting, and — most importantly — **paying**.

When you win, the money should just appear in your account the same way Uber pays drivers. That is the product.

---

## Your First 3 Actions as a New Manager

1. Login with the code you received.
2. Immediately click **Update Bank Details** → pick Local → select your real bank from the Paystack list → save accurate name + number. Do this before you win anything.
3. Pay for the competition(s) you want. Watch the status flip to PAID via webhook.

Then enjoy the ride.

---

## Final Word

This is a friends league that behaves like a professional product.

The bank form you just got is not decoration.  
It is the bridge that makes "I won the weekly" turn into "money is in my GTBank".

Everything else — the lineup viewer, the pots, the auto settlements, the separate FPL/UCL flows — exists to make that moment feel inevitable and fair.

Welcome to the D League.

Now go set your bank details and win some money.

— The D League Clubhouse

*Built for managers who take this seriously.*
