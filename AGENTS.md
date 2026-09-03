# D League Clubhouse — agent rules

Live app: https://d-league-clubhouse.onrender.com  
Stack: Node/Express `server.js` + vanilla `public/app.js` + `public/index.html`. Persistence: SQLite + atomic JSON sidecars in `data/`.

This file is the **current** product truth. Ignore stale numbers in the original README (20k/10k fees, “no mark-paid”, fines). Playbook is closer: [D_LEAGUE_PLAYBOOK.md](D_LEAGUE_PLAYBOOK.md).

## Non-negotiables

1. **Do not break working money.** Webhook (`charge.success` + signature), ledger, wallets, Paystack transfers, pot math, settle guards. Minimal targeted diffs only.
2. **Never lose paid managers.** Persistence merge (sidecar/db/backup/atomics) must not resurrect deleted people *or* wipe payers. `deletedManagerIds` filters deletes. Demo `@dleague.ng` purge only if **zero** confirmed payments. Prefer recover over recreate.
3. **Strict FPL vs UCL.** Separate pots, standings, spotlight, winners roll, pay boxes, club names. No mix in UI. Beefs are **FPL-only**.
4. **Paid is per competition.** FPL paid unlocks FPL only; UCL paid unlocks UCL only. Never “partially paid”. Admin has **no team** (`bolade.oladejo@gmail.com`).
5. **Push/commit when asked.** Do not dump conversation exports into git.

## Money (live)

| | FPL | UCL |
|---|---|---|
| Season fee | ₦30,000 | ₦15,000 |
| House / service | ₦5,000 (`houseFplAdmin`) | ₦2,500 (`houseUclAdmin`) |
| Prize revenue | amount − house | amount − house |
| Rounds | 38 GW | 17 MD |
| Per-round contrib | ₦600 | ₦600 |
| Weekly/MD winner | 90% of that round’s pot | 90% credited to wallet on settle |
| Extra | H2H ₦1,500/paid; overall/cup slices | Overall = 20% of UCL revenue on pay |

- Fines **removed**. Do not reintroduce.
- Admin **can** mark-paid (webhook still source of truth for live Paystack). Edit service fees via `POST /api/admin/set-service-fees`.
- UCL 2nd/3rd: pre-allocate **+600 / +400 per confirmed UCL pay** so pots show **before** any MD settle. Do not require MD settle to fund them. End-of-season awards from stored MD totals.
- FPL weekly 10% reserve: 75% overall / 25% cup, **once per round** (`season_pot_contribution` guard).
- Settle win credits **once** (`weekly_win` + `history.weekly` inside `!alreadyWin`). GW winners roll: one winner set per `(comp,round)`. Never settle a live unfinished current GW as final.

## Scores / sync

- FPL: public API (`bootstrap-static`, `entry/{id}/event/{r}/picks`, `event/{r}/live`).
- **Finished GW:** store `entry_history.points` as official. Settle uses fresh official fetch + `bootstrap.finished`.
- **Live GW:** store live compute from picks × multiplier. `multiplier === 0` is bench — **do not** use `mult || 1` (0 is falsy). Overview `currentFpl` must match lineup sum of starter contribs.
- Bench Boost: FPL sets bench `multiplier` to 1; only then bench counts in team total.
- UCL scores: **manual admin MD** (`/api/admin/set-ucl-md-scores` + finalize → `force-settle-round` for **that md**, not `currentRound`).
- Auto-settle previous round only when FPL marks it finished. Periodic sync ~30min + force sync.

## UI / admin

- H2H: **current GW only** (not +1). Admin selector auto-fills reverse matchup.
- Lineup: FPL-style pitch; picks stored **raw** player pts; display `raw * mult` for active, raw on bench cards.
- Beefs: FPL paid opponents only; hide/guard in UCL mode.
- Delete manager: record `deletedManagerIds`; must not reappear from backups.
- Service fees: cockpit **EDIT SERVICE FEES** edits house actuals; extra payments still flow in.

## How to change code

- Touch the smallest path. Preserve existing guards (`alreadyWin`, `alreadyReserve`, payment `existing` early return).
- Keep FPL/UCL money keys in merge `max()` so pots never go backwards.
- After money/sync/UI fixes: `node --check server.js`, then commit/push on request.

## Open / recurring ops (do when asked)

- Auto-settle preset beefs from stored picks when GW finished.
- End-season H2H + FPL 1st/2nd runner-up awards.
- Cup start ~GW32; don’t break cup pots.
- League IDs (`fplClassic`, `fplH2h`) + teamIds visible in admin.
- Wallet deduct UI; more admin superpowers (preview settle, audit).
- Never invent FPL/UCL mix or re-enable fines.
