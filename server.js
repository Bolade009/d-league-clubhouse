const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const nodemailer = require("nodemailer");
const Database = require("better-sqlite3");

const app = express();

const PORT = Number(process.env.PORT || 4174);
const BASE_DIR = __dirname;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEMO_MODE = process.env.DEMO_MODE === "true" || !IS_PRODUCTION;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(BASE_DIR, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const REQUEST_BODY_LIMIT = Number(process.env.REQUEST_BODY_LIMIT_BYTES || 1024 * 1024);
const EXPORT_TOKEN = process.env.EXPORT_TOKEN || "";
const SYNC_TOKEN = process.env.SYNC_TOKEN || "";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY || "";
const PAYSTACK_CALLBACK = process.env.PAYSTACK_CALLBACK_URL || "";
const LIVE_FPL_TEMPLATE = process.env.LIVE_FPL_API_TEMPLATE || "";
const UCL_TEMPLATE = process.env.UCL_FANTASY_API_TEMPLATE || "";

// Live admin (only this email can see backend admin view + trigger protected actions)
const ADMIN_EMAIL = "bolade.oladejo@gmail.com";
const ADMIN_ACCESS_CODE = "DLeagueAdmin!2026@*";

const FPL_BASE = "https://fantasy.premierleague.com/api";

// Optional email transport (set SMTP_* in env on Render for real emails)
let mailer = null;
if (process.env.SMTP_HOST) {
  try {
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    });
    console.log("[mailer] Email transport configured");
  } catch (e) { console.warn("Mailer setup failed", e.message); }
}

// Security & limits
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://js.paystack.co", "https://*.paystack.co", "https://*.paystack.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://*.paystack.co"],
      imgSrc: ["'self'", "data:", "https:", "https://*.paystack.co", "https://*.paystack.com"],
      connectSrc: ["'self'", "https://fantasy.premierleague.com", "https://*.paystack.co", "https://*.paystack.com", "https://api.paystack.co", "https://js.paystack.co", "https://checkout.paystack.com"],
      frameSrc: ["'self'", "https://js.paystack.co", "https://*.paystack.co", "https://*.paystack.com", "https://checkout.paystack.com"],
      childSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: false }));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));

// Serve frontend
app.use(express.static(path.join(BASE_DIR, "public"), { maxAge: IS_PRODUCTION ? "1h" : 0 }));

