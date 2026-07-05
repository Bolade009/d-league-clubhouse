# D League Clubhouse – Paystack Business Description

## Short Version (for Business Profile / Quick Submission)

D League Clubhouse is a private, members-only digital platform for a closed group of friends who compete in Fantasy Premier League (FPL) and UEFA Champions League Fantasy. 

The platform lets members manage their fantasy teams, view real-time lineups and performance, participate in weekly community challenges and head-to-head matches, and transparently handle small entry contributions and prize pools. All activities are skill-based and focused on friendly competition, community engagement, and shared passion for football. 

Payments (entry fees and challenge stakes) are collected and distributed fairly among the private group using secure Paystack processing. The community is invite-only and operates purely for entertainment and social bonding.

## Detailed Version (Recommended for Verification / Support)

**Business Description:**

D League Clubhouse is a private fantasy football community platform built exclusively for a closed group of friends (the "D League"). It serves as a central hub where members compete in Fantasy Premier League (FPL) and UCL Fantasy over an entire season.

Key community activities include:
- Managing personal fantasy squads and viewing detailed lineups, captain choices, and performance
- Weekly and matchday challenges that test strategy and football knowledge
- Head-to-head matches and community standings
- Friendly prize pools and awards funded entirely by member contributions
- Transparent tracking of results, payouts, and group activity

The platform enhances social interaction among members by providing a beautiful shared dashboard, easy sharing of lineups, and automated fair distribution of small seasonal contributions. It is 100% invite-only — no public access or external players are allowed.

All financial activity (season contributions and optional challenge stakes) is processed transparently through Paystack. Winners receive their share automatically into their registered accounts. The focus is on fun, skill, and strengthening friendships through football, not gambling.

**Target Audience:** Adult friends and football enthusiasts in a private WhatsApp-based community.

**Nature of Business:** Entertainment / Community Platform (Skill-based fantasy sports for a closed private group).

**How Payments Work:**
- Members pay small seasonal contributions via Paystack to participate.
- Funds go into transparent community prize pools.
- Payouts are made to winning members through secure, recorded transactions.
- 10% of challenge/bet stakes is retained as a small house fee to cover platform costs.

We are a legitimate private community project, not a public betting or gambling service.

---

## Suggested Paystack Category
Primary: **Sports & Recreation** or **Entertainment**  
Secondary: **Community / Social Platform**

## Tips for Submission
- Emphasize "private", "friends-only", "invite-only", and "community activity"
- Mention it is skill-based fantasy sports (not chance-based gambling)
- Highlight that all members know each other personally
- You can attach a short note: "This is a closed friends group using the platform purely for entertainment and friendly competition around football."

Copy and paste the version that fits the field size on Paystack.

## Alternative for Unregistered / Personal Use (Bank Virtual Accounts + Monnify)

If you are operating as a personal / unregistered group and want to avoid full business registration:

**Recommended path: Monnify (by Moniepoint) or similar**
- Sign up as an individual or small merchant (often possible with just BVN, NIN, ID, and proof of address — no CAC needed for basic accounts).
- Generate **reserved virtual accounts** per manager or per league entry.
- Use their webhooks for automatic confirmation when someone pays via bank transfer.
- Use their Disbursement API to automatically pay winners (90% to winner, 10% house commission logged in your ledger).
- This gives you almost the same automation as Paystack without needing a full registered company.

**Pure bank virtual accounts (e.g., GTBank, Zenith, or basic fintech virtual accounts) limitations:**
- Easy to collect money (give each person a unique account number).
- But **no automatic webhooks** — you have to manually check statements or poll the bank.
- Payouts become manual bank transfers from your account.
- Challenge settlements are hard to make seamless.
- Not scalable for an app with automated logic.

**How to make virtual accounts work reasonably well:**
1. When a manager registers or initiates payment, create/assign a dedicated virtual account.
2. Instruct them to pay exactly the amount to that account.
3. Manually (or via a script) verify the credit in your bank statement / Monnify dashboard.
4. Update the app ledger and mark them paid.
5. For payouts: After settlement logic runs (in your backend after scores sync), manually or via bulk transfer pay the winners.
6. Keep excellent records in your existing ledger for transparency.

This works for small private groups but loses the "set it and forget it" automation of proper gateways.

For true seamless experience (webhook on payment received + auto payout to winners), use a platform like Monnify or Flutterwave even if operating personally. They are more lenient than Paystack for small/unregistered setups.