// Ensure data dir
if (!fsSync.existsSync(DATA_DIR)) {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ DATA MODEL & STORE ============

const COMPETITIONS = {
  fpl: {
    key: "fpl",
    short: "FPL",
    name: "Premier League Fantasy",
    roundLabel: "GW",
    rounds: 38,
    seasonFee: 30000,
    contributionPerRound: 500,
    extraReserve: 1000,
    adminFee: 5000,
    reserveSplit: [
      { label: "League Winner", pct: 70 },
      { label: "Cup Winner", pct: 30 }
    ]
  },
  ucl: {
    key: "ucl",
    short: "UCL",
    name: "UCL Fantasy",
    roundLabel: "MD",
    rounds: 17,
    seasonFee: 15000,
    contributionPerRound: 500,
    extraReserve: 1500,
    adminFee: 5000,
    reserveSplit: [
      { label: "League Phase", pct: 70 },
      { label: "Knockout Phase", pct: 30 }
    ]
  }
};

function createEmptyStore() {
  return {
    version: 1,
    settings: {
      currentRound: { fpl: 5, ucl: 3 },
      roundAverages: { fpl: 68, ucl: 52 },
      lastSyncAt: null,
      seasonName: "2025/26 D League"
    },
    managers: [],
    payments: [],
    scores: [],
    ledger: [],
    h2h: [],
    cup: {
      name: "D League Cup 25/26",
      stage: "Quarter Finals",
      prizeFund: 85000,
      bracket: []
    },
    challenges: [],
    sponsorships: [], // {id, sponsor, amount, target: 'gw_winner'|'best_captain'|'league_winner' etc, round? }
    events: []
  };
}

let storeCache = null;
let storeWriteLock = false;
let db = null;

function initSQLite() {
  if (db) return db;
  const dbPath = path.join(DATA_DIR, "dleague.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL"); // better durability
  db.exec(`
    CREATE TABLE IF NOT EXISTS store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  console.log(`[store] SQLite initialized at ${dbPath}`);
  return db;
}

async function loadStore() {
  if (storeCache) return storeCache;

  try {
    if (!db) initSQLite();

    const rows = db.prepare("SELECT key, value FROM store").all();
    storeCache = {};

    for (const row of rows) {
      storeCache[row.key] = JSON.parse(row.value);
    }

    // Ensure required keys exist
    const defaults = createEmptyStore();
    let needsPersist = false;
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in storeCache)) {
        storeCache[k] = v;
        needsPersist = true;
      }
    }

    console.log(`[store] Loaded from SQLite: ${storeCache.managers ? storeCache.managers.length : 0} managers`);

    if (needsPersist) await persistStore();

    // One-time migration from old store.json (if exists and SQLite is empty)
    const oldStorePath = STORE_FILE;
    if (Object.keys(storeCache).length <= Object.keys(defaults).length && fsSync.existsSync(oldStorePath)) {
      try {
        const raw = fsSync.readFileSync(oldStorePath, "utf8");
        const oldData = JSON.parse(raw);
        storeCache = { ...defaults, ...oldData };
        await persistStore();
        console.log("[store] Migrated data from old store.json to SQLite");
        // Optionally rename old file
        try { fsSync.renameSync(oldStorePath, oldStorePath + ".migrated"); } catch {}
      } catch (migErr) {
        console.warn("[store] Old store.json migration failed:", migErr.message);
      }
    }

    return storeCache;
  } catch (e) {
    console.warn(`[store] SQLite load failed: ${e.message}. Starting fresh.`);
    storeCache = createEmptyStore();
    await persistStore();
    return storeCache;
  }
}

async function persistStore() {
  if (storeWriteLock) return;
  storeWriteLock = true;
  try {
    if (!db) initSQLite();

    const insert = db.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)");
    const tx = db.transaction((store) => {
      for (const [key, value] of Object.entries(store)) {
        insert.run(key, JSON.stringify(value));
      }
    });

    tx(storeCache);
    console.log(`[store] Persisted to SQLite: ${storeCache.managers ? storeCache.managers.length : 0} managers`);
  } catch (e) {
    console.error("[store] Persist failed:", e.message);
  } finally {
    storeWriteLock = false;
  }
}

function getStore() {
  if (!storeCache) {
    try {
      if (!db) initSQLite();
      const rows = db.prepare("SELECT key, value FROM store").all();
      storeCache = {};
      for (const row of rows) {
        storeCache[row.key] = JSON.parse(row.value);
      }
    } catch {
      storeCache = createEmptyStore();
    }
  }
  return storeCache;
}

// ============ HELPERS ============

function generateId(prefix = "id") {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

function nowISO() {
  return new Date().toISOString();
}

function signToken(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SYNC_TOKEN || "dev-fallback").update(data).digest("hex");
  return Buffer.from(data).toString("base64") + "." + sig;
}

function verifyToken(token) {
  try {
    const [b64, sig] = token.split(".");
    const data = Buffer.from(b64, "base64").toString();
    const expected = crypto.createHmac("sha256", SYNC_TOKEN || "dev-fallback").update(data).digest("hex");
    if (expected !== sig) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function requireSyncAuth(req, res, next) {
  if (DEMO_MODE) return next();
  const token = req.headers["x-sync-token"] || req.query.token;
  if (SYNC_TOKEN && token !== SYNC_TOKEN) {
    return res.status(403).json({ error: "Invalid sync token" });
  }
  next();
}

function requireExportAuth(req, res, next) {
  if (DEMO_MODE) return next();
  const token = req.headers["x-export-token"] || req.query.token;
  if (EXPORT_TOKEN && token !== EXPORT_TOKEN) {
    return res.status(403).json({ error: "Invalid export token" });
  }
  next();
}

async function logEvent(type, payload) {
  const s = await loadStore();
  s.events.unshift({ id: generateId("evt"), type, payload, at: nowISO() });
  if (s.events.length > 200) s.events.length = 200;
  await persistStore();
}

async function notifyAdminOfJoinRequest(join) {
  console.log("\n========================================");
  console.log("📨 NEW JOIN REQUEST - ACTION REQUIRED");
  console.log("Send access code to the user's real email:");
  console.log("  Name:   ", join.name);
  console.log("  Email:  ", join.email);
  console.log("  FPL Club:", join.fplClubName);
  console.log("  Time:   ", new Date().toISOString());
  console.log("Use /api/admin/add-manager (with your admin token or login as admin) to generate code + add them.");
  console.log("========================================\n");

  const subject = "D League Clubhouse - Access Request Received";
  const text = `Hi ${join.name},\n\nWe received your join request for FPL club "${join.fplClubName}".\nThe commissioner will verify and email you the access code + instructions shortly.\n\nThank you,\nD League Clubhouse`;

  // Send to the requester (confirmation) + BCC to admin
  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.FROM_EMAIL || ADMIN_EMAIL,
        to: join.email,
        bcc: ADMIN_EMAIL,
        subject,
        text
      });
      console.log("[email] Join notification sent to", join.email);
    } catch (e) {
      console.error("[email] Failed to send:", e.message);
    }
  }
}

// ============ MANAGER & PAYMENT LOGIC ============

function getManagerById(id) {
  const s = getStore();
  return s.managers.find(m => m.id === id);
}

function getPaidStatus(manager, comp) {
  const s = getStore();
  const payments = s.payments.filter(p => p.managerId === manager.id && p.competition === comp && p.status === "confirmed");
  return payments.length > 0;
}

function isFullyPaidFor(manager, comp) {
  return getPaidStatus(manager, comp);
}

function getEligibleManagers(comp) {
  const s = getStore();
  return s.managers.filter(m => {
    const p = s.payments.find(pp => pp.managerId === m.id && pp.competition === comp && pp.status === "confirmed");
    return !!p;
  });
}

async function confirmPayment(managerId, competition, reference, amount, paystackData = null) {
  const s = await loadStore();
  const existing = s.payments.find(p => p.reference === reference);
  if (existing) {
    if (existing.status !== "confirmed") {
      existing.status = "confirmed";
      existing.confirmedAt = nowISO();
      existing.paystackData = paystackData;
    }
    await persistStore();
    return existing;
  }

  const payment = {
    id: generateId("pay"),
    managerId,
    competition,
    amount: Number(amount),
    reference,
    status: "confirmed",
    confirmedAt: nowISO(),
    paystackData
  };
  s.payments.push(payment);

  await logEvent("payment_confirmed", { managerId, competition, reference, amount });
  await persistStore();
  return payment;
}

function calculateRoundPot(compKey, round, paidCount) {
  const c = COMPETITIONS[compKey];
  const contrib = paidCount * c.contributionPerRound;
  return {
    total: contrib,
    winnerShare: Math.floor(contrib * 0.9),
    reserve: contrib - Math.floor(contrib * 0.9)
  };
}

// ============ AUTO SETTLEMENT & PAYOUTS (for live) ============

async function settleWeeklyPot(comp, round) {
  const s = await loadStore();
  const eligible = getEligibleManagers(comp);
  const paidCount = eligible.filter(m => isFullyPaidFor(m, comp)).length;
  if (paidCount === 0) return 0;

  const pot = calculateRoundPot(comp, round, paidCount);
  // Find top scorer
  const scores = s.scores.filter(sc => sc.competition === comp && sc.round === round && typeof sc.points === 'number' && sc.isFinal);
  if (!scores.length) return 0;
  scores.sort((a, b) => b.points - a.points);
  const winner = scores[0];

  // Credit winner
  s.ledger.push({
    id: generateId("ldg"),
    type: "weekly_win",
    managerId: winner.managerId,
    competition: comp,
    round,
    amount: pot.winnerShare,
    note: `${comp.toUpperCase()} GW/MD ${round} winner (90%)`,
    at: nowISO()
  });

  // House commission 10%
  s.ledger.push({
    id: generateId("ldg"),
    type: "house_commission",
    managerId: "house",
    competition: comp,
    round,
    amount: -pot.reserve,
    note: `House 10% commission from ${comp} ${round}`,
    at: nowISO()
  });

  await persistStore();
  await logEvent("pot_settled", { comp, round, winner: winner.managerId, amount: pot.winnerShare });
  return pot.winnerShare;
}

async function settleOpenChallenges() {
  const s = await loadStore();
  let settled = 0;
  for (const ch of s.challenges) {
    if (ch.status !== "open") continue;
    // Simple demo settle: pick a random or top manager as winner for demo
    // In real, based on criteria in title e.g. highest captain etc.
    const top = s.managers[0]; // placeholder, in prod compute from scores
    if (top) {
      const commission = Math.floor(ch.prize * 0.1);
      const winnerShare = ch.prize - commission;
      s.ledger.push({
        id: generateId("ldg"),
        type: "challenge_win",
        managerId: top.id,
        competition: "fpl",
        round: s.settings.currentRound.fpl,
        amount: winnerShare,
        note: `Won challenge: ${ch.title} (90%, 10% house)`,
        at: nowISO()
      });
      s.ledger.push({
        id: generateId("ldg"),
        type: "house_commission",
        managerId: "house",
        competition: "fpl",
        round: s.settings.currentRound.fpl,
        amount: -commission,
        note: `House 10% from ${ch.title}`,
        at: nowISO()
      });
      ch.status = "settled";
      ch.winner = top.displayName;
      settled++;
    }
  }
  if (settled) await persistStore();
  return settled;
}

async function autoSettleIfNeeded() {
  const s = await loadStore();
  const curF = s.settings.currentRound.fpl;
  const curU = s.settings.currentRound.ucl;
  await settleWeeklyPot("fpl", curF - 1);
  await payWinnersForRound("fpl", curF - 1);
  await settleWeeklyPot("ucl", curU - 1);
  await payWinnersForRound("ucl", curU - 1);
  await settleOpenChallenges();
  // TODO: for h2h settled, credit winner 90% house 10%
}

async function createTransferRecipient(mgr) {
  if (!mgr || !mgr.payoutDetails || !PAYSTACK_SECRET) return null;
  const parts = String(mgr.payoutDetails).split(":");
  if (parts.length < 3) return null;
  const [bankCode, accountNumber, name] = parts;
  const postData = JSON.stringify({
    type: "nuban",
    name: name || mgr.displayName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: "NGN"
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.paystack.co",
      path: "/transferrecipient",
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json"
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const body = JSON.parse(data);
          resolve(body.data && body.data.recipient_code ? body.data.recipient_code : null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(postData);
    req.end();
  });
}

async function initiateTransfer(managerId, amount, reason) {
  const mgr = getManagerById(managerId);
  if (!mgr || amount <= 0 || !PAYSTACK_SECRET) {
    await logEvent("transfer_skipped", { managerId, amount });
    return { success: false };
  }
  const recipient = await createTransferRecipient(mgr);
  if (!recipient) {
    await logEvent("transfer_no_recipient", { managerId });
    return { success: false, reason: "no recipient" };
  }
  const reference = `DL-PAYOUT-${Date.now()}-${managerId.slice(-6)}`;
  const postData = JSON.stringify({
    source: "balance",
    amount: Math.floor(amount * 100),
    recipient,
    reason: reason || "D League payout",
    reference
  });
  return new Promise((resolve) => {
    const options = {
      hostname: "api.paystack.co",
      path: "/transfer",
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json"
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const body = JSON.parse(data);
          logEvent("transfer_initiated", { managerId, amount, reference, status: body.status });
          resolve({ success: !!body.status, data: body.data, reference });
        } catch { resolve({ success: false }); }
      });
    });
    req.on("error", () => resolve({ success: false }));
    req.write(postData);
    req.end();
  });
}

// Call this after settling pots/challenges
async function payWinnersForRound(comp, round) {
  const s = await loadStore();
  const wins = s.ledger.filter(l => l.competition === comp && l.round === round && l.type === "weekly_win" && l.amount > 0);
  for (const win of wins) {
    await initiateTransfer(win.managerId, win.amount, win.note);
  }
}

// ============ SCORING & FINES (fines removed) ============

async function syncFPL(roundsToSync = null) {
  const s = await loadStore();
  const current = s.settings.currentRound.fpl;
  const rounds = roundsToSync || [current - 1, current].filter(r => r >= 1);

  const bootstrap = await safeFetchJSON(`${FPL_BASE}/bootstrap-static/`);
  if (!bootstrap || !bootstrap.events) {
    await logEvent("sync_fpl_failed", { reason: "bootstrap" });
    return { ok: false, error: "FPL bootstrap failed" };
  }

  const eventMap = {};
  bootstrap.events.forEach(ev => { eventMap[ev.id] = ev; });

  const eligible = getEligibleManagers("fpl");

  // Fetch bootstrap once for player names and live expected if needed
  let playerMap = {};
  let teamMap = {};
  try {
    const bootstrap = await safeFetchJSON(`${FPL_BASE}/bootstrap-static/`);
    if (bootstrap) {
      if (bootstrap.teams) {
        bootstrap.teams.forEach(t => {
          teamMap[t.id] = { name: t.name, short: t.short_name, code: t.code };
        });
      }
      if (bootstrap.elements) {
        bootstrap.elements.forEach(el => {
          const team = teamMap[el.team] || {};
          playerMap[el.id] = {
            name: el.web_name || `${el.first_name} ${el.second_name}`.trim(),
            type: el.element_type, // 1=GK,2=DEF,3=MID,4=FWD
            team: team.short || 'UNK',
            teamColor: getTeamColor(team.code || 'DEF')
          };
        });
      }
    }
  } catch (e) {}

  for (const mgr of s.managers) {
    if (!mgr.fpl || !mgr.fpl.teamId) continue;
    const teamId = mgr.fpl.teamId;

    for (const r of rounds) {
      if (r > current) continue;

      const picksUrl = `${FPL_BASE}/entry/${teamId}/event/${r}/picks/`;
      const entryUrl = `${FPL_BASE}/entry/${teamId}/`;
      let points = null;
      let source = "pending";
      let isFinal = false;
      let extra = {};

      try {
        const picksData = await safeFetchJSON(picksUrl);
        if (picksData) {
          if (picksData.entry_history && typeof picksData.entry_history.points === "number") {
            points = picksData.entry_history.points;
            isFinal = true;
            source = "official-fpl";
          } else if (r === current) {
            const live = await safeFetchJSON(`${FPL_BASE}/event/${r}/live/`);
            if (live && picksData.picks) {
              points = computeLivePointsFromPicks(picksData.picks, live);
              source = "live-projection";
              isFinal = false;
            }
          }

          // Build per-player points map for lineup (projected or actual)
          let pickPoints = {};
          if (picksData.picks && live && live.elements) {
            for (const p of picksData.picks) {
              const el = live.elements.find(e => e.id === p.element);
              if (el && el.stats) {
                pickPoints[p.element] = (el.stats.total_points || 0) * (p.multiplier || 1);
              }
            }
          } else if (DEMO_MODE && picksData.picks) {
            // Demo projected points
            picksData.picks.forEach((p, i) => {
              pickPoints[p.element] = 2 + (i % 8) * 2 + Math.floor(Math.random() * 5);
            });
          }

          // Extract detailed data with names
          const capPick = picksData.picks?.find(p => p.multiplier === 2 || p.multiplier === 3);
          extra.captain = capPick ? capPick.element : null;
          extra.captainName = capPick && playerMap[capPick.element] ? playerMap[capPick.element].name : null;
          extra.activeChip = picksData.active_chip || null;
          extra.picks = (picksData.picks || []).map(p => {
            const info = playerMap[p.element] || {};
            return {
              element: p.element,
              name: info.name || 'Player #' + p.element,
              type: info.type || 0,
              team: info.team || 'UNK',
              teamColor: info.teamColor || '#4B5563',
              position: p.position,
              multiplier: p.multiplier,
              points: pickPoints[p.element] != null ? pickPoints[p.element] : null
            };
          });
          extra.transfers = picksData.entry_history?.event_transfers || 0;
        }

        // Fallback to entry summary
        if (points === null) {
          const entry = await safeFetchJSON(entryUrl);
          if (entry && entry.current_event === r && typeof entry.summary_event_points === "number") {
            points = entry.summary_event_points;
            source = "official-fpl";
            isFinal = true;
          }
        }
      } catch (e) {
        // ignore per team
      }

      // Upsert score with extra FPL details
      upsertScore(s, mgr.id, "fpl", r, points, source, isFinal, extra);
    }
  }

  // Compute round average from official scores
  const avg = computeRoundAverage(s, "fpl", current);
  if (avg != null) s.settings.roundAverages.fpl = avg;

  s.settings.lastSyncAt = nowISO();
  await persistStore();
  await autoSettleIfNeeded();
  await logEvent("sync_fpl_completed", { rounds, managers: s.managers.length });
  return { ok: true };
}

function computeLivePointsFromPicks(picks, liveData) {
  if (!picks || !liveData || !liveData.elements) return null;
  let total = 0;
  for (const pick of picks) {
    const el = liveData.elements.find(e => e.id === pick.element);
    if (!el || !el.stats) continue;
    let pts = (el.stats.total_points || 0) * (pick.multiplier || 1);
    total += pts;
  }
  return Math.round(total);
}

function getTeamColor(code) {
  const colors = {
    'ARS': '#EF0107', 'AVL': '#670E36', 'BRE': '#E30613', 'BHA': '#0057B8',
    'BUR': '#6C1D45', 'CHE': '#034694', 'CRY': '#1B458F', 'EVE': '#003399',
    'FUL': '#000000', 'LEE': '#1D428A', 'LEI': '#0033A0', 'LIV': '#C8102E',
    'MCI': '#6CABDD', 'MUN': '#DA020E', 'NEW': '#241F20', 'NOR': '#00A650',
    'SOU': '#D71920', 'TOT': '#132257', 'WAT': '#FBEE23', 'WHU': '#7A263A',
    'WOL': '#FDB913', 'DEF': '#4B5563'
  };
  return colors[code] || '#4B5563';
}

function upsertScore(store, managerId, comp, round, points, source, isFinal, extra = {}) {
  let existing = store.scores.find(sc => sc.managerId === managerId && sc.competition === comp && sc.round === round);
  const val = (typeof points === "number") ? points : null;
  const newData = {
    points: val,
    source,
    isFinal: !!isFinal,
    updatedAt: nowISO(),
    ...extra
  };
  if (existing) {
    Object.assign(existing, newData);
  } else {
    store.scores.push({
      id: generateId("sc"),
      managerId,
      competition: comp,
      round,
      ...newData
    });
  }
}

function computeRoundAverage(store, comp, round) {
  const scores = store.scores.filter(sc => sc.competition === comp && sc.round === round && sc.isFinal && typeof sc.points === "number");
  if (!scores.length) return null;
  const sum = scores.reduce((a, b) => a + b.points, 0);
  return Math.round(sum / scores.length);
}

function getManagerScore(managerId, comp, round) {
  const s = getStore();
  return s.scores.find(sc => sc.managerId === managerId && sc.competition === comp && sc.round === round) || null;
}

async function syncUCL(roundsToSync = null) {
  const s = await loadStore();
  const current = s.settings.currentRound.ucl;
  const rounds = roundsToSync || [current - 1, current].filter(Boolean);

  const eligible = getEligibleManagers("ucl");

  for (const mgr of s.managers) {
    if (!mgr.ucl || !mgr.ucl.teamId) continue;
    const teamId = mgr.ucl.teamId;

    for (const r of rounds) {
      let points = null;
      let source = "pending";

      if (UCL_TEMPLATE) {
        const url = UCL_TEMPLATE
          .replace("{teamId}", teamId)
          .replace("{round}", r);
        try {
          const data = await safeFetchJSON(url);
          if (data && typeof data.points === "number") {
            points = data.points;
            source = "ucl-api";
          }
        } catch (e) {}
      }

      // Demo / fallback. UCL Fantasy public picks API is limited (gaming.uefa.com - often login or manual). Use template or third-party like sportmonks if available. Current adapter supports points via UCL_TEMPLATE.
      if (points === null && DEMO_MODE) {
        const base = 48 + Math.floor(Math.random() * 28);
        points = base;
        source = "ucl-adapter-demo";
      }

      const isFinal = r < current || (r === current && source !== "pending");
      upsertScore(s, mgr.id, "ucl", r, points, source, isFinal);
    }
  }

  s.settings.lastSyncAt = nowISO();
  await persistStore();
  await autoSettleIfNeeded();
  await logEvent("sync_ucl_completed", { rounds });
  return { ok: true };
}

// ============ WALLET & CALCULATIONS (fines removed) ============

function getWalletBalance(managerId) {
  const s = getStore();
  return s.ledger
    .filter(l => l.managerId === managerId)
    .reduce((sum, l) => sum + (l.amount || 0), 0);
}

function getProjectedPayouts() {
  // Enhanced: admin fees (5k/manager), sponsorships added to pots. Base pot = paid * 500 * 0.9. Sponsored funds boost specific awards (gw, captain, league).
  const s = getStore();
  const fplPaid = getEligibleManagers("fpl").length;
  const uclPaid = getEligibleManagers("ucl").length;

  const fplPotPerWeek = fplPaid * COMPETITIONS.fpl.contributionPerRound * 0.9;
  const uclPotPerMD = uclPaid * COMPETITIONS.ucl.contributionPerRound * 0.9;

  // Rough season totals + admin
  const fplReserve = fplPaid * (COMPETITIONS.fpl.contributionPerRound * 0.1 * 38 + COMPETITIONS.fpl.extraReserve);
  const uclReserve = uclPaid * (COMPETITIONS.ucl.contributionPerRound * 0.1 * 17 + COMPETITIONS.ucl.extraReserve);

  const sponsored = (s.sponsorships || []).reduce((sum, sp) => sum + (sp.amount || 0), 0);

  return {
    fpl: {
      weeklyPot90: Math.floor(fplPotPerWeek),
      seasonReserve: Math.floor(fplReserve + sponsored * 0.4)
    },
    ucl: {
      mdPot90: Math.floor(uclPotPerMD),
      phaseReserve: Math.floor(uclReserve + sponsored * 0.4)
    },
    adminTotal: (fplPaid + uclPaid) * 5000,
    note: "Base: paid_managers × 500 × 0.9 to winner. 5k admin/manager for server/ops. Sponsors boost specific pots (e.g. best captain award)."
  };
}

// ============ LEADERBOARDS & VIEWS ============

function buildManagerView(mgr) {
  const s = getStore();
  const fplPaid = isFullyPaidFor(mgr, "fpl");
  const uclPaid = isFullyPaidFor(mgr, "ucl");

  const currentFpl = getManagerScore(mgr.id, "fpl", s.settings.currentRound.fpl);
  const currentUcl = getManagerScore(mgr.id, "ucl", s.settings.currentRound.ucl);

  const fplTotal = s.scores
    .filter(sc => sc.managerId === mgr.id && sc.competition === "fpl" && typeof sc.points === "number")
    .reduce((a, b) => a + b.points, 0);

  const uclTotal = s.scores
    .filter(sc => sc.managerId === mgr.id && sc.competition === "ucl" && typeof sc.points === "number")
    .reduce((a, b) => a + b.points, 0);

  const wallet = getWalletBalance(mgr.id);

  const recentFpl = currentFpl || {};
  return {
    id: mgr.id,
    displayName: mgr.displayName,
    email: mgr.email,
    fplTeam: mgr.fpl || {},
    uclTeam: mgr.ucl || {},
    fplPaid,
    uclPaid,
    currentFpl: currentFpl ? currentFpl.points : null,
    currentFplSource: currentFpl ? currentFpl.source : "pending",
    currentUcl: currentUcl ? currentUcl.points : null,
    currentUclSource: currentUcl ? currentUcl.source : "pending",
    fplTotal,
    uclTotal,
    combined: fplTotal + uclTotal,
    wallet,
    // no fines
    // Detailed FPL data for squad view
    recentCaptain: recentFpl.captain || null,
    recentCaptainName: recentFpl.captainName || null,
    recentChip: recentFpl.activeChip || null,
    recentPicks: recentFpl.picks || [],
    recentTransfers: recentFpl.transfers || 0
  };
}

function getFullLeaderboard() {
  const s = getStore();
  const managers = s.managers.map(m => buildManagerView(m));
  // Only show fully eligible in main tables? Show all but mark paid status. Leaderboards filter paid.
  const paidFpl = managers.filter(m => m.fplPaid).sort((a, b) => (b.fplTotal || 0) - (a.fplTotal || 0));
  const paidUcl = managers.filter(m => m.uclPaid).sort((a, b) => (b.uclTotal || 0) - (a.uclTotal || 0));
  const combined = managers.filter(m => m.fplPaid && m.uclPaid).sort((a, b) => b.combined - a.combined);

  return { all: managers, fpl: paidFpl, ucl: paidUcl, combined };
}

function getH2HForManager(managerId) {
  const s = getStore();
  return s.h2h.filter(h => h.managerA === managerId || h.managerB === managerId);
}

// ============ SAFE FETCH ============

function safeFetchJSON(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { "User-Agent": "DLeagueClubhouse/1.0" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
  });
}

// ============ DEMO SEED ============

async function seedDemoData(force = false) {
  if (!DEMO_MODE && !force) return; // Never auto-seed fake managers in live/prod
  const s = await loadStore();
  if (s.managers.length > 0 && !force) return;

  // Only seed demo fakes when explicitly in DEMO_MODE (for local testing)
  const demoManagers = [
    { displayName: "Ayo Balogun", email: "ayo@dleague.ng", code: "ayo2026", fplId: "4782912", uclId: "ucl-ayo-91", club: "Ayo's Army" },
    { displayName: "Chinedu Eze", email: "chinedu@dleague.ng", code: "chi2026", fplId: "3129847", uclId: "ucl-chi-47", club: "Chinedu FC" },
    { displayName: "Amara Okoro", email: "amara@dleague.ng", code: "ama2026", fplId: "5567341", uclId: "ucl-ama-12", club: "Amara's Amazons" },
    { displayName: "Emeka Obi", email: "emeka@dleague.ng", code: "eme2026", fplId: "1982734", uclId: "ucl-eme-88", club: "Emeka Elite" },
    { displayName: "Fatima Sule", email: "fatima@dleague.ng", code: "fat2026", fplId: "6671203", uclId: "ucl-fat-55", club: "Fatima's Force" },
    { displayName: "Tunde Adebayo", email: "tunde@dleague.ng", code: "tun2026", fplId: "4458921", uclId: "ucl-tun-29", club: "Tunde Titans" },
    { displayName: "Zainab Ibrahim", email: "zainab@dleague.ng", code: "zai2026", fplId: "7783945", uclId: "ucl-zai-03", club: "Zainab Zest" },
    { displayName: "Chukwudi Nwosu", email: "chukwudi@dleague.ng", code: "chu2026", fplId: "2234765", uclId: "ucl-chu-71", club: "Chukwudi Champions" },
    { displayName: "Oluchi Nwankwo", email: "oluchi@dleague.ng", code: "olu2026", fplId: "9912345", uclId: "ucl-olu-55", club: "Oluchi Overlords" },
    { displayName: "Babajide Okafor", email: "baba@dleague.ng", code: "baba2026", fplId: "6678912", uclId: "ucl-baba-22", club: "Baba's Brigade" }
  ];

  s.managers = [];
  s.payments = [];
  s.scores = [];
  s.ledger = [];
  s.h2h = [];

  const now = nowISO();

  demoManagers.forEach((dm, idx) => {
    const id = generateId("mgr");
    const mgr = {
      id,
      displayName: dm.displayName,
      email: dm.email,
      accessCode: dm.code,
      fpl: { teamId: dm.fplId, teamName: dm.club || (dm.displayName.split(" ")[0] + " FC") },
      ucl: { teamId: dm.uclId, teamName: dm.club || (dm.displayName.split(" ")[0] + " United") },
      payoutDetails: "058:0001234567:" + dm.displayName, // bank_code:account_number:name for Paystack transfer (test format)
      fplClubName: dm.club || (dm.displayName.split(" ")[0] + " FC"),
      createdAt: now
    };
    s.managers.push(mgr);

    // Seed confirmed payments for most
    const payFpl = idx % 3 !== 0; // most paid
    const payUcl = idx % 2 === 0;

    if (payFpl) {
      s.payments.push({
        id: generateId("pay"),
        managerId: id,
        competition: "fpl",
        amount: COMPETITIONS.fpl.seasonFee,
        reference: "demo_fpl_" + id,
        status: "confirmed",
        confirmedAt: now
      });
    }
    if (payUcl) {
      s.payments.push({
        id: generateId("pay"),
        managerId: id,
        competition: "ucl",
        amount: COMPETITIONS.ucl.seasonFee,
        reference: "demo_ucl_" + id,
        status: "confirmed",
        confirmedAt: now
      });
    }
  });

  // Seed scores for past + current rounds
  const curF = s.settings.currentRound.fpl;
  const curU = s.settings.currentRound.ucl;

  s.managers.forEach((m, i) => {
    // FPL scores
    for (let r = 1; r <= curF; r++) {
      const isFinal = r < curF || (r === curF && Math.random() > 0.3);
      const pts = 52 + Math.floor(Math.sin(i + r) * 18) + Math.floor((i % 3) * 4) + (r * 1);
      upsertScore(s, m.id, "fpl", r, Math.max(38, Math.min(pts, 98)), isFinal ? "official-fpl" : "live-projection", isFinal);
    }
    // UCL
    for (let r = 1; r <= curU; r++) {
      const isFinal = r < curU;
      const pts = 45 + Math.floor(Math.cos(i * 2 + r) * 14) + (r * 2);
      upsertScore(s, m.id, "ucl", r, Math.max(31, Math.min(pts, 81)), isFinal ? "ucl-adapter-demo" : "pending", isFinal);
    }
  });

  // Simulate rich recentPicks for lineup viewer (FPL style data)
  s.managers.forEach((m, i) => {
    const recentFpl = s.scores.find(sc => sc.managerId === m.id && sc.competition === "fpl" && sc.round === curF);
    if (recentFpl) {
      recentFpl.picks = [
        { element: 100 + i, name: "Salah", type: 3, team: "LIV", teamColor: "#C8102E", position: 1, multiplier: 2, points: 12 + (i%5) },
        { element: 200 + i, name: "Haaland", type: 4, team: "MCI", teamColor: "#6CABDD", position: 2, multiplier: 1, points: 8 + (i%4) },
        { element: 300 + i, name: "Saka", type: 3, team: "ARS", teamColor: "#DB0007", position: 3, multiplier: 1, points: 6 + (i%3) },
        // ... more for full demo squad
      ];
      // bench
      recentFpl.picks.push({ element: 400 + i, name: "Bench GK", type: 1, team: "TOT", teamColor: "#132257", position: 12, multiplier: 0, points: 1 });
      recentFpl.picks.push({ element: 500 + i, name: "Bench Def", type: 2, team: "CHE", teamColor: "#034694", position: 13, multiplier: 0, points: 2 + (i%2) });
    }
  });

  // H2H sample
  const [m1, m2, m3] = s.managers;
  if (m1 && m2) {
    s.h2h.push({
      id: generateId("h2h"),
      round: "GW5",
      managerA: m1.id, managerB: m2.id,
      stake: 5000,
      status: "settled",
      winner: m1.id,
      note: "Ayo wins on GW5"
    });
  }
  if (m2 && m3) {
    s.h2h.push({
      id: generateId("h2h"),
      round: "GW6",
      managerA: m2.id, managerB: m3.id,
      stake: 3000,
      status: "open",
      winner: null
    });
  }

  // Cup bracket sample
  s.cup.bracket = [
    { match: "QF1", a: s.managers[0].displayName, b: s.managers[1].displayName, winner: s.managers[0].displayName },
    { match: "QF2", a: s.managers[2].displayName, b: s.managers[3].displayName, winner: null },
    { match: "QF3", a: s.managers[4].displayName, b: s.managers[5].displayName, winner: null },
    { match: "QF4", a: s.managers[6].displayName, b: s.managers[7].displayName, winner: null }
  ];

  // Challenges (expanded for demo - plenty innovative)
  s.challenges = [
    { id: generateId("ch"), title: "Most Clean Sheets GW6", status: "open", prize: 2000, entrants: 4 },
    { id: generateId("ch"), title: "Highest Scoring MD3 UCL", status: "settled", prize: 1500, entrants: 6, winner: s.managers[1].displayName },
    { id: generateId("ch"), title: "Captain Clutch - FPL GW", status: "settled", prize: 5000, entrants: 8, winner: s.managers[0].displayName },
    { id: generateId("ch"), title: "Bench Bandit", status: "open", prize: 3500, entrants: 5 },
    { id: generateId("ch"), title: "Transfer Terror", status: "settled", prize: 4000, entrants: 7, winner: s.managers[2].displayName },
    { id: generateId("ch"), title: "UCL Defensive Wall", status: "open", prize: 2500, entrants: 4 }
  ];

  // Ledger seed for payouts + auto settled awards/challenges (rich demo history)
  const top = s.managers[0];
  const second = s.managers[1];
  if (top) {
    s.ledger.push({ id: generateId("ldg"), type: "pot_win", managerId: top.id, competition: "fpl", round: 2, amount: 4500, note: "GW2 winner (90%)", at: now });
    s.ledger.push({ id: generateId("ldg"), type: "reserve", managerId: top.id, competition: "fpl", round: null, amount: 1200, note: "League reserve share", at: now });
    s.ledger.push({ id: generateId("ldg"), type: "award_win", managerId: top.id, competition: "fpl", round: curF, amount: 10000, note: "Won Captain Clutch Award - sponsored by Local Legend FC", at: now });
    s.ledger.push({ id: generateId("ldg"), type: "challenge_win", managerId: top.id, competition: "fpl", round: curF, amount: 5000, note: "Won Captain Clutch challenge", at: now });
  }
  if (second) {
    s.ledger.push({ id: generateId("ldg"), type: "award_win", managerId: second.id, competition: "fpl", round: curF, amount: 5500, note: "Won Clean Sheet King - sponsored by Defence United", at: now });
    s.ledger.push({ id: generateId("ldg"), type: "challenge_win", managerId: second.id, competition: "ucl", round: curU, amount: 4000, note: "Won UCL Goal King", at: now });
  }

  s.settings.lastSyncAt = nowISO();

  await persistStore();
  await logEvent("demo_seeded", { count: s.managers.length });
}

async function ensureAdminManager() {
  // On live (non-demo), ensure the real admin exists. NEVER wipe user data.
  const s = await loadStore();

  // Purge ONLY leftover demo/fake managers on live. Real users are untouched.
  if (!DEMO_MODE) {
    const before = s.managers.length;
    s.managers = s.managers.filter(m => !String(m.email || "").includes("dleague.ng"));
    if (s.managers.length !== before) {
      await persistStore();
      console.log(`[live] Purged ${before - s.managers.length} demo accounts (real data preserved)`);
    }
  }

  const existing = s.managers.find(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (existing) {
    // Make sure the code matches what we want for the admin
    if (existing.accessCode !== ADMIN_ACCESS_CODE) {
      existing.accessCode = ADMIN_ACCESS_CODE;
      await persistStore();
    }
    return;
  }

  // Create the real admin manager ONLY if missing. Never resets existing users.
  const id = generateId("mgr");
  const now = nowISO();
  const adminMgr = {
    id,
    displayName: "Bolade Oladejo",
    email: ADMIN_EMAIL,
    accessCode: ADMIN_ACCESS_CODE,
    fpl: { teamId: "", teamName: "" },
    ucl: { teamId: "", teamName: "" },
    payoutDetails: "",
    fplClubName: "Bolade's Brigade",
    createdAt: now,
    isAdmin: true
  };
  s.managers.push(adminMgr);
  await persistStore();
  await logEvent("admin_bootstrapped", { email: ADMIN_EMAIL });
  console.log(`✅ Admin account ready: ${ADMIN_EMAIL} (code: ${ADMIN_ACCESS_CODE})`);
}

// Expose for scripts
exports.seedDemoIfNeeded = seedDemoData;

// ============ ROUTES ============

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: nowISO(), demo: DEMO_MODE, version: "1.0.0" });
});

app.get("/api/config", (req, res) => {
  res.json({
    demoMode: DEMO_MODE,
    paystackPublicKey: DEMO_MODE ? "pk_test_demo" : PAYSTACK_PUBLIC,
    callbackUrl: PAYSTACK_CALLBACK,
    competitions: COMPETITIONS,
    liveProjectionTemplate: !!LIVE_FPL_TEMPLATE,
    uclAdapterTemplate: !!UCL_TEMPLATE
  });
});

app.post("/api/auth/login", async (req, res) => {
  if (DEMO_MODE) await seedDemoData();
  const { email, code } = req.body || {};
  const s = await loadStore();

  const mgr = s.managers.find(m => m.email.toLowerCase() === String(email || "").toLowerCase());
  if (!mgr) return res.status(404).json({ error: "Manager not found. Contact the league commissioner to be added and receive your access code + email." });
  if (mgr.accessCode !== code) return res.status(401).json({ error: "Invalid access code" });

  const token = signToken({ managerId: mgr.id, iat: Date.now() });
  const view = buildManagerView(mgr);

  res.json({
    token,
    manager: view,
    message: "Welcome to the D League Clubhouse"
  });
});

app.post("/api/join-request", async (req, res) => {
  if (DEMO_MODE) await seedDemoData();
  const { name, email, fplClubName, fplLeagueJoined, message } = req.body || {};
  if (!name || !email || !fplClubName) return res.status(400).json({ error: "Name, email and FPL club name required (to confirm league join)" });

  const s = await loadStore();
  await logEvent("join_request", { name, email, fplClubName, fplLeagueJoined: !!fplLeagueJoined, message });
  await notifyAdminOfJoinRequest({ name, email, fplClubName });

  // Real emails: the console above shows the details. Admin checks /api/admin/overview or events.
  // In future: wire nodemailer with your SMTP (Gmail app password, SendGrid etc).
  res.json({ ok: true, message: "Request received! Check your email (" + email + "). The commissioner will send your access code shortly." });
});

// Admin endpoint to add a new manager (protected with SYNC_TOKEN as X-Admin-Token for simplicity)
app.post("/api/admin/add-manager", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  const { name, email, accessCode, fplId, uclId, fplClubName, payoutDetails } = req.body || {};
  if (!name || !email || !accessCode) return res.status(400).json({ error: "name, email, accessCode required" });

  const s = await loadStore();
  const existing = s.managers.find(m => m.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      // Admin re-registering as participant - update his profile
      if (fplId) existing.fpl = { teamId: fplId, teamName: fplClubName || existing.fpl?.teamName || '' };
      if (uclId) existing.ucl = { teamId: uclId, teamName: fplClubName || existing.ucl?.teamName || '' };
      if (fplClubName) existing.fplClubName = fplClubName;
      existing.accessCode = accessCode; // allow reset code if needed
      await persistStore();
      await logEvent("admin_registered_as_manager", { email, name, fplClubName });
      return res.json({ ok: true, manager: { id: existing.id, displayName: name, email, accessCode }, message: "Admin profile updated as manager. Share the accessCode." });
    }
    return res.status(409).json({ error: "Manager with this email already exists" });
  }

  const id = generateId("mgr");
  const mgr = {
    id,
    displayName: name,
    email,
    accessCode,
    fpl: { teamId: fplId || `test-${id.slice(-6)}`, teamName: fplClubName || `${name} FC` },
    ucl: { teamId: uclId || `ucl-${id.slice(-6)}`, teamName: fplClubName || `${name} United` },
    payoutDetails: payoutDetails || `058:0001234567:${name}`,
    fplClubName: fplClubName || `${name} FC`,
    createdAt: nowISO()
  };
  s.managers.push(mgr);
  await persistStore();
  await logEvent("manager_added", { email, name, fplClubName, by: "admin", accessCode });

  // Auto-send access code email if SMTP is configured
  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.FROM_EMAIL || ADMIN_EMAIL,
        to: email,
        subject: "D League Clubhouse - Welcome! Your Access Code",
        text: `Hi ${name},\n\nYour join request has been approved.\n\nLogin with:\nEmail: ${email}\nAccess Code: ${accessCode}\n\nFPL Club: ${fplClubName || ''}\n\nWelcome to the D League Clubhouse!`
      });
    } catch (e) {
      console.error("Failed to send access code email:", e.message);
    }
  }

  res.json({ ok: true, manager: { id, displayName: name, email, accessCode }, message: "Manager added. Share the accessCode with them." });
});

// Admin cancel challenge
app.post("/api/admin/cancel-challenge", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) return res.status(403).json({ error: "Unauthorized" });
  }

  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: "challenge id required" });

  const s = await loadStore();
  const ch = s.challenges.find(c => c.id === id);
  if (!ch) return res.status(404).json({ error: "Challenge not found" });
  if (ch.status !== "open") return res.status(400).json({ error: "Challenge is not open" });

  ch.status = "cancelled";
  ch.cancelReason = reason || "Cancelled by admin";
  await persistStore();
  await logEvent("challenge_cancelled", { id, title: ch.title, reason: ch.cancelReason, by: "admin" });

  res.json({ ok: true, message: `Challenge "${ch.title}" cancelled.` });
});

// Admin cancel sponsorship / award
app.post("/api/admin/cancel-sponsorship", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) return res.status(403).json({ error: "Unauthorized" });
  }

  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: "sponsorship id required" });

  const s = await loadStore();
  const idx = (s.sponsorships || []).findIndex(sp => sp.id === id);
  if (idx === -1) return res.status(404).json({ error: "Sponsorship not found" });

  const removed = s.sponsorships.splice(idx, 1)[0];
  await persistStore();
  await logEvent("sponsorship_cancelled", { id, sponsor: removed.sponsor, amount: removed.amount, reason: reason || "Cancelled by admin", by: "admin" });

  res.json({ ok: true, message: `Sponsorship by ${removed.sponsor} cancelled.` });
});

// Admin force settle a specific challenge (pick winner or cancel)
app.post("/api/admin/settle-challenge", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) return res.status(403).json({ error: "Unauthorized" });
  }

  const { id, winnerManagerId, winnerName } = req.body || {};
  if (!id) return res.status(400).json({ error: "challenge id required" });

  const s = await loadStore();
  const ch = s.challenges.find(c => c.id === id);
  if (!ch || ch.status !== "open") return res.status(404).json({ error: "Open challenge not found" });

  let winnerDisplay = winnerName;
  if (winnerManagerId) {
    const w = s.managers.find(m => m.id === winnerManagerId);
    if (w) winnerDisplay = w.displayName;
  }

  const commission = Math.floor(ch.prize * 0.1);
  const winnerShare = ch.prize - commission;

  s.ledger.push({
    id: generateId("ldg"),
    type: "challenge_win",
    managerId: winnerManagerId || "manual",
    competition: "fpl",
    round: s.settings.currentRound.fpl,
    amount: winnerShare,
    note: `Forced settle: ${ch.title} - Winner: ${winnerDisplay} (90%)`,
    at: nowISO()
  });
  s.ledger.push({
    id: generateId("ldg"),
    type: "house_commission",
    managerId: "house",
    competition: "fpl",
    round: s.settings.currentRound.fpl,
    amount: -commission,
    note: `House 10% from forced ${ch.title}`,
    at: nowISO()
  });

  ch.status = "settled";
  ch.winner = winnerDisplay;
  ch.forced = true;

  await persistStore();
  await logEvent("challenge_settled", { id, title: ch.title, winner: winnerDisplay, by: "admin" });

  res.json({ ok: true, message: `Challenge settled. Winner: ${winnerDisplay}` });
});

app.get("/api/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.managerId) return res.status(401).json({ error: "Unauthorized" });

  const mgr = getManagerById(decoded.managerId);
  if (!mgr) return res.status(404).json({ error: "Not found" });

  res.json({ manager: buildManagerView(mgr) });
});

app.get("/api/standings", async (req, res) => {
  if (DEMO_MODE) await seedDemoData();
  const lb = getFullLeaderboard();
  const s = getStore();
  res.json({
    currentRound: s.settings.currentRound,
    roundAverages: s.settings.roundAverages,
    ...lb,
    projections: getProjectedPayouts()
  });
});

app.get("/api/manager/:id/full", async (req, res) => {
  const mgr = getManagerById(req.params.id);
  if (!mgr) return res.status(404).json({ error: "Manager not found" });

  const s = getStore();
  const view = buildManagerView(mgr);
  const fplScores = s.scores.filter(sc => sc.managerId === mgr.id && sc.competition === "fpl");
  const uclScores = s.scores.filter(sc => sc.managerId === mgr.id && sc.competition === "ucl");
  const ledger = s.ledger.filter(l => l.managerId === mgr.id);
  const h2h = getH2HForManager(mgr.id);

  res.json({
    ...view,
    fplScores,
    uclScores,
    ledger,
    h2h,
    eligibleFpl: isFullyPaidFor(mgr, "fpl"),
    eligibleUcl: isFullyPaidFor(mgr, "ucl")
  });
});

// Initiate Paystack payment (real or demo)
app.post("/api/payments/initiate", async (req, res) => {
  const { managerId, competition } = req.body || {};
  const mgr = getManagerById(managerId);
  if (!mgr) return res.status(404).json({ error: "Manager not found" });

  const comp = COMPETITIONS[competition];
  if (!comp) return res.status(400).json({ error: "Invalid competition" });

  if (isFullyPaidFor(mgr, competition)) {
    return res.json({ alreadyPaid: true });
  }

  const adminFee = comp.adminFee || 0;
  const totalAmount = comp.seasonFee + adminFee;
  const reference = `DL-${competition.toUpperCase()}-${Date.now()}-${mgr.id.slice(-6)}`;

  const s = await loadStore();
  s.payments.push({
    id: generateId("pay"),
    managerId: mgr.id,
    competition,
    amount: totalAmount,
    reference,
    status: "pending",
    initiatedAt: nowISO(),
    breakdown: { season: comp.seasonFee, admin: adminFee }
  });
  await persistStore();

  if (DEMO_MODE || !PAYSTACK_PUBLIC) {
    // Demo response — client will call simulate
    return res.json({
      demo: true,
      reference,
      amount: comp.seasonFee,
      authorizationUrl: null,
      message: "Demo mode. Use simulate endpoint after."
    });
  }

  // Real Paystack initialize
  try {
    const initRes = await fetchPaystackInit(reference, comp.seasonFee, mgr, competition);
    return res.json({
      reference,
      amount: comp.seasonFee,
      authorizationUrl: initRes.authorization_url,
      accessCode: initRes.access_code
    });
  } catch (e) {
    return res.status(502).json({ error: "Failed to initialize Paystack transaction" });
  }
});

async function fetchPaystackInit(reference, amount, mgr, competition) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: mgr.email,
      amount: amount * 100, // kobo
      reference,
      callback_url: PAYSTACK_CALLBACK,
      metadata: { managerId: mgr.id, competition, league: "D League" }
    });

    const options = {
      hostname: "api.paystack.co",
      path: "/transaction/initialize",
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const body = JSON.parse(data);
          if (body.status && body.data) resolve(body.data);
          else reject(new Error("Paystack init failed"));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// Simulate success (DEMO ONLY)
app.post("/api/payments/simulate-success", async (req, res) => {
  if (!DEMO_MODE) return res.status(403).json({ error: "Not available in production" });

  const { reference } = req.body || {};
  const s = await loadStore();
  const p = s.payments.find(pp => pp.reference === reference);
  if (!p) return res.status(404).json({ error: "Payment not found" });

  await confirmPayment(p.managerId, p.competition, reference, p.amount, { simulated: true });
  const mgr = getManagerById(p.managerId);

  res.json({ success: true, manager: buildManagerView(mgr) });
});

// Paystack webhook — THE ONLY WAY TO CONFIRM PAYMENTS
app.post("/api/paystack/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const rawBody = JSON.stringify(req.body);

  if (PAYSTACK_SECRET) {
    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET).update(rawBody).digest("hex");
    if (hash !== signature) {
      await logEvent("webhook_invalid_signature", {});
      return res.status(400).send("Invalid signature");
    }
  }

  const event = req.body;
  if (event && event.event === "charge.success") {
    const data = event.data || {};
    const reference = data.reference;
    const amountKobo = data.amount;
    const amountNaira = Math.round((amountKobo || 0) / 100);

    const s = await loadStore();
    const pending = s.payments.find(p => p.reference === reference && p.status !== "confirmed");

    if (pending) {
      await confirmPayment(pending.managerId, pending.competition, reference, amountNaira, data);
      await logEvent("webhook_charge_success", { reference });
    }
  }

  res.status(200).send("OK");
});

// Protected sync (commissioner can also trigger via their login token)
app.post("/api/sync/run", async (req, res) => {
  if (!DEMO_MODE) {
    const syncTok = req.headers["x-sync-token"] || req.query.token;
    let allowed = !!(SYNC_TOKEN && syncTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: "Unauthorized" });
    }
  }
  const { comp } = req.body || {};
  let result;

  if (!comp || comp === "fpl") result = await syncFPL();
  if (comp === "ucl") result = await syncUCL();

  await autoSettleIfNeeded();
  const s = await loadStore();
  res.json({ ok: true, result, lastSyncAt: s.settings.lastSyncAt });
});

// Full export (protected)
app.get("/api/export/full", requireExportAuth, async (req, res) => {
  const s = await loadStore();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="d-league-export-${Date.now()}.json"`);
  res.send(JSON.stringify(s, null, 2));
});

// Get all managers (paid view for community)
app.get("/api/community", async (req, res) => {
  if (DEMO_MODE) await seedDemoData();
  const lb = getFullLeaderboard();
  const s = getStore();
  res.json({
    season: s.settings.seasonName,
    currentRound: s.settings.currentRound,
    averages: s.settings.roundAverages,
    lastSync: s.settings.lastSyncAt,
    paidFplCount: lb.fpl.length,
    paidUclCount: lb.ucl.length,
    managers: lb.all.map(m => ({
      id: m.id,
      name: m.displayName,
      fplPaid: m.fplPaid,
      uclPaid: m.uclPaid,
      fplScore: m.fplTotal,
      uclScore: m.uclTotal,
      combined: m.combined,
      currentFpl: m.currentFpl,
      currentUcl: m.currentUcl,
      // no fines
      wallet: m.wallet
    }))
  });
});

// H2H, Cup, Challenges endpoints (read mostly)
app.get("/api/h2h", async (req, res) => {
  const s = await loadStore();
  res.json({ h2h: s.h2h });
});

app.get("/api/cup", async (req, res) => {
  const s = await loadStore();
  res.json({ cup: s.cup });
});

app.get("/api/challenges", async (req, res) => {
  const s = await loadStore();
  res.json({ challenges: s.challenges });
});

app.get("/api/ledger", async (req, res) => {
  const s = await loadStore();
  res.json({ ledger: s.ledger.slice(0, 80) });
});

app.get("/api/payouts", async (req, res) => {
  res.json(getProjectedPayouts());
});

// Simple live ticker data
app.get("/api/ticker", async (req, res) => {
  const s = await loadStore();
  const messages = [
    `GW${s.settings.currentRound.fpl} live projections updating`,
    "Paystack webhooks are the only source of truth for payments",
    `UCL MD${s.settings.currentRound.ucl} — 8 managers eligible`,
    "No fines - removed per rules",
    "Cup QF live — check bracket"
  ];
  res.json({ messages, lastSync: s.settings.lastSyncAt });
});

// Admin-ish overview (no sensitive data)
app.get("/api/admin/overview", async (req, res) => {
  const s = await loadStore();
  const paidFpl = getEligibleManagers("fpl").length;
  const paidUcl = getEligibleManagers("ucl").length;

  const recentLedger = (s.ledger || []).slice(0, 20);
  const recentEvents = (s.events || []).slice(0, 15);
  const allChallenges = (s.challenges || []);
  const sponsorships = (s.sponsorships || []);
  const totalHouseCommission = (s.ledger || []).filter(l => l.type === "house_commission").reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);

  // Full managers summary for admin insight (no sensitive payout details)
  const managersSummary = s.managers.map(m => ({
    id: m.id,
    displayName: m.displayName,
    email: m.email,
    fplClubName: m.fplClubName || '',
    fplPaid: !!s.payments.find(p => p.managerId === m.id && p.competition === 'fpl' && p.status === 'confirmed'),
    uclPaid: !!s.payments.find(p => p.managerId === m.id && p.competition === 'ucl' && p.status === 'confirmed'),
    fplTeam: m.fpl || {},
    uclTeam: m.ucl || {}
  }));

  res.json({
    totalManagers: s.managers.length,
    paidFpl,
    paidUcl,
    totalPaymentsConfirmed: s.payments.filter(p => p.status === "confirmed").length,
    totalFines: 0,
    lastSync: s.settings.lastSyncAt,
    reserveEstimate: getProjectedPayouts(),
    recentLedger,
    recentEvents,
    challenges: allChallenges,
    sponsorships,
    managers: managersSummary,
    totalHouseCommission
  });
});

// Trigger settlement (protected, for admin/commissioner)
app.post("/api/settle/run", async (req, res) => {
  if (!DEMO_MODE) {
    const syncTok = req.headers["x-sync-token"] || req.query.token;
    let allowed = !!(SYNC_TOKEN && syncTok === SYNC_TOKEN);
    if (!allowed) {
      // allow logged-in commissioner (the ayo account) using their normal login Bearer token
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            allowed = true;
          }
        }
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: "Unauthorized" });
    }
  }
  const { comp } = req.body || {};
  await autoSettleIfNeeded();
  if (comp === "fpl" || !comp) await settleWeeklyPot("fpl", (await loadStore()).settings.currentRound.fpl);
  if (comp === "ucl" || !comp) await settleWeeklyPot("ucl", (await loadStore()).settings.currentRound.ucl);
  res.json({ ok: true, message: "Settlements processed, payouts initiated where possible." });
});

// Catch all for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(BASE_DIR, "public", "index.html"));
});

// ============ BOOT ============

async function boot() {
  const store = await loadStore();
  console.log(`[BOOT] Store loaded with ${store.managers?.length || 0} managers (non-demo: protected mode)`);

  if (DEMO_MODE) {
    await seedDemoData();
  } else {
    await ensureAdminManager();
  }
  app.listen(PORT, () => {
    console.log(`\n✅  D League Clubhouse is running!`);
    console.log(`    Open this in your browser:  http://localhost:${PORT}\n`);
    console.log(`    (Keep this terminal window open while using the app)`);
    console.log(`    DEMO_MODE=${DEMO_MODE}  |  NODE_ENV=${process.env.NODE_ENV || "development"}\n`);
  });
}

boot().catch(err => {
  console.error("Boot failed", err);
  process.exit(1);
});
