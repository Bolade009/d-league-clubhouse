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
const FOOTBALL_API_KEY = process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY || ""; // football-data.org or API-Football style
const FOOTBALL_API_BASE = "https://api.football-data.org/v4"; // using football-data.org as example third-party (free tier available)

// Live admin (only this email can see backend admin view + trigger protected actions)
const ADMIN_EMAIL = "bolade.oladejo@gmail.com";
const ADMIN_ACCESS_CODE = "DLeagueAdmin!2026@*";

// No protected auto-restored managers in production. All managers come from real registration + payment.

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

    // Verify connection on startup (very helpful for debugging Gmail/Render)
    mailer.verify(function (error, success) {
      if (error) {
        console.error("[mailer] Connection failed:", error.message);
      } else {
        console.log("[mailer] Server is ready to take messages");
      }
    });
  } catch (e) { console.warn("Mailer setup failed", e.message); }
}

// Diagnostic logs so you can see in Render if the SMTP env vars are actually visible
console.log("[env] SMTP_HOST present:", !!process.env.SMTP_HOST, "value starts with:", process.env.SMTP_HOST ? process.env.SMTP_HOST.substring(0,8) : "N/A");
if (process.env.SMTP_HOST) {
  console.log("[env] SMTP_PORT:", process.env.SMTP_PORT || "(default 587)");
  console.log("[env] SMTP_SECURE:", process.env.SMTP_SECURE || "(default false for 587)");
  console.log("[env] SMTP_USER present:", !!process.env.SMTP_USER);
  console.log("[env] FROM_EMAIL present:", !!process.env.FROM_EMAIL);
}

async function sendEmail(to, subject, text) {
  if (!mailer || !to) return false;
  try {
    await mailer.sendMail({
      from: process.env.FROM_EMAIL || ADMIN_EMAIL,
      to,
      subject,
      text
    });
    console.log(`[email] Sent to ${to}: ${subject}`);
    return true;
  } catch (e) {
    console.error("[email] Failed to send:", e.message);
    return false;
  }
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
    contributionPerRound: 600,
    extraReserve: 1500,
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
    contributionPerRound: 600,  // ~10,200 total for weekly/matchday pots over 17 MDs
    extraReserve: 0,
    adminFee: 2500,  // house fee for UCL (consistent with revenue tracking)
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
      currentRound: { fpl: 1, ucl: 1 },
      roundAverages: { fpl: 68, ucl: 52 },
      lastSyncAt: null,
      seasonName: "2026/27 D League",
      // Admin configured real league IDs for accurate standings, H2H, auto-settlements
      leagueIds: {
        fplClassic: "",  // e.g. "12345" for FPL league standings
        fplH2h: "",      // H2H league ID
        ucl: ""          // If UCL has equivalent identifier (or use internal)
      },
      leagueLocked: { fpl: false, ucl: false },  // Separate locks for FPL and UCL joins (admin controls independently)
      // Revenue tracking
      totalFplRevenue: 0,
      totalUclRevenue: 0,
      houseFplAdmin: 0,
      houseUclAdmin: 0,
      // Season pots: weekly contribs split, + direct 60/40 runner-up pots from 10% house cuts on beef/sponsor payments (immediate)
      fplOverallPot: 0,
      fplCupPot: 0,
      uclOverallPot: 0,
      h2hOverallPot: 0,
      seasonReserveBoost: 0,
      firstRunnerUpPot: 0,
      secondRunnerUpPot: 0,
      // History for season review
      history: {
        weekly: [],      // {round, comp, winners: [{id, points}], pot, split, at}
        awards: [],      // sponsored and preset awards given
        beefs: [],       // personal beefs resolved
        standings: []    // snapshots per round {round, comp, top: [...] }
      }
    },
    managers: [],
    payments: [],
    scores: [],
    ledger: [],
    h2h: [],
    cup: {
      name: "D League Cup 26/27",
      stage: "Quarter Finals",
      prizeFund: 85000,
      bracket: []
    },
    challenges: [],
    sponsorships: [], // {id, sponsor, amount, target: 'gw_winner'|'best_captain'|'league_winner' etc, round? }
    events: [],
    complaints: [], // {id, managerId, email, title, description, relatedRound?, at, status: 'open'|'resolved'}
    beefs: [] // server-persisted personal beefs: {id, proposerId, opponentIds, category, stake, status, paidFromWallet, at, ...}
  };
}

let storeCache = null;
let storeWriteLock = false;
let db = null;
let lastHealthPing = null;
let healthPingCount = 0;

// Module-level best-backup finder (usable from boot, recover, etc). Scans for max managers.
function findBestBackupData() {
  try {
    const backupsDir = path.join(DATA_DIR, "backups");
    if (!fsSync.existsSync(backupsDir)) return null;
    const candidates = [];

    // Stable non-pruned first
    for (const stable of ['store-best.json', 'store-latest.json']) {
      const p = path.join(backupsDir, stable);
      if (fsSync.existsSync(p)) {
        try {
          const data = JSON.parse(fsSync.readFileSync(p, "utf8"));
          const count = (data && Array.isArray(data.managers)) ? data.managers.length : 0;
          if (count > 0) candidates.push({ file: stable, count, data });
        } catch {}
      }
    }

    const files = fsSync.readdirSync(backupsDir)
      .filter(f => f.startsWith('store-') && f.endsWith('.json') && !f.includes('best') && !f.includes('latest'));
    for (const f of files) {
      try {
        const p = path.join(backupsDir, f);
        const data = JSON.parse(fsSync.readFileSync(p, "utf8"));
        const count = (data && Array.isArray(data.managers)) ? data.managers.length : 0;
        if (count > 0) candidates.push({ file: f, count, data });
      } catch {}
    }

    if (candidates.length === 0) return null;

    const looksDemo = (m) => !m || !m.email || String(m.email).includes("@dleague.ng") || String(m.displayName || "").toLowerCase().includes("demo");
    // Score: real count (exclude obvious demo) + tiny recency bonus. Sort prefers highest real count then newer file name.
    candidates.forEach(c => {
      const mgrs = c.data.managers || [];
      const demoCount = mgrs.filter(looksDemo).length;
      c.realCount = Math.max(0, mgrs.length - demoCount);
      c.isRecent = /2026-07-(1[0-9]|0[5-9])/.test(c.file); // bias recent month-ish
    });
    candidates.sort((a, b) => (b.realCount - a.realCount) || (b.file.localeCompare(a.file)) || (b.count - a.count) );

    const best = candidates[0];
    console.log(`[store] Best backup found: ${best.file} (total ${best.count}, real-ish ${best.realCount} managers)`);
    return best.data;
  } catch (e) { /* ignore */ }
  return null;
}

// === TOP LEVEL DURABLE WRITE HELPERS (hoisted so persistStore, boot, mutations can use them) ===
// These are the key to watertight on free tier sleeps: atomic + fsync JSON sidecars written early and often.
function writeAtomicSidecar(data) {
  try {
    const statePath = path.join(DATA_DIR, 'current-state.json');
    const tmpPath = statePath + '.tmp';
    const json = JSON.stringify(data, null, 2);
    fsSync.writeFileSync(tmpPath, json);
    fsSync.renameSync(tmpPath, statePath);
    try {
      const fd = fsSync.openSync(statePath, 'r');
      fsSync.fsyncSync(fd);
      fsSync.closeSync(fd);
    } catch {}
    return true;
  } catch (e) {
    console.warn('[sidecar] writeAtomicSidecar failed:', e.message);
    return false;
  }
}

function writeAtomicCollection(name, data) {
  try {
    const p = path.join(DATA_DIR, `current-${name}.json`);
    const tmp = p + '.tmp';
    fsSync.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fsSync.renameSync(tmp, p);
    try {
      const fd = fsSync.openSync(p, 'r');
      fsSync.fsyncSync(fd);
      fsSync.closeSync(fd);
    } catch {}
  } catch (e) {
    console.warn(`[atomic] Failed to write ${name}:`, e.message);
  }
}

// Reconstruct any beef records referenced by beef_stake payments but missing from beefs list.
// This guarantees "beefs never disappear" as long as their stake payments were initiated.
function reconstructBeefsFromPayments(s) {
  if (!s) return 0;
  s.beefs = s.beefs || [];
  const beefMap = new Map(s.beefs.map(b => [b.id, b]));
  const stakePays = (s.payments || []).filter(p => p && p.type === 'beef_stake' && p.beefId);
  let added = 0;
  stakePays.forEach(p => {
    if (!beefMap.has(p.beefId)) {
      const stakeAmt = Number(p.amount) || 0;
      const recovered = {
        id: p.beefId,
        proposerId: p.managerId,
        opponentIds: [],
        participants: [p.managerId],
        category: 'Recovered beef (from payment record)',
        stake: stakeAmt,
        status: 'accepted',
        paidBy: {},
        totalStaked: 0,
        prizePot: 0,
        at: p.confirmedAt || p.initiatedAt || nowISO(),
        reconstructed: true
      };
      s.beefs.push(recovered);
      beefMap.set(p.beefId, recovered);
      added++;
      console.log(`[beef] Reconstructed missing beef ${p.beefId} from stake payment for durability`);
    }
  });
  // Also fill/repair paidBy + prizePot from confirmed payments for all beefs
  s.beefs.forEach(b => {
    b.paidBy = b.paidBy || {};
    stakePays.filter(p => p.beefId === b.id && p.status === 'confirmed').forEach(p => {
      if (!b.paidBy[p.managerId]) {
        const amt = p.amount || b.stake || 0;
        b.paidBy[p.managerId] = { amount: amt, ref: p.reference, paidAt: p.confirmedAt || p.at };
        b.totalStaked = (b.totalStaked || 0) + amt;
      }
    });
    const paidSoFar = Object.values(b.paidBy).reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    if (paidSoFar > 0) {
      b.prizePot = Math.floor(paidSoFar * 0.9);
    }
  });
  if (added > 0) {
    writeAtomicCollection('beefs', s.beefs || []);
  }
  return added;
}

// Derive and set first/secondRunnerUpPot from all confirmed beef_stake + sponsor payments.
// This is the key to making runner-up funding solid even after restore/export of paid beefs.
// House cuts are 10% split 60/40. Call after bringing in payment/beef data via restore or repair.
function reconcileRunnerUpPots(s) {
  if (!s || !s.settings) return { first: 0, second: 0 };
  const payments = s.payments || [];
  let totalCuts = 0;

  // Sponsors (paystack path) - use payment records
  payments.filter(p => p.type === 'sponsor' && p.status === 'confirmed').forEach(p => {
    const amt = Number(p.amount) || 0;
    totalCuts += Math.floor(amt * 0.1);
  });

  // Beef cuts: derive from the beef records' paidBy (this is the authoritative "who paid how much for this beef").
  // Avoid using beef_stake payments here to prevent double-counting the same stakes.
  const beefs = s.beefs || [];
  beefs.forEach(b => {
    if (b.paidBy && typeof b.paidBy === 'object') {
      Object.values(b.paidBy).forEach(pay => {
        const amt = Number(pay && pay.amount) || 0;
        totalCuts += Math.floor(amt * 0.1);
      });
    }
  });

  // Wallet sponsors via sponsorships records (cuts applied directly in sponsor path)
  const sponsorships = s.sponsorships || [];
  sponsorships.forEach(sp => {
    const amt = Number(sp.amount) || 0;
    totalCuts += Math.floor(amt * 0.1);
  });

  const first = Math.floor(totalCuts * 0.6);
  const second = totalCuts - first;

  const prevFirst = s.settings.firstRunnerUpPot || 0;
  const prevSecond = s.settings.secondRunnerUpPot || 0;

  // Take the max so we don't lose value if some was already awarded or manually adjusted upward.
  // For a fresh restore of paid data, this will populate the correct value from the paid records.
  s.settings.firstRunnerUpPot = Math.max(prevFirst, first);
  s.settings.secondRunnerUpPot = Math.max(prevSecond, second);

  if (first > prevFirst || second > prevSecond) {
    console.log(`[reconcile] Runner up pots updated from paid records: 1st ${prevFirst}→${s.settings.firstRunnerUpPot}, 2nd ${prevSecond}→${s.settings.secondRunnerUpPot}`);
    writeAtomicCollection('settings', s.settings);
  }

  return { first: s.settings.firstRunnerUpPot, second: s.settings.secondRunnerUpPot };
}

function loadAtomicCollection(name) {
  try {
    const p = path.join(DATA_DIR, `current-${name}.json`);
    if (fsSync.existsSync(p)) {
      return JSON.parse(fsSync.readFileSync(p, 'utf8'));
    }
  } catch (e) {}
  return null;
}

function initSQLite(retries = 2) {
  if (db) return db;
  const dbPath = path.join(DATA_DIR, "dleague.db");
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // On retry, try to clean potentially stale WAL/SHM from unclean previous shutdown (common on Render sleep/wake)
        try { if (fsSync.existsSync(walPath)) fsSync.unlinkSync(walPath); } catch {}
        try { if (fsSync.existsSync(shmPath)) fsSync.unlinkSync(shmPath); } catch {}
        console.log(`[store] Retrying SQLite init (attempt ${attempt}) after cleaning WAL/SHM`);
      }
      db = new Database(dbPath);
      db.pragma("journal_mode = WAL");
      db.pragma("synchronous = NORMAL");
      db.pragma("wal_autocheckpoint = 1000");
      try { db.pragma("wal_checkpoint(FULL)"); } catch (cpErr) { /* ignore checkpoint errors */ }
      db.exec(`
        CREATE TABLE IF NOT EXISTS store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      console.log(`[store] SQLite initialized at ${dbPath}`);
      return db;
    } catch (e) {
      console.warn(`[store] SQLite init attempt ${attempt} failed: ${e.message}`);
      db = null;
      if (attempt === retries) {
        throw e;
      }
    }
  }
}

async function loadStore() {
  if (storeCache) {
    // Even on cached/short-circuit return (common after restore sets storeCache directly),
    // always sanitize the admin record. This ensures that no matter what mangled data came from a user JSON restore,
    // the admin email entry always has canonical displayName "Bolade Oladejo", empty teams, correct code.
    try {
      const admins = (storeCache.managers || []).filter(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      admins.forEach(a => {
        a.displayName = "Bolade Oladejo";
        a.accessCode = ADMIN_ACCESS_CODE;
        a.fpl = { teamId: "", teamName: "" };
        a.ucl = { teamId: "", teamName: "" };
        a.fplClubName = "";
        a.payoutDetails = a.payoutDetails || "";
        a.isAdmin = true;
      });
      if (admins.length > 1) {
        const keep = admins[0];
        storeCache.managers = (storeCache.managers || []).filter(m => m === keep || !(m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()));
      }
    } catch (e) {}
    return storeCache;
  }

  const defaults = createEmptyStore();
  const dbPath = path.join(DATA_DIR, "dleague.db");

  const tryLoadFromDisk = () => {
    if (!db) initSQLite();
    const rows = db.prepare("SELECT key, value FROM store").all();
    const loaded = {};
    for (const row of rows) {
      loaded[row.key] = JSON.parse(row.value);
    }
    return loaded;
  };

  const tryLoadCurrentState = () => {
    try {
      const p = path.join(DATA_DIR, 'current-state.json');
      if (fsSync.existsSync(p)) {
        const data = JSON.parse(fsSync.readFileSync(p, 'utf8'));
        if (data && Array.isArray(data.managers)) {
          console.log(`[store] Loaded current-state.json sidecar with ${data.managers.length} managers`);
          return data;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  // Use module-level (hoisted) for consistency; wrapper keeps old name in scope
  const findBestBackup = () => findBestBackupData();

  try {
    // Load per-collection atomic files first (these are written on every mutation and are the most up-to-date for user data).
    const atomicManagers = loadAtomicCollection('managers');
    const atomicPayments = loadAtomicCollection('payments');
    const atomicLedger = loadAtomicCollection('ledger');
    const atomicBeefs = loadAtomicCollection('beefs');
    const atomicSponsorships = loadAtomicCollection('sponsorships');
    const atomicChallenges = loadAtomicCollection('challenges');
    const atomicComplaints = loadAtomicCollection('complaints');
    const atomicSettings = loadAtomicCollection('settings');

    // Full sources for fallback
    const sidecarData = tryLoadCurrentState();
    let dbData = null;
    try {
      dbData = tryLoadFromDisk();
    } catch (e) {
      console.warn(`[store] DB load failed during collection: ${e.message}`);
    }
    const bestBackupData = findBestBackup();

    const sources = [
      { name: 'sidecar', data: sidecarData },
      { name: 'db', data: dbData },
      { name: 'bestBackup', data: bestBackupData }
    ].filter(s => s.data && Array.isArray(s.data.managers));

    // Pick the best source: highest manager count, tie-break by lastPersistedAt and ledger size
    let bestSource = null;
    let bestScore = -1;

    sources.forEach(src => {
      const mgrs = src.data.managers || [];
      const ledgerLen = (src.data.ledger || []).length;
      const payLen = (src.data.payments || []).length;
      const beefLen = (src.data.beefs || []).length;
      const persistedAt = (src.data.settings && src.data.settings.lastPersistedAt) || '';
      const score = mgrs.length * 10000 + ledgerLen * 10 + payLen * 5 + beefLen * 100 + (persistedAt ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestSource = { ...src, mgrCount: mgrs.length, ledgerLen };
      }
    });

    let loaded;
    if (bestSource) {
      loaded = bestSource.data;
      console.log(`[store] Selected best source: ${bestSource.name} (${bestSource.mgrCount} managers, ${bestSource.ledgerLen} ledger entries)`);
    } else {
      // fallback to whatever we can
      loaded = dbData || sidecarData || bestBackupData || {};
    }

    // Override/merge with per-collection atomics — these are freshest because they are written on every beef/payment/sponsor etc.
    if (atomicManagers && Array.isArray(atomicManagers)) loaded.managers = atomicManagers;
    if (atomicPayments && Array.isArray(atomicPayments)) loaded.payments = atomicPayments;
    if (atomicLedger && Array.isArray(atomicLedger)) loaded.ledger = atomicLedger;
    if (atomicBeefs && Array.isArray(atomicBeefs) && atomicBeefs.length > 0) loaded.beefs = atomicBeefs;
    if (atomicSponsorships && Array.isArray(atomicSponsorships)) loaded.sponsorships = atomicSponsorships;
    if (atomicChallenges && Array.isArray(atomicChallenges)) loaded.challenges = atomicChallenges;
    if (atomicComplaints && Array.isArray(atomicComplaints)) loaded.complaints = atomicComplaints;
    if (atomicSettings && typeof atomicSettings === 'object') loaded.settings = { ...(loaded.settings || {}), ...atomicSettings };

    storeCache = loaded || {};

    let needsPersist = false;

    // Ensure critical non-data keys (settings) without forcing empty data arrays over potentially missing keys
    if (!storeCache.settings) {
      storeCache.settings = { ...defaults.settings };
      needsPersist = true;
    }
    storeCache.settings.firstRunnerUpPot = storeCache.settings.firstRunnerUpPot || 0;
    storeCache.settings.secondRunnerUpPot = storeCache.settings.secondRunnerUpPot || 0;
    // Initialize collection keys to arrays only if completely absent (first run); do not overwrite or persist empty if key missing after partial load
    ['managers','payments','scores','ledger','h2h','challenges','sponsorships','events','complaints','beefs','potBoosts'].forEach(k => {
      if (!Array.isArray(storeCache[k])) storeCache[k] = [];
    });
    if (!storeCache.cup) storeCache.cup = { ...defaults.cup };

    function mergeSources(primary, ...others) {
      const result = { ...primary };
      // Start from primary (usually the freshest SQLite or sidecar)
      ['managers', 'payments', 'ledger', 'scores', 'events', 'sponsorships', 'challenges', 'h2h', 'complaints', 'beefs', 'potBoosts'].forEach(key => {
        if (!Array.isArray(result[key])) result[key] = [];
      });
      if (!result.settings) result.settings = { ...defaults.settings };

      const allSources = [primary, ...others].filter(Boolean);

      // Managers: union by id (recover any that existed in any source)
      const mgrById = new Map(result.managers.map(m => [m.id, m]));
      allSources.forEach(src => {
        (src.managers || []).forEach(m => {
          if (m && m.id && !mgrById.has(m.id)) {
            mgrById.set(m.id, m);
            console.log(`[store] Merged missing manager from other source: ${m.email || m.displayName}`);
          }
        });
      });
      result.managers = Array.from(mgrById.values());

      // Ledger, payments, scores, complaints etc: union by id (preserve *all* historical + recent winnings/settlements)
      ['ledger', 'payments', 'scores', 'events', 'sponsorships', 'challenges', 'complaints', 'beefs', 'potBoosts'].forEach(key => {
        const byId = new Map((result[key] || []).map(item => [item.id || JSON.stringify(item), item]));
        allSources.forEach(src => {
          (src[key] || []).forEach(item => {
            const iid = item.id || JSON.stringify(item);
            if (!byId.has(iid)) {
              byId.set(iid, item);
            }
          });
        });
        result[key] = Array.from(byId.values());
      });

      // For revenue/pot numbers, take the maximum seen (never lose money tracking)
      const moneyKeys = ['totalFplRevenue', 'totalUclRevenue', 'houseFplAdmin', 'houseUclAdmin',
                         'fplOverallPot', 'fplCupPot', 'uclOverallPot', 'h2hOverallPot', 'seasonReserveBoost',
                         'firstRunnerUpPot', 'secondRunnerUpPot'];
      moneyKeys.forEach(k => {
        let maxVal = (result.settings[k] || 0);
        allSources.forEach(src => {
          const v = (src.settings && src.settings[k]) || 0;
          if (v > maxVal) maxVal = v;
        });
        result.settings[k] = maxVal;
      });

      // Prefer the most recent lastPersistedAt
      let newestAt = result.settings.lastPersistedAt || '';
      allSources.forEach(src => {
        const at = (src.settings && src.settings.lastPersistedAt) || '';
        if (at > newestAt) newestAt = at;
      });
      if (newestAt) result.settings.lastPersistedAt = newestAt;

      return result;
    }

    // Apply merge on top of the best source (union managers + all ledger entries etc.)
    const beforeCount = (storeCache.managers || []).length;
    const sidecar = sidecarData;
    const bestBackup = bestBackupData;
    storeCache = mergeSources(storeCache, sidecar, bestBackup);
    const afterCount = (storeCache.managers || []).length;

    // Reconstruct any beefs that have payment records but lost their beef doc. Critical for "beefs never disappear".
    try { reconstructBeefsFromPayments(storeCache); } catch (e) { console.warn('[beef] reconstruct failed', e.message); }
    try { reconcileRunnerUpPots(storeCache); } catch (e) { console.warn('[runnerup] reconcile failed', e.message); }

    if (afterCount > beforeCount) {
      console.log(`[store] Reconciled extra managers: ${beforeCount} -> ${afterCount}. All ledger entries preserved.`);
    }

    // ALWAYS persist after loading so the richest possible state becomes the new sidecar + DB.
    // This is what makes the system "self-healing" on every restart.
    needsPersist = true;

    // Only fall back to full best-backup replace as absolute last resort (if primary sources had 0 managers)
    if (beforeCount === 0 && afterCount === 0 && bestBackup && (bestBackup.managers || []).length > 0) {
      storeCache = bestBackup;
      console.log(`[store] Last-resort full restore from best backup (no data in DB or sidecar).`);
      needsPersist = true;
    }

    console.log(`[store] Loaded from SQLite: ${storeCache.managers ? storeCache.managers.length : 0} managers`);

    // Normalize ONLY for old season data...
    if (storeCache.settings && (storeCache.settings.seasonName.includes("2025/26") || storeCache.settings.seasonName.includes("25/26"))) {
      storeCache.settings.seasonName = "2026/27 D League";
      storeCache.settings.currentRound = { fpl: 1, ucl: 1 };
      storeCache.settings.leagueLocked = { fpl: false, ucl: false };
      storeCache.settings.history = { weekly: [], awards: [], beefs: [], standings: [] };
      storeCache.settings.firstRunnerUpPot = 0;
      storeCache.settings.secondRunnerUpPot = 0;
      storeCache.scores = [];
      needsPersist = true;
      console.log("[store] Normalized to 2026/27 season start (round=1, unlocked). Existing managers/payments/ledger fully protected.");
    }

    if (needsPersist) await persistStore();

    // Migrate old boolean...
    if (typeof storeCache.settings.leagueLocked === 'boolean') {
      const wasLocked = storeCache.settings.leagueLocked;
      storeCache.settings.leagueLocked = { fpl: wasLocked, ucl: wasLocked };
      needsPersist = true;
    }

    // One-time migration from old store.json - make much stricter to avoid overwriting good data
    const oldStorePath = STORE_FILE;
    const hasManagers = Array.isArray(storeCache.managers) && storeCache.managers.length > 0;
    if (!hasManagers && fsSync.existsSync(oldStorePath)) {
      try {
        const raw = fsSync.readFileSync(oldStorePath, "utf8");
        const oldData = JSON.parse(raw);
        if (oldData && Array.isArray(oldData.managers) && oldData.managers.length > 0) {
          storeCache = { ...defaults, ...oldData };
          await persistStore();
          console.log("[store] Migrated managers from old store.json to SQLite");
        }
        try { fsSync.renameSync(oldStorePath, oldStorePath + ".migrated"); } catch {}
      } catch (migErr) {
        console.warn("[store] Old store.json migration skipped/failed:", migErr.message);
      }
    }

    // Heal any paid managers lost during migration or prior bad updates
    await recoverOrphanedPaidManagers();

    // Auto-recover richer state if current looks low (free tier safety)
    const atomicMgrs = loadAtomicCollection('managers');
    if (atomicMgrs && atomicMgrs.length > (storeCache.managers || []).length) {
      console.log(`[store] Auto-recovery: atomics have ${atomicMgrs.length} managers vs ${ (storeCache.managers || []).length } - promoting`);
      storeCache.managers = atomicMgrs;
      const p = loadAtomicCollection('payments');
      if (p) storeCache.payments = p;
      const l = loadAtomicCollection('ledger');
      if (l) storeCache.ledger = l;
      const b = loadAtomicCollection('beefs');
      if (b) storeCache.beefs = b;
      const pb = loadAtomicCollection('potBoosts');
      if (pb) storeCache.potBoosts = pb;
    }

    // Reconstruct beefs from payments after recovery too
    try { reconstructBeefsFromPayments(storeCache); } catch (e) { console.warn('[beef] reconstruct after recovery failed', e.message); }
    try { reconcileRunnerUpPots(storeCache); } catch (e) { console.warn('[runnerup] reconcile failed', e.message); }

    // After any load, immediately promote the current state to per-collection atomics.
    // This ensures that even if we loaded from an older full sidecar, the latest merged view is durable.
    writeAtomicCollection('managers', storeCache.managers);
    writeAtomicCollection('payments', storeCache.payments);
    writeAtomicCollection('ledger', storeCache.ledger);
    writeAtomicCollection('beefs', storeCache.beefs || []);
    writeAtomicCollection('sponsorships', storeCache.sponsorships || []);
    writeAtomicCollection('challenges', storeCache.challenges || []);
    writeAtomicCollection('potBoosts', storeCache.potBoosts || []);
    writeAtomicCollection('complaints', storeCache.complaints || []);
    if (storeCache.settings) writeAtomicCollection('settings', storeCache.settings);
    // force promote beefs atomic to ensure never lost
    writeAtomicCollection('beefs', storeCache.beefs || []);

    // Ensure runner up pots are consistent with payments (solid for restores)
    try { reconcileRunnerUpPots(storeCache); } catch (e) {}

    // Always heal the admin record by email after any load/merge. Prevents "admin shows as Obed" or team attached after restores or bad merges.
    try {
      const admins = (storeCache.managers || []).filter(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      admins.forEach(a => {
        a.displayName = "Bolade Oladejo";
        a.accessCode = ADMIN_ACCESS_CODE;
        a.fpl = { teamId: "", teamName: "" };
        a.ucl = { teamId: "", teamName: "" };
        a.fplClubName = "";
        a.payoutDetails = a.payoutDetails || "";
        a.isAdmin = true;
      });
      if (admins.length === 0) {
        // create if completely missing
        storeCache.managers = storeCache.managers || [];
        storeCache.managers.push({
          id: generateId("mgr"),
          displayName: "Bolade Oladejo",
          email: ADMIN_EMAIL,
          accessCode: ADMIN_ACCESS_CODE,
          fpl: { teamId: "", teamName: "" },
          ucl: { teamId: "", teamName: "" },
          payoutDetails: "",
          fplClubName: "",
          createdAt: nowISO(),
          isAdmin: true
        });
      }
      if (admins.length > 1) {
        // keep only one, prefer the one that was already there or first
        console.warn("[load] Multiple admin email records found after merge — deduping");
        // keep the first, remove others (rare)
        const keep = admins[0];
        storeCache.managers = (storeCache.managers || []).filter(m => m === keep || !(m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()));
        storeCache.managers.push(keep); // ensure
      }
    } catch (e) { console.warn("admin heal in loadStore failed", e.message); }

    // Force the healed admin record to disk atomics immediately (so even bad exports/restores don't stick mangled data forever)
    try {
      writeAtomicCollection('managers', storeCache.managers || []);
      // schedule a full persist without blocking return
      setTimeout(() => { persistStore().catch(() => {}); }, 5);
    } catch (e) {}

    return storeCache;
  } catch (e) {
    console.warn(`[store] SQLite load failed after recovery attempts: ${e.message}. Trying sidecar + best-backup...`);
    const sidecar = tryLoadCurrentState();
    const best = findBestBackup();
    if (sidecar && (sidecar.managers || []).length > 0) {
      storeCache = sidecar;
      console.log(`[store] Rescued from current-state.json sidecar in catch: ${(sidecar.managers || []).length} managers.`);
      setTimeout(() => { persistStore().catch(()=>{}); }, 50);
      return storeCache;
    }
    if (best && (best.managers || []).length > 0) {
      storeCache = best;
      console.log(`[store] Rescued from best backup in final catch: ${(best.managers || []).length} managers. Will persist.`);
      setTimeout(() => { persistStore().catch(()=>{}); }, 50);
      return storeCache;
    }
    // Last resort: empty in-memory only (disk + backups are untouched)
    storeCache = createEmptyStore();
    return storeCache;
  }
}

async function persistStore() {
  if (storeWriteLock) return;
  storeWriteLock = true;
  try {
    if (!db) initSQLite();

    // Safety guard: never clobber good data with empty managers on a persist
    // Strong guard: if current has fewer managers than best on disk, restore the best
    const currentMgrCount = (storeCache.managers || []).length;
    const bestMgrs = loadAtomicCollection('managers') || [];
    if (bestMgrs.length > currentMgrCount) {
      console.warn(`[persist] Guard: current has ${currentMgrCount} managers, best atomic has ${bestMgrs.length} — restoring best`);
      storeCache.managers = bestMgrs;
      const bestPays = loadAtomicCollection('payments');
      if (bestPays) storeCache.payments = bestPays;
      const bestLed = loadAtomicCollection('ledger');
      if (bestLed) storeCache.ledger = bestLed;
      const bestBeefs = loadAtomicCollection('beefs');
      if (bestBeefs) storeCache.beefs = bestBeefs;
      const bestSpon = loadAtomicCollection('sponsorships');
      if (bestSpon) storeCache.sponsorships = bestSpon;
      const bestChallenges = loadAtomicCollection('challenges');
      if (bestChallenges) storeCache.challenges = bestChallenges;
      const bestPotBoosts = loadAtomicCollection('potBoosts');
      if (bestPotBoosts) storeCache.potBoosts = bestPotBoosts;
      const bestSet = loadAtomicCollection('settings');
      if (bestSet) storeCache.settings = { ...(storeCache.settings || {}), ...bestSet };
    }

    const insert = db.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)");
    const tx = db.transaction((store) => {
      for (const [key, value] of Object.entries(store)) {
        insert.run(key, JSON.stringify(value));
      }
    });

    // Write durable sidecar FIRST (atomic) before touching DB.
    writeAtomicSidecar(storeCache);
    // Also write per-collection atomics on every persist (belt and suspenders)
    writeAtomicCollection('managers', storeCache.managers);
    writeAtomicCollection('payments', storeCache.payments);
    writeAtomicCollection('ledger', storeCache.ledger);
    writeAtomicCollection('beefs', storeCache.beefs || []);
    writeAtomicCollection('sponsorships', storeCache.sponsorships || []);
    writeAtomicCollection('challenges', storeCache.challenges || []);
    writeAtomicCollection('potBoosts', storeCache.potBoosts || []);
    writeAtomicCollection('settings', storeCache.settings || {});

    tx(storeCache);
    console.log(`[store] Persisted to SQLite: ${storeCache.managers ? storeCache.managers.length : 0} managers`);
    // Force a full checkpoint after every successful write — helps a lot with Render wake reliability
    try { if (db) db.pragma("wal_checkpoint(FULL)"); } catch {}

    // CRITICAL: Always set lastPersistedAt so we can prefer freshest data across sources
    if (!storeCache.settings) storeCache.settings = {};
    storeCache.settings.lastPersistedAt = nowISO();

    // Extra safety: timestamped + stable latest + "best" (highest managers ever). Prune carefully to never lose high-count history.
    try {
      const backupsDir = path.join(DATA_DIR, "backups");
      if (!fsSync.existsSync(backupsDir)) fsSync.mkdirSync(backupsDir, { recursive: true });
      const currentCount = (storeCache.managers || []).length;

      // 1. Timestamped for history
      const tsPath = path.join(backupsDir, `store-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
      fsSync.writeFileSync(tsPath, JSON.stringify(storeCache, null, 2));

      // 2. Always overwrite store-latest.json (quick stable fallback)
      fsSync.writeFileSync(path.join(backupsDir, 'store-latest.json'), JSON.stringify(storeCache, null, 2));

      // 3. Only promote to store-best.json when we see a new high (or equal on first)
      const bestPath = path.join(backupsDir, 'store-best.json');
      let bestCount = 0;
      try {
        const prev = JSON.parse(fsSync.readFileSync(bestPath, 'utf8'));
        bestCount = (prev.managers || []).length;
      } catch {}
      if (currentCount >= bestCount && currentCount > 0) {
        fsSync.writeFileSync(bestPath, JSON.stringify(storeCache, null, 2));
        if (currentCount > bestCount) console.log(`[backup] New best snapshot: ${currentCount} managers -> store-best.json`);
      }

      // 4. (Sidecar already written at start of persist for max durability before DB tx)
      // 5. Smart prune: keep last ~12 + any that match or exceed current bestCount (protect history of good states)
      const all = fsSync.readdirSync(backupsDir)
        .filter(f => f.startsWith('store-') && f.endsWith('.json'))
        .map(f => {
          let c = 0;
          try {
            const d = JSON.parse(fsSync.readFileSync(path.join(backupsDir, f), 'utf8'));
            c = (d.managers || []).length;
          } catch {}
          return { f, c };
        });
      const keepCount = Math.max(bestCount, currentCount);
      // Keep newest first, plus all that have >= keepCount
      const sortedNewest = [...all].sort((a,b) => b.f.localeCompare(a.f)); // rough newest by name ts
      const toDelete = [];
      let kept = 0;
      for (const item of sortedNewest) {
        const isStable = item.f.includes('best') || item.f.includes('latest');
        const isHigh = item.c >= keepCount && item.c > 0;
        if (isStable || isHigh || kept < 12) {
          kept++;
        } else {
          toDelete.push(item.f);
        }
      }
      toDelete.forEach(f => { try { fsSync.unlinkSync(path.join(backupsDir, f)); } catch {} });
    } catch (bErr) { console.warn("[backup] failed", bErr.message); }
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
      console.log(`[store] getStore loaded: ${storeCache.managers ? storeCache.managers.length : 0} managers`);
      // If getStore direct read sees low, do not auto override here (loadStore owns the best-backup logic). Rely on callers using loadStore.
    } catch (e) {
      console.warn(`[store] getStore load failed: ${e.message}. Returning fresh empty without caching (rely on loadStore).`);
      // Return a throw-away empty so we don't cache a wipe state. Real data should come from loadStore().
      return createEmptyStore();
    }
  }

  // Heal admin on any getStore access too (defensive for direct calls after restores)
  try {
    const admins = (storeCache.managers || []).filter(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    admins.forEach(a => {
      a.displayName = "Bolade Oladejo";
      a.accessCode = ADMIN_ACCESS_CODE;
      a.fpl = { teamId: "", teamName: "" };
      a.ucl = { teamId: "", teamName: "" };
      a.fplClubName = "";
      a.payoutDetails = a.payoutDetails || "";
      a.isAdmin = true;
    });
  } catch (e) {}

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

function getAuthenticatedManager(req) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.managerId) return null;
  return getManagerById(decoded.managerId);
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
  console.log("📨 NEW SELF-SERVE JOIN");
  console.log("Manager auto-created with code (self-serve flow):");
  console.log("  Name:   ", join.name);
  console.log("  Email:  ", join.email);
  console.log("  FPL Club:", join.fplClubName);
  console.log("  FPL ID: ", join.fplId || 'not provided');
  console.log("  CODE:   ", join.accessCode || 'N/A');
  console.log("  Time:   ", new Date().toISOString());
  console.log("Check admin cockpit for the new manager (no manual code gen needed unless fixing).");
  console.log("========================================\n");

  const subject = "D League Clubhouse - New Self-Serve Access";
  const text = `Hi ${join.name},\n\nYou (or the system) generated your access code for FPL club "${join.fplClubName}".\n\nYour code: ${join.accessCode || 'see dashboard'}\n\nLogin at the Clubhouse with your email + this code.\n\nThank you,\nD League Clubhouse`;

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
  const mgr = getManagerById(managerId);
  const existing = s.payments.find(p => p.reference === reference);
  if (existing) {
    if (existing.status !== "confirmed") {
      existing.status = "confirmed";
      existing.confirmedAt = nowISO();
      existing.paystackData = paystackData;
    }
    if (existing.type === 'beef_stake' && existing.beefId) {
      let beef = (s.beefs || []).find(b => b.id === existing.beefId);
      const payerId = existing.managerId;
      const paidAmt = existing.amount || (beef && beef.stake) || 0;
      if (!beef && existing.beefId) {
        // Create stub so paid beef never disappears and cut is always accounted
        beef = {
          id: existing.beefId,
          proposerId: payerId,
          opponentIds: [],
          participants: [payerId],
          category: 'Beef (recovered on payment)',
          stake: paidAmt,
          status: 'accepted',
          paidBy: {},
          totalStaked: 0,
          prizePot: 0,
          at: nowISO(),
          reconstructedOnPay: true
        };
        s.beefs = s.beefs || [];
        s.beefs.push(beef);
      }
      if (beef) {
        beef.stakePaid = true;
        beef.stakePaymentRef = reference;
        beef.paidBy = beef.paidBy || {};
        if (!beef.paidBy[payerId]) {
          beef.paidBy[payerId] = { amount: paidAmt, ref: reference, paidAt: nowISO() };
          beef.totalStaked = (beef.totalStaked || 0) + paidAmt;
          const cut = Math.floor(paidAmt * 0.1);
          const first = Math.floor(cut * 0.6);
          const second = cut - first;
          s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + first;
          s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + second;
          s.ledger.push({
            id: generateId("ldg"),
            type: "runner_up_fund",
            managerId: "system",
            amount: -cut,
            note: `House cut 60/40 to 1st/2nd runner up from beef stake payment for "${beef.category}"`,
            at: nowISO()
          });
          beef.prizePot = (beef.prizePot || 0) + (paidAmt - cut);
        }
      }
    }
    writeAtomicCollection('beefs', s.beefs || []);
    writeAtomicCollection('settings', s.settings || {});
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

  if (payment.type === 'beef_stake' && payment.beefId) {
    let beef = (s.beefs || []).find(b => b.id === payment.beefId);
    const payerId = payment.managerId;
    const paidAmt = payment.amount || (beef && beef.stake) || 0;
    if (!beef && payment.beefId) {
      beef = {
        id: payment.beefId,
        proposerId: payerId,
        opponentIds: [],
        participants: [payerId],
        category: 'Beef (recovered on payment)',
        stake: paidAmt,
        status: 'accepted',
        paidBy: {},
        totalStaked: 0,
        prizePot: 0,
        at: nowISO(),
        reconstructedOnPay: true
      };
      s.beefs = s.beefs || [];
      s.beefs.push(beef);
    }
    if (beef) {
      beef.stakePaid = true;
      beef.stakePaymentRef = reference || payment.reference;
      beef.paidBy = beef.paidBy || {};
      beef.paidBy[payerId] = {
        amount: paidAmt,
        ref: reference || payment.reference,
        paidAt: nowISO()
      };
      beef.totalStaked = (beef.totalStaked || 0) + paidAmt;
      const cut = Math.floor(paidAmt * 0.1);
      const first = Math.floor(cut * 0.6);
      const second = cut - first;
      s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + first;
      s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + second;
      s.ledger.push({
        id: generateId("ldg"),
        type: "runner_up_fund",
        managerId: "system",
        amount: -cut,
        note: `House cut 60/40 to 1st/2nd runner up from beef stake payment for "${beef.category}"`,
        at: nowISO()
      });
      beef.prizePot = (beef.prizePot || 0) + (paidAmt - cut);
    }
  }

  if (payment.type === 'sponsor' && payment.sponsorTarget) {
    s.sponsorships = s.sponsorships || [];
    s.sponsorships.push({
      id: generateId("sp"),
      sponsor: mgr.displayName,
      amount: payment.amount,
      target: payment.sponsorTarget,
      status: 'active'
    });
    // Immediate house cut 60/40 to runner ups on sponsor payment
    const sponsorAmt = Number(payment.amount) || 0;
    const sponsorCut = Math.floor(sponsorAmt * 0.1);
    if (sponsorCut > 0) {
      const sf = Math.floor(sponsorCut * 0.6);
      const ss = sponsorCut - sf;
      s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + sf;
      s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + ss;
      s.ledger.push({
        id: generateId("ldg"),
        type: "runner_up_fund",
        managerId: "system",
        amount: -sponsorCut,
        note: `10% house cut 60/40 from sponsor "${payment.sponsorTarget}" on payment`,
        at: nowISO()
      });
    }
    // Notify after confirmed payment
    const text = `Thank you! Your sponsorship of ₦${payment.amount} for "${payment.sponsorTarget}" via Paystack is confirmed and active.`;
    await sendEmail(mgr.email, 'Sponsorship Confirmed - D League', text);
  }

  if (payment.type === 'pot_boost' && payment.potTarget) {
    const target = payment.potTarget;
    const amt = Number(payment.amount) || 0;
    if (amt > 0 && mgr) {
      // 100% of voluntary boost goes to the chosen pot (no house cut on manager boosts)
      if (target === 'h2h') {
        s.settings.h2hOverallPot = (s.settings.h2hOverallPot || 0) + amt;
      } else if (target === 'overall') {
        s.settings.fplOverallPot = (s.settings.fplOverallPot || 0) + amt;
      } else if (target === 'cup') {
        s.settings.fplCupPot = (s.settings.fplCupPot || 0) + amt;
      } else if (target === 'first-ru' || target === 'reserve') {
        s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + amt;
      } else if (target === 'second-ru') {
        s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + amt;
      } else if (target === 'weekly') {
        // Track for current round; will be added to this week's payout + projections
        const cur = (s.settings.currentRound && s.settings.currentRound.fpl) || 1;
        s.settings.weeklyBoosts = s.settings.weeklyBoosts || {};
        s.settings.weeklyBoosts[cur] = (s.settings.weeklyBoosts[cur] || 0) + amt;
      }

      s.potBoosts = s.potBoosts || [];
      s.potBoosts.push({
        id: generateId("bost"),
        managerId: mgr.id,
        target,
        amount: amt,
        round: (s.settings.currentRound && s.settings.currentRound.fpl) || null,
        at: nowISO()
      });

      s.ledger.push({
        id: generateId("ldg"),
        type: "pot_boost",
        managerId: mgr.id,
        amount: 0,  // history only; does not credit personal wallet (boost is contribution to collective pot)
        boostAmount: amt,
        note: `${mgr.displayName}${mgr.fplClubName ? ' of ' + mgr.fplClubName : ''} added ₦${amt} to ${target} pot`,
        at: nowISO()
      });

      writeAtomicCollection('potBoosts', s.potBoosts);
      writeAtomicCollection('ledger', s.ledger);
    }
  }

  if (payment.type !== 'sponsor' && payment.type !== 'pot_boost' && payment.type !== 'beef_stake') {
    // Track revenue
    const compDef = COMPETITIONS[competition];
    const houseFee = compDef ? (compDef.adminFee || 0) : 0;
    if (competition === 'fpl' || competition === 'ucl') {
      const revKey = `total${competition.charAt(0).toUpperCase() + competition.slice(1)}Revenue`;
      const houseKey = `house${competition.charAt(0).toUpperCase() + competition.slice(1)}Admin`;
      s.settings[revKey] = (s.settings[revKey] || 0) + Math.max(0, Number(amount) - houseFee);
      s.settings[houseKey] = (s.settings[houseKey] || 0) + Math.min(Number(amount), houseFee);
    }

    if (competition === 'fpl') {
      s.settings.h2hOverallPot = (s.settings.h2hOverallPot || 0) + 1500;
      s.settings.fplOverallPot = (s.settings.fplOverallPot || 0) + 525;
      s.settings.fplCupPot = (s.settings.fplCupPot || 0) + 175;
    }
  }

  await logEvent("payment_confirmed", { managerId, competition, reference, amount });
  updateSeasonPots(s);
  writeAtomicSidecar(s);
  writeAtomicCollection('payments', s.payments);
  writeAtomicCollection('ledger', s.ledger);
  writeAtomicCollection('managers', s.managers);
  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicCollection('settings', s.settings || {});
  await persistStore();

  // Email notification for main league payments (not internal beef/sponsor/pot which have their own)
  if (mailer && mgr && mgr.email && !payment.type) {
    try {
      await sendEmail(mgr.email, `D League ${ (competition || 'FPL').toUpperCase() } Payment Confirmed`, 
        `Hi ${mgr.displayName},\n\nYour payment of ₦${amount} for ${(competition || 'season').toUpperCase()} has been confirmed (ref: ${reference}).\nYou are now fully eligible.\n\nView pots, propose beefs, etc at the Clubhouse.\n\nGood luck this season!`);
    } catch(e){ console.warn('payment email failed', e.message); }
  }

  return payment;
}

function updateSeasonPots(s) {
  const fplRev = s.settings.totalFplRevenue || 0;
  const uclRev = s.settings.totalUclRevenue || 0;
  // fplOverallPot / fplCupPot are populated EXCLUSIVELY via settleWeeklyPot's 10% weekly reserve (75%/25%).
  // UCL kept for now as-is (can be aligned later).
  s.settings.uclOverallPot = Math.floor(0.2 * uclRev);
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

  // Credit winner(s) - split pot equally if tie
  const maxPoints = Math.max(...scores.map(sc => sc.points));
  const tiedWinners = scores.filter(sc => sc.points === maxPoints);
  // Include any voluntary boosts made to this week's pot
  const curWeeklyBoost = (s.settings.weeklyBoosts && s.settings.weeklyBoosts[round]) || 0;
  const totalForWinners = pot.winnerShare + curWeeklyBoost;
  const sharePerWinner = Math.floor(totalForWinners / tiedWinners.length);
  tiedWinners.forEach(w => {
    s.ledger.push({
      id: generateId("ldg"),
      type: "weekly_win",
      managerId: w.managerId,
      competition: comp,
      round,
      amount: sharePerWinner,
      note: `${comp.toUpperCase()} GW/MD ${round} winner (90%${curWeeklyBoost ? ' + boosts' : ''} split for tie)`,
      at: nowISO()
    });
  });

  if (comp === 'fpl') {
    const weeklyReserve = pot.reserve;
    const toOverall = Math.floor(weeklyReserve * 0.75);
    const toCup = weeklyReserve - toOverall;
    s.settings.fplOverallPot = (s.settings.fplOverallPot || 0) + toOverall;
    s.settings.fplCupPot = (s.settings.fplCupPot || 0) + toCup;

    // Log transparently but these go to season pots
    s.ledger.push({
      id: generateId("ldg"),
      type: "season_pot_contribution",
      managerId: "system",
      competition: comp,
      round,
      amount: -weeklyReserve,
      note: `Weekly reserve split 75% overall / 25% cup from ${comp} ${round}`,
      at: nowISO()
    });
  } else {
    // For UCL: currently 10% treated as admin reserve (align to weekly 500 model later if needed)
    s.ledger.push({
      id: generateId("ldg"),
      type: "house_commission",
      managerId: "house",
      competition: comp,
      round,
      amount: -pot.reserve,
      note: `Reserve (10% of weekly pot) from ${comp} ${round}`,
      at: nowISO()
    });
  }

  writeAtomicSidecar(s);
  await persistStore();
  await logEvent("pot_settled", { comp, round, winners: tiedWinners.map(w => w.managerId), amount: pot.winnerShare });

  // Store history
  s.settings.history = s.settings.history || {weekly: [], awards: [], beefs: [], standings: []};
  s.settings.history.weekly.push({
    round,
    comp,
    winners: tiedWinners.map(w => ({id: w.managerId, points: w.points})),
    pot: pot.winnerShare,
    split: tiedWinners.length > 1,
    at: nowISO()
  });

  return pot.winnerShare;
}

function computeWinnerFromLogic(logic, s) {
  // Server side simple version of compute
  const scores = s.scores || [];
  // Simplified: top by recent or total
  const mgrScores = s.managers.map(m => {
    const recent = scores.find(sc => sc.managerId === m.id && sc.competition === 'fpl' && sc.isFinal) || {};
    return { m, points: recent.points || 0 };
  });
  mgrScores.sort((a,b) => b.points - a.points);
  return mgrScores[0] ? mgrScores[0].m : s.managers[0];
}

// Server-side preset logic for auto-resolving beefs and awards using detailed FPL picks data (per round, per teamId).
// Beefs use the joinDeadline round's final data. This uses the same picks stored during syncFPL (extra.picks with multiplier, type, points).
const BEEF_LOGIC_MAP = {
  'cap-clutch': 'highestCaptain',
  'bench-bandit': 'highestBench',
  'clean-king': 'defencePoints',
  'mid-maestro': 'midfieldPoints',
  'fwd-fury': 'forwardPoints',
  'chip-wizard': 'chipPerformance',
  'transfer-king': 'transferImpact',
  'underdog': 'biggestSurprise',
  'top-scorer': 'highestTotal'
};

function getManagerRoundData(managerId, round, s) {
  const sc = (s.scores || []).find(sc => sc.managerId === managerId && sc.competition === 'fpl' && sc.round === round && sc.isFinal);
  return {
    total: sc && typeof sc.points === 'number' ? sc.points : 0,
    picks: (sc && sc.extra && sc.extra.picks) || [],
    chip: sc && sc.extra ? sc.extra.activeChip : null
  };
}

function computeBeefWinner(beef, round, s) {
  const logicKey = beef.category || '';
  const logic = BEEF_LOGIC_MAP[logicKey] || logicKey;
  const parts = [beef.proposerId, ...(beef.opponentIds || []), ...(beef.participants || [])].filter(Boolean);
  if (!parts.length) return null;

  let bests = [];
  let bestScore = -Infinity;

  for (const pid of parts) {
    const data = getManagerRoundData(pid, round, s);
    const picks = data.picks;
    let score = 0;

    if (logic === 'highestCaptain') {
      const cap = picks.find(p => p.multiplier > 1);
      score = cap ? (cap.points || 0) : 0;
    } else if (logic === 'highestBench') {
      score = picks.filter(p => (p.multiplier === 0 || p.multiplier == null)).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'defencePoints') {
      score = picks.filter(p => p.type === 2).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'midfieldPoints') {
      score = picks.filter(p => p.type === 3).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'forwardPoints') {
      score = picks.filter(p => p.type === 4).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'chipPerformance') {
      score = data.chip ? (data.total * 1.4) : data.total; // slight boost for chip use
    } else if (logic === 'transferImpact') {
      score = data.total; // could enhance with transfer count if stored
    } else if (logic === 'biggestSurprise') {
      const avg = (s.settings.roundAverages && s.settings.roundAverages.fpl) || 65;
      score = data.total > avg * 1.6 ? data.total : 0;
    } else if (logic === 'highestTotal') {
      score = data.total;
    } else {
      score = data.total;
    }

    if (score > bestScore) {
      bestScore = score;
      bests = [s.managers.find(mm => mm.id === pid)];
    } else if (score === bestScore && score > 0) {
      const mgr = s.managers.find(mm => mm.id === pid);
      if (mgr && !bests.some(b => b.id === mgr.id)) bests.push(mgr);
    }
  }
  // Only return winners if positive score. Handle ties by returning array.
  return (bestScore > 0) ? bests : null;
}

async function autoSettleBeefs(round) {
  const s = await loadStore();
  if (!round || round < 1) {
    console.log(`[AUTO BEEF] Skipping auto-settle for pre-season/invalid round ${round} (season not started)`);
    return;
  }
  const toSettle = (s.beefs || []).filter(b =>
    b.status === 'accepted' &&
    (b.joinDeadline || 0) <= round &&
    b.autoSettle === true &&
    !b.locked &&
    !['settled', 'declined', 'cancelled'].includes(b.status)
  );
  if (!toSettle.length) return;

  console.log(`[AUTO BEEF] Checking ${toSettle.length} beefs for round ${round} auto-resolve using FPL picks data`);
  for (const beef of toSettle) {
    try {
      // Only auto if final data exists for all participants (prevents wrong settlement on incomplete data)
      const parts = [beef.proposerId, ...(beef.opponentIds || []), ...(beef.participants || [])].filter(Boolean);
      const hasFinalData = parts.every(pid => {
        const sc = (s.scores || []).find(sc => sc.managerId === pid && sc.competition === 'fpl' && sc.round === round && sc.isFinal);
        return !!sc;
      });
      if (!hasFinalData) {
        console.log(`[AUTO BEEF] Skipping ${beef.id} - not all final data for round ${round}`);
        continue;
      }
      const winners = computeBeefWinner(beef, round, s);
      if (winners && winners.length > 0) {
        if (winners.length === 1) {
          const ok = await settleBeef(beef.id, winners[0].id);
          if (ok) {
            await logEvent('beef_auto_settled', { beefId: beef.id, winner: winners[0].id, round, category: beef.category });
          }
        } else {
          const ok = await settleBeefTied(beef.id, winners.map(w => w.id));
          if (ok) {
            await logEvent('beef_auto_settled', { beefId: beef.id, winners: winners.map(w => w.id), round, category: beef.category, tie: true });
          }
        }
      }
    } catch (e) {
      console.warn('[AUTO BEEF] resolve failed for', beef.id, e.message);
    }
  }
}

// End-of-season one-off awards: H2H pot (if fplH2h ID set), plus 1st/2nd league runner-up pots (funded 60/40 by immediate house cuts on paid beefs/sponsors).
// Uses exact teamId matching from FPL league standings API so no manual mapping issues.
async function settleEndOfSeasonH2HAndRunners() {
  const s = await loadStore();
  const lids = s.settings.leagueIds || {};
  let awarded = [];

  // H2H - one off at season end
  if (lids.fplH2h) {
    const data = await fetchFplLeagueStandings(lids.fplH2h, true);
    const results = data && data.standings && data.standings.results ? data.standings.results : [];
    if (results.length > 0) {
      const top = results[0];
      const h2hWinner = s.managers.find(m => m.fpl && String(m.fpl.teamId) === String(top.entry));
      const pot = s.settings.h2hOverallPot || 0;
      if (h2hWinner && pot > 0) {
        s.ledger.push({
          id: generateId('ldg'),
          type: 'h2h_season_win',
          managerId: h2hWinner.id,
          amount: pot,
          note: 'End of season H2H winner (one-off from extra 1k contributions + boosts)'
        });
        s.settings.h2hOverallPot = 0;
        awarded.push({ type: 'h2h', manager: h2hWinner.displayName, amount: pot });
      }
    }
  }

  // First and second runner up pots funded directly by 60/40 of house cuts (immediate on paid beefs/sponsors)
  const firstPot = s.settings.firstRunnerUpPot || 0;
  const secondPot = s.settings.secondRunnerUpPot || 0;
  if (lids.fplClassic) {
    const data = await fetchFplLeagueStandings(lids.fplClassic, false);
    const results = data && data.standings && data.standings.results ? data.standings.results : [];
    if (results.length >= 3) {
      const r1 = results[1];
      const r2 = results[2];
      const mgr1 = s.managers.find(m => m.fpl && String(m.fpl.teamId) === String(r1.entry));
      const mgr2 = s.managers.find(m => m.fpl && String(m.fpl.teamId) === String(r2.entry));

      if (mgr1 && firstPot > 0) {
        s.ledger.push({ id: generateId('ldg'), type: 'first_runner_up', managerId: mgr1.id, amount: firstPot, note: '1st League Runner Up from house cuts (60%)' });
        s.settings.firstRunnerUpPot = 0;
        awarded.push({ type: 'runner1', manager: mgr1.displayName, amount: firstPot });
      }
      if (mgr2 && secondPot > 0) {
        s.ledger.push({ id: generateId('ldg'), type: 'second_runner_up', managerId: mgr2.id, amount: secondPot, note: '2nd League Runner Up from house cuts (40%)' });
        s.settings.secondRunnerUpPot = 0;
        awarded.push({ type: 'runner2', manager: mgr2.displayName, amount: secondPot });
      }
    }
  } else {
    // Fallback using internal scores
    const sorted = [...s.managers].map(m => {
      const tot = (s.scores || []).filter(sc => sc.managerId === m.id && sc.competition === 'fpl').reduce((a,sc) => a + (sc.points||0), 0);
      return { m, tot };
    }).sort((a,b) => b.tot - a.tot);
    if (sorted.length >= 3) {
      if (firstPot > 0) {
        s.ledger.push({ id: generateId('ldg'), type: 'first_runner_up', managerId: sorted[1].m.id, amount: firstPot, note: '1st Runner Up (fallback)' });
        s.settings.firstRunnerUpPot = 0;
        awarded.push({ type: 'runner1-fb', manager: sorted[1].m.displayName, amount: firstPot });
      }
      if (secondPot > 0) {
        s.ledger.push({ id: generateId('ldg'), type: 'second_runner_up', managerId: sorted[2].m.id, amount: secondPot, note: '2nd Runner Up (fallback)' });
        s.settings.secondRunnerUpPot = 0;
        awarded.push({ type: 'runner2-fb', manager: sorted[2].m.displayName, amount: secondPot });
      }
    }
  }

  if (awarded.length) {
    await persistStore();
    await logEvent('end_of_season_awards', { awarded });
  }
  return awarded;
}

async function settleSponsoredAwards(round) {
  const s = await loadStore();
  if (!round || round < 1) {
    console.log(`[SponsoredAwards] Skipping pre-season round ${round}`);
    return;
  }
  // Group sponsorships by target, sum pot
  const byTarget = {};
  (s.sponsorships || []).forEach(sp => {
    if (sp.status !== 'active' && sp.status !== 'pending') return;
    const t = sp.target || 'general';
    if (!byTarget[t]) byTarget[t] = { pot: 0, sponsors: [] };
    byTarget[t].pot += sp.amount || 0;
    byTarget[t].sponsors.push(sp.sponsor || 'Sponsor');
  });

  Object.keys(byTarget).forEach(target => {
    const data = byTarget[target];
    let pot = data.pot;
    if (pot <= 0) return;
    // house cut taken immediately on sponsor payment; award full pot
    const winnerShareTotal = pot;
    // Find winners for this target using logic
    const winner = computeWinnerFromLogic(target, s);
    if (winner) {
      const winners = [winner]; // extend for multi if needed
      // cut already taken on sponsor payment; give full pot to winner(s)
      const share = Math.floor(pot / winners.length);
      winners.forEach(w => {
        s.ledger.push({
          id: generateId("ldg"),
          type: "award_win",
          managerId: w.id,
          competition: "fpl",
          round,
          amount: share,
          note: `Won ${target} sponsored by ${data.sponsors.join(', ')}`,
          at: nowISO()
        });
      });
      // mark sponsorships settled
      s.sponsorships.forEach(sp => {
        if (sp.target === target) sp.status = 'settled';
      });
    }
  });
  await persistStore();
}

// Settle a beef: total pot = #participants * stake. 90% to winner, 10% house cut immediate to 1st/2nd runner-up pots (60/40).
async function settleBeef(beefId, winnerManagerId) {
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef || ['settled', 'declined'].includes(beef.status)) return false;
  const winner = s.managers.find(m => m.id === winnerManagerId);
  if (!winner) return false;

  // Use pre-reserved prize pot (90% after immediate cuts on payments). Cuts already reflected in first/second runner-up pots.
  const winnerShare = beef.prizePot || 0;

  s.ledger.push({
    id: generateId("ldg"),
    type: "beef_win",
    managerId: winner.id,
    competition: "fpl",
    round: (s.settings.currentRound && s.settings.currentRound.fpl) || 0,
    amount: winnerShare,
    note: `Won beef "${beef.category}" — 90% pot (cuts already taken immediately on stakes)`,
    at: nowISO()
  });

  beef.status = "settled";
  beef.winner = winner.displayName;
  beef.winnerId = winner.id;
  beef.settledAt = nowISO();

  writeAtomicCollection('beefs', s.beefs || []);
  await persistStore();
  await logEvent("beef_settled", { beefId, winner: winner.id, winnerShare });
  return true;
}

async function settleBeefTied(beefId, winnerIds) {
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef || ['settled', 'declined'].includes(beef.status)) return false;
  if (!winnerIds || winnerIds.length === 0) return false;

  const winnerShare = beef.prizePot || 0;
  const num = winnerIds.length;
  const baseShare = Math.floor(winnerShare / num);

  winnerIds.forEach((wid, idx) => {
    const w = s.managers.find(m => m.id === wid);
    if (!w) return;
    const amt = (idx === num - 1) ? (winnerShare - baseShare * (num - 1)) : baseShare;
    s.ledger.push({
      id: generateId("ldg"),
      type: "beef_win",
      managerId: w.id,
      competition: "fpl",
      round: (s.settings.currentRound && s.settings.currentRound.fpl) || 0,
      amount: amt,
      note: `Won beef "${beef.category}" (tied split of 90% pot, house cut already taken)`,
      at: nowISO()
    });
  });

  beef.status = "settled";
  beef.winner = winnerIds.map(id => {
    const m = s.managers.find(mm => mm.id === id);
    return m ? m.displayName : id;
  }).join(' & ');
  beef.winnerIds = winnerIds;
  beef.settledAt = nowISO();

  writeAtomicCollection('beefs', s.beefs || []);
  await persistStore();
  await logEvent("beef_settled", { beefId, winners: winnerIds, winnerShare, tie: true });
  return true;
}

async function cancelBeef(beefId) {
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef || beef.status === 'cancelled') return false;

  const wasSettled = beef.status === 'settled';

  if (beef.paidBy) {
    if (!wasSettled) {
      // Full cancel of the bet (not yet settled): refund stakes to payers and reverse house cuts
      Object.entries(beef.paidBy).forEach(([pid, p]) => {
        if (p.amount > 0) {
          s.ledger.push({
            id: generateId("ldg"),
            type: "beef_refund",
            managerId: pid,
            amount: p.amount,
            note: `Full refund for cancelled beef "${beef.category}" (stake returned to wallet)`,
            at: nowISO()
          });
          // Reverse the house cut 60/40 since cancelled
          const cut = Math.floor(p.amount * 0.1);
          const rf = Math.floor(cut * 0.6);
          const rs = cut - rf;
          s.settings.firstRunnerUpPot = Math.max(0, (s.settings.firstRunnerUpPot || 0) - rf);
          s.settings.secondRunnerUpPot = Math.max(0, (s.settings.secondRunnerUpPot || 0) - rs);
          s.ledger.push({
            id: generateId("ldg"),
            type: "runner_up_fund",
            managerId: "system",
            amount: cut,
            note: `Reversed house cut 60/40 on refund for cancelled beef "${beef.category}"`,
            at: nowISO()
          });
        }
      });
    } else {
      // Undoing a wrong settlement only: do NOT touch stakes or house cuts again
      // (cuts were taken at payment time; we only fix the distribution of the beef pot)
    }
  }

  // If it was already settled wrongly (e.g. auto before season), deduct from the wrongly credited manager
  // by reversing the win. The pot (prizePot on the beef) remains available for correct settlement.
  if (wasSettled && beef.winnerId) {
    const winShare = beef.prizePot || 0;
    if (winShare > 0) {
      s.ledger.push({
        id: generateId("ldg"),
        type: "beef_win_reversal",
        managerId: beef.winnerId,
        amount: -winShare,
        note: `Reversed wrong auto-settlement for beef "${beef.category}" (deducted from wrong winner, pot restored for correct settlement)`,
        at: nowISO()
      });
    }
    // clear winner info so it can be re-settled
    beef.winner = null;
    beef.winnerId = null;
    beef.settledAt = null;
  }

  if (wasSettled) {
    // For undoing wrong settlement (not full cancel of the beef itself), revert to accepted
    // so the beef becomes active/visible again and can be correctly settled.
    // No stake refund or cut re-add (as per above).
    beef.status = "accepted";
  } else {
    beef.status = "cancelled";
    beef.cancelledAt = nowISO();
  }

  writeAtomicCollection('beefs', s.beefs || []);
  await persistStore();
  await logEvent("beef_cancelled", { beefId });
  return true;
}

async function autoSettleIfNeeded() {
  const s = await loadStore();
  const curF = s.settings.currentRound.fpl;
  const curU = s.settings.currentRound.ucl;

  // Autosettle = credit winners to wallet (via ledger entries).
  // No auto bank transfer here. Winner must explicitly request payout to bank.
  await settleWeeklyPot("fpl", curF - 1);
  await settleWeeklyPot("ucl", curU - 1);

  // Auto award for presets using programmable logic (after GW ends via API)
  if (curF > 1) {
    await autoAwardPresets("fpl", curF - 1);
    await settleSponsoredAwards(curF - 1);
  } else {
    console.log('[AUTO] Pre-season, skipping award auto-settles');
  }

  // Auto settle preset beefs (using detailed per-team FPL picks data for the deadline round).
  // Only runs for finished GWs (see sync timing). Beefs auto-resolve if they match presets.
  // Pre-season guard: only for round >=1
  if (curF > 1) {
    await autoSettleBeefs(curF - 1);
  } else {
    console.log('[AUTO] Season not started (curF=1), skipping beef auto-settle');
  }

  if (curF >= 38) {
    await settleEndOfSeasonH2HAndRunners();
  }
}

async function autoAwardPresets(comp, round) {
  const s = await loadStore();
  if (!round || round < 1) {
    console.log(`[AutoAward] Skipping pre-season round ${round}`);
    return;
  }
  console.log(`[AutoAward] Checking presets/sponsored for ${comp} round ${round} using FPL data`);
  // Beefs auto via autoSettleBeefs using FPL picks + logic (cap/bench/pos etc per round data).
  // Sponsored/presets lightly auto if targets set.
  // Example: if there are active 'preset' sponsorships without specific beef, award top by logic.
  const activePresets = (s.sponsorships || []).filter(sp => sp.target && sp.target.startsWith('preset:') && sp.status === 'active');
  if (activePresets.length) {
    // award top overall or by simple logic to first sponsor target
    const top = s.managers.sort((a,b) => {
      const sa = getManagerScore(a.id, comp, round) || {points:0};
      const sb = getManagerScore(b.id, comp, round) || {points:0};
      return (sb.points || 0) - (sa.points || 0);
    })[0];
    if (top) {
      const pot = activePresets.reduce((sum, sp) => sum + (sp.amount || 0), 0);
      if (pot > 0) {
        s.ledger.push({ id: generateId('ldg'), type: 'preset_award', managerId: top.id, competition: comp, round, amount: Math.floor(pot * 0.9), note: `Auto preset award for round ${round}` });
        // reduce or mark settled
        activePresets.forEach(sp => sp.status = 'settled');
        await persistStore();
      }
    }
  }
}

async function createTransferRecipient(mgr) {
  if (!mgr || !mgr.payoutDetails || !PAYSTACK_SECRET) return null;
  let details;
  try {
    details = JSON.parse(mgr.payoutDetails);
  } catch (e) {
    // Fallback to old string format for backward compat
    const parts = String(mgr.payoutDetails).split(":");
    if (parts.length < 3) return null;
    details = { type: "nuban", bank_code: parts[0], account_number: parts[1], account_name: parts[2] || mgr.displayName };
  }

  const accountName = details.account_name || mgr.displayName || "DLeague Manager";

  let postDataObj;
  if (details.type === 'international') {
    postDataObj = {
      type: "international",
      name: accountName,
      account_number: details.account_number,
      bank_name: details.bank_name || "",
      bank_code: details.swift || details.bank_code || "",
      currency: (details.currency || "USD").toUpperCase(),
      country: (details.country || "US").toUpperCase()
    };
  } else {
    // local Nigerian - nuban. bank_code must be Paystack code
    postDataObj = {
      type: "nuban",
      name: accountName,
      account_number: String(details.account_number || "").replace(/\s/g, ""),
      bank_code: String(details.bank_code || "").trim(),
      currency: "NGN"
    };
  }

  const postData = JSON.stringify(postDataObj);
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
          if (body.status && body.data && body.data.recipient_code) {
            console.log('[Paystack] Recipient created:', body.data.recipient_code);
            resolve(body.data.recipient_code);
          } else {
            console.log('[Paystack] Recipient create response:', body);
            resolve(null);
          }
        } catch { resolve(null); }
      });
    });
    req.on("error", (err) => {
      console.log('[Paystack] Recipient error', err.message);
      resolve(null);
    });
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

  // Auto-update current round from FPL for the season
  const currentEvent = bootstrap.events.find(e => e.is_current) || bootstrap.events.find(e => !e.finished);
  if (currentEvent && currentEvent.id) {
    const prevGW = s.settings.currentRound.fpl;
    s.settings.currentRound.fpl = currentEvent.id;
    // Auto-lock any active beefs for the previous GW (to prevent post-deadline joins/tricks)
    if (prevGW && prevGW < currentEvent.id) {
      (s.beefs || []).forEach(b => {
        if (['proposed', 'accepted'].includes(b.status) && !b.locked && b.joinDeadline === prevGW) {
          b.locked = true;
          b.lockedAt = nowISO();
        }
      });
    }
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
          const ev = eventMap[r];
          const eventFinished = !!(ev && ev.finished);
          if (picksData.entry_history && typeof picksData.entry_history.points === "number") {
            points = picksData.entry_history.points;
            source = "official-fpl";
            isFinal = eventFinished;
            if (!eventFinished) {
              // GW just started or still ongoing — do not flip to FINAL yet.
              // Use live projection for badge/display, even if FPL gives a running total.
              source = "live-projection";
              isFinal = false;
              const live = await safeFetchJSON(`${FPL_BASE}/event/${r}/live/`);
              if (live && picksData.picks) {
                const livePoints = computeLivePointsFromPicks(picksData.picks, live);
                if (livePoints != null) points = livePoints;
              }
            }
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
            isFinal = !!(eventMap[r] && eventMap[r].finished);
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

  // H2H wiring on sync (now uses real fplH2h data, no fake pairs)
  try { await populateH2HFixtures(s); await persistStore(); } catch (e) { console.warn('[H2H] populate failed', e.message); }

  // Only auto-settle previous GW once FPL has marked it finished (scores final, usually next day 09:00 per FPL rules).
  // This prevents settling on projections or before lockdown. Reduces need for admin intervention.
  const prevRound = (currentEvent && currentEvent.id ? currentEvent.id - 1 : null);
  const prevEv = prevRound ? eventMap[prevRound] : null;
  if (prevEv && prevEv.finished) {
    await autoSettleIfNeeded();
  } else if (prevRound) {
    console.log(`[SYNC FPL] GW${prevRound} not yet finished in FPL bootstrap — deferring auto settle (will catch on next sync/ping).`);
  }

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

  // Simple UCL player pool for demo (real names + teams from UCL)
  const uclDemoPlayers = [
    { id: 101, name: "Mbappé", team: "PSG", pos: 4 },
    { id: 102, name: "Haaland", team: "MCI", pos: 4 },
    { id: 103, name: "Vinícius", team: "RMA", pos: 4 },
    { id: 104, name: "Kane", team: "BAY", pos: 4 },
    { id: 201, name: "Musiala", team: "BAY", pos: 3 },
    { id: 202, name: "Bellingham", team: "RMA", pos: 3 },
    { id: 203, name: "Pedri", team: "BAR", pos: 3 },
    { id: 204, name: "Valverde", team: "RMA", pos: 3 },
    { id: 301, name: "Saliba", team: "ARS", pos: 2 },
    { id: 302, name: "van Dijk", team: "LIV", pos: 2 },
    { id: 303, name: "Araújo", team: "BAR", pos: 2 },
    { id: 401, name: "Maignan", team: "MIL", pos: 1 },
    { id: 402, name: "Courtois", team: "RMA", pos: 1 }
  ];

  for (const mgr of s.managers) {
    if (!mgr.ucl || !mgr.ucl.teamId) continue;
    const teamId = mgr.ucl.teamId;

    for (const r of rounds) {
      let points = null;
      let source = "pending";
      let extra = {};

      if (UCL_TEMPLATE) {
        const url = UCL_TEMPLATE
          .replace("{teamId}", teamId)
          .replace("{round}", r);
        try {
          const data = await safeFetchJSON(url);
          if (data) {
            if (typeof data.points === "number") points = data.points;
            if (data.picks) extra.picks = data.picks;
            if (data.captain) extra.captain = data.captain;
            if (data.activeChip) extra.activeChip = data.activeChip;
            source = "ucl-api";
          }
        } catch (e) {}
      }

      if (points === null && DEMO_MODE) {
        // Generate realistic UCL squad data for demo
        const shuffled = [...uclDemoPlayers].sort(() => Math.random() - 0.5);
        const starters = shuffled.slice(0, 11);
        const bench = shuffled.slice(11, 15);

        const capPick = starters[Math.floor(Math.random() * starters.length)];

        const pickPoints = {};
        starters.forEach((p, i) => {
          pickPoints[p.id] = 3 + Math.floor(Math.random() * 12);
        });
        bench.forEach((p, i) => {
          pickPoints[p.id] = Math.floor(Math.random() * 6);
        });

        points = Object.values(pickPoints).reduce((a, b) => a + b, 0) + (Math.random() > 0.7 ? 8 : 0);

        extra = {
          captain: capPick.id,
          captainName: capPick.name,
          activeChip: Math.random() > 0.85 ? "3xC" : null,
          picks: [
            ...starters.map((p, idx) => ({
              element: p.id,
              name: p.name,
              team: p.team,
              type: p.pos,
              position: idx + 1,
              multiplier: p.id === capPick.id ? 2 : 1,
              points: pickPoints[p.id]
            })),
            ...bench.map((p, idx) => ({
              element: p.id,
              name: p.name,
              team: p.team,
              type: p.pos,
              position: idx + 12,
              multiplier: 0,
              points: pickPoints[p.id]
            }))
          ]
        };

        source = "ucl-adapter-demo";
      }

      const isFinal = r < current || (r === current && source !== "pending");
      upsertScore(s, mgr.id, "ucl", r, points, source, isFinal, extra);
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

let uclStatsCache = null;
let uclStatsCacheTime = 0;

async function getUCLStats() {
  const now = Date.now();
  if (uclStatsCache && (now - uclStatsCacheTime) < 1000 * 60 * 30) { // cache 30 min
    return uclStatsCache;
  }
  const stats = await fetchUCLStats();
  if (stats) {
    uclStatsCache = stats;
    uclStatsCacheTime = now;
  }
  return stats || { matches: [], standings: [] };
}

async function getProjectedPayouts() {
  const s = getStore();
  const fplPaid = getEligibleManagers("fpl").length;
  const uclPaid = getEligibleManagers("ucl").length;

  const fplPotPerWeekBase = fplPaid * COMPETITIONS.fpl.contributionPerRound * 0.9;
  const uclPotPerMD = uclPaid * COMPETITIONS.ucl.contributionPerRound * 0.9;

  // Voluntary manager boosts (add 100% to chosen pot)
  const potBoosts = s.potBoosts || [];
  const curRound = (s.settings.currentRound && s.settings.currentRound.fpl) || 1;
  const weeklyBoosts = (s.settings.weeklyBoosts && s.settings.weeklyBoosts[curRound]) || 0;
  const weeklyPot90 = Math.floor(fplPotPerWeekBase + weeklyBoosts);

  const voluntaryH2H = potBoosts.filter(b => b.target === 'h2h').reduce((sum, b) => sum + (b.amount || 0), 0);
  const voluntaryOverall = potBoosts.filter(b => b.target === 'overall').reduce((sum, b) => sum + (b.amount || 0), 0);
  const voluntaryCup = potBoosts.filter(b => b.target === 'cup').reduce((sum, b) => sum + (b.amount || 0), 0);
  const voluntaryReserve = potBoosts.filter(b => b.target === 'reserve' || b.target === 'first-ru' || b.target === 'second-ru').reduce((sum, b) => sum + (b.amount || 0), 0);

  const weeklyReserveFullSeason = fplPaid * COMPETITIONS.fpl.contributionPerRound * 0.1 * 38;
  const h2hFromExtra = fplPaid * COMPETITIONS.fpl.extraReserve;
  const extraDirectPerManager = 700;
  const extraToOverall = Math.floor(extraDirectPerManager * 0.75);
  const extraToCup = extraDirectPerManager - extraToOverall;

  const sponsored = (s.sponsorships || []).reduce((sum, sp) => sum + (sp.amount || 0), 0);
  const uclReserve = 0;

  // Pull real UCL data for projections
  const uclStats = await getUCLStats();
  const upcomingMatches = (uclStats.matches || []).filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED');
  const upcomingUCLMatches = upcomingMatches.length;
  const uclFormBoost = Math.min(upcomingUCLMatches * 0.5, 5);

  const overallFromWeeklyReserves = Math.floor(weeklyReserveFullSeason * 0.75) + voluntaryOverall + (fplPaid * extraToOverall);
  const cupFromWeeklyReserves = Math.floor(weeklyReserveFullSeason * 0.25) + voluntaryCup + (fplPaid * extraToCup);

  // first/second runner up pots are funded directly by 60/40 of house cuts (10% from paid beefs/sponsors) immediately on payment.
  const firstRunnerUpPot = s.settings.firstRunnerUpPot || 0;
  const secondRunnerUpPot = s.settings.secondRunnerUpPot || 0;

  const h2hTotal = h2hFromExtra + voluntaryH2H;

  return {
    fpl: {
      weeklyPot90: weeklyPot90,
      h2hOverallPot: h2hTotal,
      overallWinnerPot: overallFromWeeklyReserves,
      cupWinnerPot: cupFromWeeklyReserves,
      firstRunnerUpPot: firstRunnerUpPot,
      secondRunnerUpPot: secondRunnerUpPot
    },
    ucl: {
      mdPot90: Math.floor(uclPotPerMD + uclFormBoost * 100),
      phaseReserve: 0,
      upcomingMatches: upcomingUCLMatches,
      lastStatsUpdate: uclStats.lastUpdated || null,
      overallWinnerPot: 0
    },
    // adminTotal hidden from regular managers
    seasonPots: {
      fplOverall: overallFromWeeklyReserves,
      fplCup: cupFromWeeklyReserves
    },
    h2hOverallPot: h2hTotal,
    note: "Pots: weekly 90%, H2H, overall 75%/cup 25% from reserves, first(60%)/second(40%) runner-up from 10% house cuts on beefs/sponsors (immediate on pay)."
  };
}

// ============ LEADERBOARDS & VIEWS ============

function buildManagerView(mgr) {
  const s = getStore();

  // Hard force for admin by email: always return canonical data (prevents "admin shows as Obed" even if the record in DB/JSON is mangled)
  if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    mgr.displayName = "Bolade Oladejo";
    mgr.accessCode = ADMIN_ACCESS_CODE;
    mgr.fpl = { teamId: "", teamName: "" };
    mgr.ucl = { teamId: "", teamName: "" };
    mgr.fplClubName = "";
    mgr.payoutDetails = mgr.payoutDetails || "";
    mgr.isAdmin = true;
  }

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
  const recentUcl = currentUcl || {};
  return {
    id: mgr.id,
    displayName: mgr.displayName,
    email: mgr.email,
    fplTeam: mgr.fpl || {},
    uclTeam: mgr.ucl || {},
    fplClubName: mgr.fplClubName || '',
    uclClubName: mgr.uclClubName || '',
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
    payoutDetails: mgr.payoutDetails || "",
    persona: mgr.persona || null,
    // no fines
    // Detailed FPL data for squad view
    recentCaptain: recentFpl.captain || null,
    recentCaptainName: recentFpl.captainName || null,
    recentChip: recentFpl.activeChip || null,
    recentPicks: recentFpl.picks || [],
    recentTransfers: recentFpl.transfers || 0,
    // UCL equivalent data (now wired via template or demo)
    recentUclCaptain: recentUcl.captain || null,
    recentUclCaptainName: recentUcl.captainName || null,
    recentUclChip: recentUcl.activeChip || null,
    recentUclPicks: recentUcl.picks || []
  };
}

function getFullLeaderboard() {
  const s = getStore();
  // Never surface the commissioner/admin account in public lists (spotlight, leaderboards, selects etc.).
  // Keyed by email so it never appears even if data is temporarily mangled after restore.
  const allManagers = s.managers.filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'))
    .map(m => buildManagerView(m));

  const managers = allManagers;
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

async function fetchWithFootballAuth(url) {
  if (!FOOTBALL_API_KEY) return null;

  return new Promise((resolve) => {
    const options = {
      headers: {
        "User-Agent": "DLeagueClubhouse/1.0",
        "X-Auth-Token": FOOTBALL_API_KEY
      }
    };

    const req = https.get(url, options, (res) => {
      // Examine throttling headers as per football-data.org instructions
      const remaining = res.headers["x-requests-available-minute"] || res.headers["x-requests-available-day"];
      const reset = res.headers["x-requestcounter-reset"];
      if (remaining !== undefined) {
        console.log(`[football-data] Requests remaining: ${remaining} (reset in ${reset || 'unknown'})`);
      }
      if (res.statusCode === 429) {
        console.warn("[football-data] Rate limited! Backing off.");
        // Simple backoff: resolve null, caller can retry later
        resolve(null);
        return;
      }

      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function fetchFplLeagueStandings(leagueId, isH2h = false) {
  if (!leagueId) return null;
  try {
    const path = isH2h ? "leagues-h2h" : "leagues-classic";
    const url = `${FPL_BASE}/${path}/${leagueId}/standings/`;
    const data = await safeFetchJSON(url);
    return data;
  } catch (e) {
    console.warn("[FPL League] Failed to fetch standings:", e.message);
    return null;
  }
}

// H2H wiring (from previous): on sync/load fetch using fplH2h, map by teamId, derive pairings, store in s.h2h
async function populateH2HFixtures(s) {
  const lids = s.settings.leagueIds || {};
  if (!lids.fplH2h) {
    s.h2h = [];
    return;
  }
  // Fetch the H2H standings (used in realLeagues.fplH2h for accurate data).
  // Do NOT create fake pairings here — that caused mismatch with actual FPL H2H fixtures.
  // The H2H box will display correct rank from FPL data.
  await fetchFplLeagueStandings(lids.fplH2h, true);
  s.h2h = [];  // clear fake/derived data
}

async function fetchUCLStats() {
  if (!FOOTBALL_API_KEY) return null;
  try {
    // Using football-data.org v4 for UCL (competition code CL)
    const matchesData = await fetchWithFootballAuth(
      `${FOOTBALL_API_BASE}/competitions/CL/matches?status=FINISHED,SCHEDULED&limit=50`
    );

    const standingsData = await fetchWithFootballAuth(
      `${FOOTBALL_API_BASE}/competitions/CL/standings`  // current season; add ?season=2026 if needed for 26/27
    );

    if (!matchesData) return null;

    return {
      matches: matchesData.matches || [],
      standings: standingsData?.standings || [],
      lastUpdated: new Date().toISOString()
    };
  } catch (e) {
    console.warn("[UCL Stats] Failed to fetch third-party data:", e.message);
    return null;
  }
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
      payoutDetails: JSON.stringify({ type: "nuban", bank_code: "058", account_number: "0001234567", account_name: dm.displayName }), // demo JSON format - real users set via form
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

  // No demo H2H data. If fplH2h ID set, real standings used for H2H winner. Fixtures see FPL site.

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

  // In prod, do NOT purge or touch existing managers at all. Only add the admin account if missing.
  // This ensures paid managers and their data (including FPL ID, payments) are never removed on deploys or updates.
  // Real managers stay forever.

  const existing = s.managers.find(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (existing) {
    // ALWAYS ensure admin has NO team / club. Admin is only commissioner, not a competing manager.
    // Also force canonical displayName in case previous bad data/restore set it to something else (e.g. "Obed").
    let changed = false;
    if (existing.displayName !== "Bolade Oladejo") { existing.displayName = "Bolade Oladejo"; changed = true; }
    if (existing.fplClubName) { existing.fplClubName = ""; changed = true; }
    if (existing.fpl && (existing.fpl.teamId || existing.fpl.teamName)) { existing.fpl = { teamId: "", teamName: "" }; changed = true; }
    if (existing.ucl && (existing.ucl.teamId || existing.ucl.teamName)) { existing.ucl = { teamId: "", teamName: "" }; changed = true; }
    if (existing.accessCode !== ADMIN_ACCESS_CODE) { existing.accessCode = ADMIN_ACCESS_CODE; changed = true; }
    if (!existing.isAdmin) { existing.isAdmin = true; changed = true; }
    if (changed) await persistStore();
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
    fplClubName: "",  // Admin has no team/club unless they explicitly register as a competing manager using this email
    createdAt: now,
    isAdmin: true
  };
  s.managers.push(adminMgr);
  await persistStore();
  await logEvent("admin_bootstrapped", { email: ADMIN_EMAIL });
  console.log(`✅ Admin account ready: ${ADMIN_EMAIL} (code: ${ADMIN_ACCESS_CODE})`);
}



async function recoverOrphanedPaidManagers() {
  const s = getStore();
  let changed = false;

  // Never re-create demo data (@dleague.ng or old demo patterns)
  const looksLikeDemo = (idOrEmail) => {
    if (!idOrEmail) return false;
    const str = String(idOrEmail);
    return str.includes("@dleague.ng") || str.includes("recovered-") || str.includes("demo_");
  };

  const confirmed = (s.payments || []).filter(p => p.status === "confirmed" && !looksLikeDemo(p.managerId));

  const existing = new Set(s.managers.map(m => m.id));
  const realPaidIds = [...new Set(confirmed.map(p => p.managerId))].filter(id => !looksLikeDemo(id));

  // Load best + sidecar for possible full profile hydration (permanent fix for lost names/codes on bad loads)
  const best = findBestBackupData();
  const bestMgrs = best && Array.isArray(best.managers) ? best.managers : [];
  let sideMgrs = [];
  try {
    const p = path.join(DATA_DIR, 'current-state.json');
    if (fsSync.existsSync(p)) {
      const sdata = JSON.parse(fsSync.readFileSync(p, 'utf8'));
      sideMgrs = Array.isArray(sdata.managers) ? sdata.managers : [];
    }
  } catch {}
  const hydrateSources = [...bestMgrs, ...sideMgrs];

  const recovered = [];
  for (const mid of realPaidIds) {
    if (!existing.has(mid)) {
      // Try to recover FULL original profile from best/sidecar if the id exists there
      const fromHydrate = hydrateSources.find(m => m.id === mid);
      const short = mid.slice(-6);
      const stub = fromHydrate ? {
        id: mid,
        displayName: fromHydrate.displayName || `Paid Manager ${short}`,
        email: fromHydrate.email || `paid-${short}@d-league.local`,
        accessCode: fromHydrate.accessCode || `PAID-${short.toUpperCase()}`,
        fpl: fromHydrate.fpl || { teamId: "", teamName: "" },
        ucl: fromHydrate.ucl || { teamId: "", teamName: "" },
        payoutDetails: fromHydrate.payoutDetails || "",
        fplClubName: fromHydrate.fplClubName || "",
        createdAt: fromHydrate.createdAt || nowISO(),
        _recoveredFromPayments: true,
        _hydratedFromBackup: true
      } : {
        id: mid,
        displayName: `Paid Manager ${short}`,
        email: `paid-${short}@d-league.local`,
        accessCode: `PAID-${short.toUpperCase()}`,
        fpl: { teamId: "", teamName: "" },
        ucl: { teamId: "", teamName: "" },
        payoutDetails: "",
        fplClubName: "",
        createdAt: nowISO(),
        _recoveredFromPayments: true
      };
      s.managers.push(stub);
      existing.add(mid);
      recovered.push({ id: mid, email: stub.email, code: stub.accessCode, hydrated: !!fromHydrate });
      await logEvent("manager_recovered_from_orphan_payments", { managerId: mid, tempEmail: stub.email, hydrated: !!fromHydrate });
      changed = true;
    }
  }

  if (recovered.length > 0 || changed) {
    await persistStore();
    if (recovered.length > 0) {
      console.log("🚨 Recovered real paid managers (demo data explicitly ignored):");
      recovered.forEach(r => console.log("   ", r.id, r.hydrated ? "(full details from backup)" : "(stub)"));
    }
  }
  return recovered;
}

// Expose for scripts
exports.seedDemoIfNeeded = seedDemoData;

// ============ ROUTES ============

app.get("/health", (req, res) => {
  // FAST health check for Render deploy readiness and uptime pings.
  // Full self-heal + atomic writes happen on boot and via explicit admin actions.
  // This prevents slow health checks from delaying deploys (yellow/green status).
  lastHealthPing = nowISO();
  healthPingCount++;
  res.json({ 
    status: "ok", 
    time: nowISO(),
    pingReceived: true,
    healthPingCount
  });
  // Optional: schedule light heal in background for free tier wake-ups (non-blocking)
  setImmediate(() => {
    // light background tasks if needed; avoid heavy loadStore here
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    demoMode: DEMO_MODE,
    paystackPublicKey: DEMO_MODE ? "pk_test_demo" : PAYSTACK_PUBLIC,
    callbackUrl: PAYSTACK_CALLBACK,
    competitions: COMPETITIONS,
    liveProjectionTemplate: !!LIVE_FPL_TEMPLATE,
    uclAdapterTemplate: !!UCL_TEMPLATE,
    footballStatsApi: !!FOOTBALL_API_KEY
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
  const { name, email, fplClubName, fplId, fplLeagueJoined, message } = req.body || {};
  if (!name || !email || !fplClubName) return res.status(400).json({ error: "Name, email and FPL club name required (to confirm league join)" });

  const lowerEmail = email.toLowerCase();

  // Protect admin account - never allow self-request for admin email
  if (lowerEmail === ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: "Admin accounts cannot be created via self-request." });
  }

  const s = await loadStore();

  if (!DEMO_MODE) {
    const locked = s.settings.leagueLocked || { fpl: false, ucl: false };
    const isFplRequest = !!fplId;
    if (isFplRequest && locked.fpl) {
      return res.status(403).json({ error: "FPL is locked from GW1. No new managers can join." });
    }
  }

  const existing = s.managers.find(m => m.email && m.email.toLowerCase() === lowerEmail);
  if (existing) {
    // Guard: do not allow request or leak code for existing emails
    return res.status(409).json({ 
      ok: false, 
      error: "An account with this email already exists. Use your access code to login (check your email or previous messages)." 
    });
  }

  // Self-serve new account only
  // Support client-generated code for instant UX (use provided if sent)
  const providedCode = req.body.accessCode;
  const short = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,6);
  const accessCode = providedCode || `${short.toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`;
  const mgr = {
    id: generateId("mgr"),
    displayName: name,
    email,
    accessCode,
    fpl: { teamId: fplId || '', teamName: fplClubName },
    ucl: { teamId: '', teamName: '' },
    fplClubName,
    selfRegistered: true,
    teamIdMissing: !fplId,
    createdAt: nowISO()
  };
  s.managers.push(mgr);
  await persistStore();
  try { writeAtomicCollection('managers', s.managers); } catch {}

  await logEvent("join_request", { name, email, fplClubName, fplId: fplId || '', fplLeagueJoined: !!fplLeagueJoined, message, accessCode, selfRegistered: true });
  await notifyAdminOfJoinRequest({ name, email, fplClubName, fplId: fplId || '', accessCode });

  res.json({ 
    ok: true, 
    message: `Success! Your access code is: ${accessCode}. Save it now.`,
    accessCode,
    teamIdMissing: !fplId
  });
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
  const { name, email, accessCode, fplId, uclId, fplClubName } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });

  const s = await loadStore();

  const existing = s.managers.find(m => m.email.toLowerCase() === email.toLowerCase());

  // Separate locks for FPL/UCL so admin can control joins independently.
  if (!DEMO_MODE) {
    const addingFpl = !!fplId;
    const addingUcl = !!uclId;
    if (addingFpl && s.settings.leagueLocked?.fpl) {
      return res.status(403).json({ error: "FPL is locked by admin. No new FPL managers can join." });
    }
    if (addingUcl && s.settings.leagueLocked?.ucl) {
      return res.status(403).json({ error: "UCL is locked by admin. No new UCL managers can join." });
    }
  }

  if (existing) {
    // Authorized admin call (auth passed above): allow updating details of already registered manager.
    // This protects existing paid/registered users (no duplicate error) while letting commissioner fix FPL ID, name, code, club etc. even after season live.
    if (name) existing.displayName = name;
    if (email) existing.email = email;
    if (accessCode) existing.accessCode = accessCode;
    if (fplId) existing.fpl = { teamId: fplId, teamName: fplClubName || existing.fpl?.teamName || '' };
    if (uclId) existing.ucl = { teamId: uclId, teamName: fplClubName || existing.ucl?.teamName || '' };
    if (fplClubName) existing.fplClubName = fplClubName;
    await persistStore();
    try {
      const fresh = await loadStore();
      const statePath = path.join(DATA_DIR, 'current-state.json');
      const tmpPath = statePath + '.tmp';
      fsSync.writeFileSync(tmpPath, JSON.stringify(fresh, null, 2));
      fsSync.renameSync(tmpPath, statePath);
      console.log(`[add-manager-update] Updated ${email}. Sidecar now has ${(fresh.managers || []).length} managers`);
    } catch (e) { console.warn("extra sidecar on update failed", e.message); }
    await logEvent("manager_updated_by_admin", { id: existing.id, email, name, fplClubName, fplId });
    return res.json({ ok: true, manager: { id: existing.id, displayName: name, email, accessCode }, message: "Existing manager updated (details refreshed, paid status and history untouched)." });
  }

  // New manager - create only if not locked (lock check above)
  const id = generateId("mgr");
  const mgr = {
    id,
    displayName: name,
    email,
    accessCode,
    fpl: { teamId: fplId || `test-${id.slice(-6)}`, teamName: fplClubName || `${name} FC` },
    ucl: { teamId: uclId || `ucl-${id.slice(-6)}`, teamName: fplClubName || `${name} United` },
    payoutDetails: "",  // manager must set via Update Bank Details for Paystack auto transfers
    fplClubName: fplClubName || `${name} FC`,
    createdAt: nowISO()
  };
  s.managers.push(mgr);
  await persistStore();
  // Extra belt-and-suspenders for Render: re-load and force a sidecar write so the new manager is definitely in the durable snapshot
  try {
    const fresh = await loadStore();
    if (!fresh.managers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase())) {
      console.warn("[add-manager] New manager not visible after persist — forcing extra sidecar write");
    }
    // Explicitly write sidecar again with current state
    const statePath = path.join(DATA_DIR, 'current-state.json');
    const tmpPath = statePath + '.tmp';
    fsSync.writeFileSync(tmpPath, JSON.stringify(fresh || s, null, 2));
    fsSync.renameSync(tmpPath, statePath);
    console.log(`[add-manager] Manager ${email} added. Current managers in sidecar after force: ${(fresh.managers || []).length}`);
  } catch (e) {
    console.warn("[add-manager] extra sidecar force failed", e.message);
  }
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

// Admin delete a manager (use with extreme caution before/during season - historical data in ledger, payments, beefs, events is preserved for audit and pots).
app.post("/api/admin/delete-manager", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const { managerId, email } = req.body || {};
  const s = await loadStore();
  let idx = -1;
  if (managerId) idx = s.managers.findIndex(m => m.id === managerId);
  if (idx < 0 && email) idx = s.managers.findIndex(m => m.email && m.email.toLowerCase() === email.toLowerCase());
  if (idx < 0) return res.status(404).json({ error: "Manager not found" });
  const toDel = s.managers[idx];
  if (toDel.email && toDel.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: "Cannot delete the admin commissioner account" });
  }
  try {
    s.managers.splice(idx, 1);
    await persistStore();
    await logEvent("manager_deleted_by_admin", { id: toDel.id, email: toDel.email, displayName: toDel.displayName });
    res.json({ ok: true, message: `Manager ${toDel.displayName} removed from active managers list. History preserved in ledger/payments/beefs.`, deleted: toDel.id });
  } catch (e) {
    console.error("delete-manager failed", e);
    return res.status(500).json({ error: "Failed to delete manager: " + (e.message || e) });
  }
});

// Restore / reclaim a paid manager record by its original ID (from payments).
// This fixes lost names/emails/codes for people who already paid. Does NOT touch payment records.
app.post("/api/admin/restore-paid-manager", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { managerId, name, email, accessCode, fplClubName, fplId, uclId } = req.body || {};
  if (!managerId || !name || !email || !accessCode) {
    return res.status(400).json({ error: "managerId, name, email, accessCode required to reclaim a paid record" });
  }

  const s = await loadStore();
  let mgr = s.managers.find(m => m.id === managerId);
  const wasRecovered = !!(mgr && mgr._recoveredFromPayments);

  if (!mgr) {
    // Create fresh attached to the payment ID
    mgr = {
      id: managerId,
      displayName: name,
      email,
      accessCode,
      fpl: { teamId: fplId || "", teamName: fplClubName || "" },
      ucl: { teamId: uclId || "", teamName: fplClubName || "" },
      payoutDetails: "",
      fplClubName: fplClubName || name,
      createdAt: nowISO(),
      _restored: true
    };
    s.managers.push(mgr);
  } else {
    // Update in place - keep the ID so payments, scores, ledger stay linked
    mgr.displayName = name;
    mgr.email = email;
    mgr.accessCode = accessCode;
    if (fplClubName) mgr.fplClubName = fplClubName;
    if (fplId) mgr.fpl = { teamId: fplId, teamName: fplClubName || mgr.fpl?.teamName || "" };
    if (uclId) mgr.ucl = { teamId: uclId, teamName: fplClubName || mgr.ucl?.teamName || "" };
    delete mgr._recoveredFromPayments;
    mgr._restored = true;
    mgr.restoredAt = nowISO();
  }

  await persistStore();
  await logEvent("paid_manager_restored", { managerId, name, email, byAdmin: true, wasRecovered });

  const view = buildManagerView(mgr);
  res.json({
    ok: true,
    manager: view,
    message: `Paid manager ${managerId} restored/updated. They can now login with the new email + code. Paid status preserved from payment records.`
  });
});

// Admin manual mark as paid for a league (FPL or UCL). Use when a payment happened during updates.
// Creates a confirmed payment record so paid status, pots, eligibility etc all reflect it.
app.post("/api/admin/mark-paid", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { managerId, email, competition, amount } = req.body || {};
  if (!managerId && !email) return res.status(400).json({ error: "managerId or email required" });
  if (!['fpl', 'ucl'].includes(competition)) return res.status(400).json({ error: "competition must be 'fpl' or 'ucl'" });

  const s = await loadStore();
  let mgr = null;
  if (managerId) mgr = s.managers.find(m => m.id === managerId);
  if (!mgr && email) mgr = s.managers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
  if (!mgr) return res.status(404).json({ error: "Manager not found" });

  // avoid duplicate
  const already = s.payments.find(p => p.managerId === mgr.id && p.competition === competition && p.status === "confirmed");
  if (already) {
    return res.json({ ok: true, message: "Already marked paid for " + competition, manager: buildManagerView(mgr) });
  }

  const ref = `MANUAL-${competition.toUpperCase()}-${Date.now()}-${mgr.id.slice(-6)}`;
  const amt = Number(amount) || (competition === 'fpl' ? 30000 : 15000);

  s.payments.push({
    id: generateId("pay"),
    managerId: mgr.id,
    competition,
    amount: amt,
    reference: ref,
    status: "confirmed",
    confirmedAt: nowISO(),
    paystackData: { manual: true, restoredByAdmin: true }
  });

  // update revenue tracking and pots (same as confirmPayment side effects)
  const compDef = COMPETITIONS[competition];
  const houseFee = compDef ? (compDef.adminFee || 0) : 0;
  const revKey = `total${competition.charAt(0).toUpperCase() + competition.slice(1)}Revenue`;
  const houseKey = `house${competition.charAt(0).toUpperCase() + competition.slice(1)}Admin`;
  s.settings[revKey] = (s.settings[revKey] || 0) + Math.max(0, amt - houseFee);
  s.settings[houseKey] = (s.settings[houseKey] || 0) + Math.min(amt, houseFee);

  if (competition === 'fpl') {
    s.settings.h2hOverallPot = (s.settings.h2hOverallPot || 0) + 1500; // current allocation model
  }

  await persistStore();
  await logEvent("manual_mark_paid", { managerId: mgr.id, competition, amount: amt, byAdmin: true });

  const view = buildManagerView(mgr);
  res.json({ ok: true, manager: view, message: `Marked ${mgr.displayName} paid for ${competition.toUpperCase()}. Pots and eligibility will reflect it.` });
});

// PERMANENT RECOVERY endpoint: force the server to load from the best backup (highest manager count) and persist it.
// Call with admin auth (x-admin-token = SYNC_TOKEN or logged-in admin bearer). Safe to call on seeing 0 managers.
app.post("/api/admin/restore-from-best-backup", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const best = findBestBackupData();
  if (!best || !(best.managers || []).length) {
    return res.status(404).json({ error: "No best backup with managers found on disk" });
  }

  const before = (getStore().managers || []).length;
  storeCache = best;

  // Write full atomics + sidecar for strong post-restore durability
  writeAtomicSidecar(best);
  writeAtomicCollection('managers', best.managers || []);
  writeAtomicCollection('payments', best.payments || []);
  writeAtomicCollection('ledger', best.ledger || []);
  writeAtomicCollection('beefs', best.beefs || []);
  writeAtomicCollection('sponsorships', best.sponsorships || []);
  writeAtomicCollection('challenges', best.challenges || []);
  writeAtomicCollection('scores', best.scores || []);
  writeAtomicCollection('h2h', best.h2h || []);
  writeAtomicCollection('events', best.events || []);
  if (best.cup) writeAtomicCollection('cup', best.cup);
  if (best.settings) writeAtomicCollection('settings', best.settings);

  // Run reconstruction in case best backup has payments but incomplete beefs
  try { reconstructBeefsFromPayments(storeCache); } catch (e) {}
  writeAtomicCollection('beefs', storeCache.beefs || []);

  // Also sanitize admin here, in case the best backup had mangled admin record
  try {
    let adminIdx = (storeCache.managers || []).findIndex(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (adminIdx >= 0) {
      const a = storeCache.managers[adminIdx];
      a.displayName = "Bolade Oladejo";
      a.accessCode = ADMIN_ACCESS_CODE;
      a.fpl = { teamId: "", teamName: "" };
      a.ucl = { teamId: "", teamName: "" };
      a.fplClubName = "";
      a.payoutDetails = a.payoutDetails || "";
      a.isAdmin = true;
    }
  } catch (e) {}

  await persistStore();

  // Force admin heal after restore (in case the best backup had bad admin data)
  await ensureAdminManager();

  const after = (getStore().managers || []).length;

  await logEvent("forced_restore_from_best_backup", { before, after, source: "admin" });
  console.log(`[RECOVERY] Admin forced restore from best backup: ${before} -> ${after} managers`);

  res.json({
    ok: true,
    before,
    after,
    message: `Restored from best backup on disk. Managers: ${before} -> ${after}. Full data (managers/ledger/beefs/awards/scores/etc) promoted.`
  });
});

// Restore from a previous full export JSON (the one you downloaded before bad deploy).
// POST body: { "data": <paste the full exported JSON here> }
// Auth same as other admin.
app.post("/api/admin/restore-from-export", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { data } = req.body || {};
  if (!data || !Array.isArray(data.managers) || data.managers.length === 0) {
    return res.status(400).json({ error: "Provide valid full export in 'data' field with managers array" });
  }

  const before = (getStore().managers || []).length;

  // Safety: if the export JSON has no beefs (e.g. old snapshot) but we currently have paid beefs,
  // preserve them + their paidBy so we don't lose data during restore (especially after 502s or partial writes).
  const previousBeefs = (getStore().beefs || []).slice();
  const previousPayments = (getStore().payments || []).slice();

  // Promote this as the new truth - write rich atomics for best recovery on next boots.
  // To avoid Bad Gateway / timeout on large restores (Render free), we write critical collections sync.
  // Non-critical (sponsorships, challenges, etc.) will be reconstructed on next loadStore.
  writeAtomicSidecar(data);
  writeAtomicCollection('managers', data.managers || []);
  writeAtomicCollection('payments', data.payments || []);
  writeAtomicCollection('ledger', data.ledger || []);
  writeAtomicCollection('beefs', data.beefs || []);
  writeAtomicCollection('scores', data.scores || []);
  writeAtomicCollection('events', data.events || []);
  if (data.settings) writeAtomicCollection('settings', data.settings);
  if (data.cup) writeAtomicCollection('cup', data.cup);

  // Defer the rest to not block the response and cause 502
  setTimeout(() => {
    try {
      writeAtomicCollection('sponsorships', data.sponsorships || []);
      writeAtomicCollection('challenges', data.challenges || []);
      writeAtomicCollection('potBoosts', data.potBoosts || []);
      writeAtomicCollection('complaints', data.complaints || []);
      writeAtomicCollection('h2h', data.h2h || []);
    } catch (e) {}
  }, 10);

  storeCache = data;
  if ((!Array.isArray(storeCache.beefs) || storeCache.beefs.length === 0) && previousBeefs.length > 0) {
    console.warn('[restore] Export had no beefs but server had some — preserving previous beefs to avoid data loss from old export or partial restore');
    storeCache.beefs = previousBeefs;
  }
  if ((!Array.isArray(storeCache.payments) || storeCache.payments.length === 0) && previousPayments.length > 0) {
    // only merge payments if missing, to not lose history
    storeCache.payments = previousPayments;
  }

  // CRITICAL: After blind import from user-provided JSON (which may contain mangled admin record from old bad state),
  // always sanitize the admin by email: force correct displayName, empty teams, correct code.
  // This prevents "admin shows as Obed" (or any other name) after restore, even if the exported JSON had the admin email entry corrupted.
  // User theory about "first in list" is possible if merge or some UI picked [0], but root is mangled record on the admin email.
  try {
    let adminIdx = (storeCache.managers || []).findIndex(m => m.email && m.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (adminIdx >= 0) {
      const a = storeCache.managers[adminIdx];
      a.displayName = "Bolade Oladejo";
      a.accessCode = ADMIN_ACCESS_CODE;
      a.fpl = { teamId: "", teamName: "" };
      a.ucl = { teamId: "", teamName: "" };
      a.fplClubName = "";
      a.payoutDetails = a.payoutDetails || "";
      a.isAdmin = true;
    } else {
      // ensure it exists
      storeCache.managers = storeCache.managers || [];
      storeCache.managers.push({
        id: generateId("mgr"),
        displayName: "Bolade Oladejo",
        email: ADMIN_EMAIL,
        accessCode: ADMIN_ACCESS_CODE,
        fpl: { teamId: "", teamName: "" },
        ucl: { teamId: "", teamName: "" },
        payoutDetails: "",
        fplClubName: "",
        createdAt: nowISO(),
        isAdmin: true
      });
    }
  } catch (e) { console.warn("admin sanitize after import failed", e.message); }

  // Re-write managers atomic with the sanitized admin (so the fix sticks to disk even if export was bad)
  writeAtomicCollection('managers', storeCache.managers || []);
  writeAtomicCollection('settings', storeCache.settings || {});

  // Ensure beef paidBy is restored + run full reconstruction (payments in export can recover any missing beef records)
  try { reconstructBeefsFromPayments(storeCache); } catch (e) {}
  if (Array.isArray(storeCache.beefs) && Array.isArray(storeCache.payments)) {
    storeCache.beefs.forEach(b => {
      if (!b.paidBy) b.paidBy = {};
      storeCache.payments.filter(p => p.type === 'beef_stake' && p.beefId === b.id && p.status === 'confirmed').forEach(p => {
        if (!b.paidBy[p.managerId]) {
          b.paidBy[p.managerId] = { amount: p.amount || b.stake || 0, ref: p.reference, paidAt: p.confirmedAt || p.at };
          b.totalStaked = (b.totalStaked || 0) + (p.amount || b.stake || 0);
        }
      });
    });
  }
  // CRITICAL: Re-derive runner-up pots from the (now restored) paid beef/sponsor records.
  // This fixes the case where exported settings had 0 for runner pots even though beefs were paid.
  try { reconcileRunnerUpPots(storeCache); } catch (e) {}
  // Re-force the beefs atomic right after restore in case reconstruction added anything
  writeAtomicCollection('beefs', storeCache.beefs || []);
  writeAtomicCollection('settings', storeCache.settings || {});
  await persistStore();

  // Force admin heal after restore from export — this is critical to prevent the admin record from being left as a different manager's data (e.g. "Obed" with team) just because the imported JSON was bad.
  await ensureAdminManager();

  const after = (getStore().managers || []).length;

  await logEvent("restored_from_export", { before, after, managers: after });

  res.json({
    ok: true,
    before,
    after,
    message: `Restored from your export JSON. Managers: ${before} -> ${after}. Full data (managers + ledger + beefs + sponsorships/awards + scores + challenges + events + settings) written to atomics/sidecar/DB. Use the new state immediately; future boots will prefer it.`
  });
});

// === ADMIN SUPERPOWERS FOR SMOOTH SEASON RUN ===

// Repair / resurrect beefs from payments + force atomic writes.
// Call this after restoring a JSON or if you suspect any beef disappeared.
// This is the key "make beefs immortal" helper.
app.post("/api/admin/repair-beefs", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const s = await loadStore();
  const beforeCount = (s.beefs || []).length;

  const recovered = reconstructBeefsFromPayments(s);

  // Re-derive the runner-up pots from paid beefs (this is what populates first/second after a restore of paid beefs)
  const runnerPots = reconcileRunnerUpPots(s);

  // Force full durability writes for beefs + related
  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicCollection('payments', s.payments || []);
  writeAtomicCollection('settings', s.settings || {});
  writeAtomicCollection('ledger', s.ledger || []);
  writeAtomicSidecar(s);
  await persistStore();

  const afterCount = (s.beefs || []).length;

  // Return nice summary
  const summary = (s.beefs || []).map(b => ({
    id: b.id,
    category: b.category,
    stake: b.stake,
    status: b.status,
    totalStaked: b.totalStaked || 0,
    prizePot: b.prizePot || 0,
    paidCount: Object.keys(b.paidBy || {}).length,
    reconstructed: !!b.reconstructed || !!b.reconstructedOnPay || !!b.recoveredForUser
  }));

  await logEvent("admin_repair_beefs", { before: beforeCount, after: afterCount, recovered });

  res.json({
    ok: true,
    beforeBeefCount: beforeCount,
    afterBeefCount: afterCount,
    recoveredFromPayments: recovered,
    runnerUpPots: runnerPots,
    beefs: summary,
    message: `Beefs repaired. ${beforeCount} → ${afterCount} (recovered ${recovered}). Runner-up pots now ${runnerPots.first}/${runnerPots.second}. All atomics + sidecar written. Hard refresh the UI.`
  });
});

// Nuclear force persist of EVERY collection to atomics + sidecar.
// Use after restore, big manual edits, or if you want belt+suspenders durability before redeploy.
app.post("/api/admin/force-persist-all", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const s = await loadStore();

  // Write every important collection
  const collections = ['managers', 'payments', 'ledger', 'beefs', 'sponsorships', 'challenges', 'scores', 'h2h', 'events', 'complaints', 'potBoosts'];
  collections.forEach(c => {
    writeAtomicCollection(c, s[c] || (c === 'settings' ? s.settings : []));
  });
  if (s.settings) writeAtomicCollection('settings', s.settings);
  if (s.cup) writeAtomicCollection('cup', s.cup);
  writeAtomicSidecar(s);

  await persistStore();

  res.json({
    ok: true,
    message: "Force persisted ALL collections to atomics + sidecar + DB. Beefs, pots, everything hardened.",
    beefCount: (s.beefs || []).length,
    firstRunnerUp: s.settings.firstRunnerUpPot || 0,
    secondRunnerUp: s.settings.secondRunnerUpPot || 0
  });
});

// Manual adjustment to runner-up pots (60/40 house cuts).
// Use for corrections after restore or manual awards. Delta can be positive or negative.
app.post("/api/admin/adjust-runner-up-pots", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { firstDelta = 0, secondDelta = 0, note = "Admin manual adjustment" } = req.body || {};
  const s = await loadStore();

  const beforeFirst = s.settings.firstRunnerUpPot || 0;
  const beforeSecond = s.settings.secondRunnerUpPot || 0;

  s.settings.firstRunnerUpPot = Math.max(0, beforeFirst + Number(firstDelta));
  s.settings.secondRunnerUpPot = Math.max(0, beforeSecond + Number(secondDelta));

  s.ledger.push({
    id: generateId("ldg"),
    type: "admin_pot_adjust",
    managerId: "admin",
    amount: 0,
    note: `${note} (1st: ${firstDelta}, 2nd: ${secondDelta})`,
    at: nowISO()
  });

  writeAtomicCollection('settings', s.settings);
  writeAtomicCollection('ledger', s.ledger);
  writeAtomicSidecar(s);
  await persistStore();

  res.json({
    ok: true,
    before: { first: beforeFirst, second: beforeSecond },
    after: { first: s.settings.firstRunnerUpPot, second: s.settings.secondRunnerUpPot },
    message: `Runner-up pots adjusted. 1st: ${beforeFirst} → ${s.settings.firstRunnerUpPot}, 2nd: ${beforeSecond} → ${s.settings.secondRunnerUpPot}`
  });
});

// Preview who would win 1st/2nd runner up pots right now (based on current FPL league standings)
app.get("/api/admin/preview-runner-ups", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const s = await loadStore();
  const lids = s.settings.leagueIds || {};
  // Very simple projection using current scores if available, else paid managers order
  let sorted = [];
  if (lids.fplClassic && s.scores && s.scores.length) {
    const latest = Math.max(...s.scores.filter(sc => sc.competition === 'fpl').map(sc => sc.round || 0));
    const fplScores = s.scores.filter(sc => sc.competition === 'fpl' && sc.round === latest);
    sorted = [...fplScores].sort((a,b) => b.points - a.points).slice(0,3);
  } else {
    const paid = getEligibleManagers('fpl');
    sorted = paid.slice(0,3).map((m,i) => ({managerId: m.id, points: 100 - i*10, displayName: m.displayName}));
  }
  const firstPot = s.settings.firstRunnerUpPot || 0;
  const secondPot = s.settings.secondRunnerUpPot || 0;
  res.json({
    projected1st: sorted[0] ? { manager: sorted[0].displayName || sorted[0].managerId, pot: firstPot } : null,
    projected2nd: sorted[1] ? { manager: sorted[1].displayName || sorted[1].managerId, pot: secondPot } : null,
    note: "Based on latest FPL scores or paid list. Use settle-end-season at true end of season."
  });
});

// Dedicated clear wallet deduct (admin superpower). Uses same ledger as manual-credit.
app.post("/api/admin/deduct-wallet", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const { managerId, amount, note = "Admin wallet deduct" } = req.body || {};
  const s = await loadStore();
  const target = s.managers.find(m => m.id === managerId) || s.managers.find(m => m.email && m.email.toLowerCase() === (managerId||'').toLowerCase());
  if (!target) return res.status(404).json({ error: "Manager not found" });
  const deductAmt = -Math.abs(Number(amount) || 0);
  if (deductAmt === 0) return res.status(400).json({ error: "Amount required" });
  s.ledger.push({
    id: generateId("ldg"),
    type: "wallet_deduct",
    managerId: target.id,
    amount: deductAmt,
    note,
    at: nowISO()
  });
  writeAtomicCollection('ledger', s.ledger);
  await persistStore();
  res.json({ ok: true, newBalance: getWalletBalance(target.id), message: `Deducted ₦${Math.abs(deductAmt)} from ${target.displayName}. Reason: ${note}` });
});

// ID mappings visibility superpower - shows exactly what IDs are stored for auto logic (beef, H2H, runner ups, cup)
app.get("/api/admin/id-mappings", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const s = await loadStore();
  const mappings = (s.managers || []).map(m => ({
    id: m.id,
    name: m.displayName,
    email: m.email,
    fplTeamId: m.fpl && m.fpl.teamId || '',
    uclTeamId: m.ucl && m.ucl.teamId || '',
    fplClub: m.fplClubName || '',
    payout: m.payoutDetails || ''
  }));
  res.json({
    leagueIds: s.settings.leagueIds || {},
    managers: mappings,
    note: "Use these exact IDs for FPL API calls, auto beef resolution, H2H standings, and runner-up calculations. Update via manager edit."
  });
});

// Force settle a specific round (for weekly pots + trigger auto beefs for that round)
app.post("/api/admin/force-settle-round", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const { comp = 'fpl', round } = req.body || {};
  const s = await loadStore();
  const r = Number(round) || ((s.settings.currentRound && s.settings.currentRound[comp]) || 1) - 1;
  // Trigger settle logic for the round
  try {
    // Simplified: call internal settle if available, else just log
    await settleWeeklyPot(comp, r); // if function exists in scope
  } catch(e) {}
  await autoSettleBeefs(r);
  await persistStore();
  res.json({ ok: true, round: r, comp, message: `Forced settle + auto beefs for ${comp} round ${r}. Check ledger and beefs.` });
});

// Simulate a round (mock scores for testing pots/beefs without real FPL sync)
app.post("/api/admin/simulate-round", async (req, res) => {
  if (!DEMO_MODE) {
    const adminTok = req.headers['x-admin-token'] || req.headers['x-sync-token'] || req.query.token;
    let allowed = !!(SYNC_TOKEN && adminTok === SYNC_TOKEN);
    if (!allowed) {
      const bearer = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
      if (bearer) {
        const decoded = verifyToken(bearer);
        if (decoded && decoded.managerId) {
          const mgr = getManagerById(decoded.managerId);
          if (mgr && mgr.email && mgr.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) allowed = true;
        }
      }
    }
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const { comp = 'fpl', round, scores = {} } = req.body || {}; // scores: { managerIdOrEmail: points }
  const s = await loadStore();
  const r = Number(round) || (s.settings.currentRound[comp] || 1);
  Object.entries(scores).forEach(([key, pts]) => {
    const mgr = s.managers.find(mm => mm.id === key || (mm.email||'').toLowerCase() === key.toLowerCase());
    if (mgr) {
      s.scores = s.scores || [];
      const existing = s.scores.find(sc => sc.managerId === mgr.id && sc.competition === comp && sc.round === r);
      const entry = { id: generateId('sc'), managerId: mgr.id, competition: comp, round: r, points: Number(pts), isFinal: true, simulated: true, at: nowISO() };
      if (existing) Object.assign(existing, entry);
      else s.scores.push(entry);
    }
  });
  await persistStore();
  res.json({ ok: true, message: `Simulated round ${r} for ${comp}. ${Object.keys(scores).length} managers updated. Now run settle or projections.` });
});

// Admin confirms manual payout (fallback ONLY when auto Paystack failed).
// Finds the original request entry (which already debited) and flips its type/note.
// Never double-debits. Successes from auto are already recorded as payout_completed.
app.post("/api/admin/confirm-payout", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { managerId, amount } = req.body || {};
  if (!managerId || !amount) return res.status(400).json({ error: "managerId and amount required" });

  const s = await loadStore();
  const amt = Number(amount);
  // Find most recent payout request/pending/completed for this manager+amount (reverse for newest)
  // IMPORTANT: never add a second negative debit here — the original request already debited the wallet.
  const payoutEntry = (s.ledger || []).slice().reverse().find(l =>
    l.managerId === managerId &&
    Math.abs(l.amount || 0) === amt &&
    (l.type === "payout_requested" || l.type === "payout_completed" || l.type === "payout_confirmed")
  );

  if (payoutEntry) {
    payoutEntry.note = `Payout confirmed by admin — manual bank transfer completed.`;
    payoutEntry.type = "payout_confirmed";
    payoutEntry.confirmedAt = nowISO();
  } else {
    // No matching debit entry found — do NOT create a new negative (would double-debit).
    // Record a zero-amount confirmation note only for audit.
    s.ledger.push({
      id: generateId("ldg"),
      type: "payout_confirmed",
      managerId,
      amount: 0,
      note: `Admin manual payout confirmed (no prior request entry) — external transfer of ₦${amt} recorded for audit.`,
      at: nowISO()
    });
  }

  await logEvent("payout_confirmed_manual", { managerId, amount: amt });
  writeAtomicSidecar(s);
  writeAtomicCollection('ledger', s.ledger);
  await persistStore();

  // Notify the manager
  const mgr = s.managers.find(m => m.id === managerId);
  if (mgr && mgr.email) {
    const mgrText = `Your payout request for ₦${amount} has been confirmed by admin (after auto Paystack attempt failed). The manual bank transfer has been processed. Check your ledger.`;
    await sendEmail(mgr.email, `D League Payout Confirmed - ₦${amount}`, mgrText);
  }

  res.json({ ok: true, message: "Manual payout confirmed (fallback path). Ledger entry updated (no double debit). Manager notified by email." });
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

  // challenge cancel removed as per request - no longer using challenges
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

// Admin manual credit / adjustment for known missing winnings (e.g. after recovery from lost state)
// Adds directly to ledger so wallet balance updates immediately. Use negative amount for debit.
app.post("/api/admin/manual-credit", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { managerId, email, amount, note, competition } = req.body || {};
  if (!amount || !note) return res.status(400).json({ error: "amount and note required" });

  const s = await loadStore();
  let targetMgr = null;
  if (managerId) targetMgr = s.managers.find(m => m.id === managerId);
  if (!targetMgr && email) targetMgr = s.managers.find(m => m.email && m.email.toLowerCase() === String(email).toLowerCase());

  if (!targetMgr) return res.status(404).json({ error: "Manager not found (use managerId or email)" });

  const credit = {
    id: generateId("ldg"),
    type: "manual_credit",
    managerId: targetMgr.id,
    competition: competition || "fpl",
    round: s.settings.currentRound ? (s.settings.currentRound.fpl || null) : null,
    amount: Number(amount),
    note: String(note).slice(0, 300),
    at: nowISO(),
    by: "admin"
  };
  s.ledger.push(credit);
  await logEvent("manual_credit", { managerId: targetMgr.id, email: targetMgr.email, amount: credit.amount, note: credit.note });
  await persistStore();
  res.json({ ok: true, message: `Manual credit of ₦${amount} added to ${targetMgr.displayName}. Wallet will reflect on next refresh.`, ledgerEntry: credit });
});

// Admin sets the real league IDs for FPL classic, H2H, and UCL for accurate standings, auto-awards, H2H
app.post("/api/admin/set-leagues", async (req, res) => {
  if (!DEMO_MODE) {
    // Reuse admin auth check
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { fplClassic, fplH2h, ucl } = req.body || {};
  const s = await loadStore();
  s.settings.leagueIds = {
    fplClassic: fplClassic || "",
    fplH2h: fplH2h || "",
    ucl: ucl || ""
  };
  writeAtomicSidecar(s);
  writeAtomicCollection('settings', s.settings);
  await persistStore();
  try { await populateH2HFixtures(s); await persistStore(); } catch (e) {}
  await logEvent("leagues_configured", { fplClassic, fplH2h, ucl });
  res.json({ ok: true, leagueIds: s.settings.leagueIds, message: "League IDs saved. Standings will use real FPL data where possible." });
});

// Admin toggles league lock (simple manual control, no date logic)
app.post("/api/admin/set-league-lock", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const { locked, fplLocked, uclLocked } = req.body || {};
  const s = await loadStore();
  if (typeof fplLocked !== 'undefined') s.settings.leagueLocked.fpl = !!fplLocked;
  if (typeof uclLocked !== 'undefined') s.settings.leagueLocked.ucl = !!uclLocked;
  if (typeof locked !== 'undefined') {
    s.settings.leagueLocked.fpl = !!locked;
    s.settings.leagueLocked.ucl = !!locked;
  }
  await persistStore();
  await logEvent("league_lock_toggled", { leagueLocked: s.settings.leagueLocked });
  const msg = `FPL: ${s.settings.leagueLocked.fpl ? 'LOCKED' : 'OPEN'}, UCL: ${s.settings.leagueLocked.ucl ? 'LOCKED' : 'OPEN'}`;
  res.json({ ok: true, leagueLocked: s.settings.leagueLocked, message: msg });
});

// Manager requests payout from wallet to their bank (Paystack transfer)
app.post("/api/wallet/request-payout", async (req, res) => {
  const { amount } = req.body || {};
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const balance = getWalletBalance(mgr.id);
  const payoutAmount = Math.min(Number(amount) || 0, balance);
  if (payoutAmount <= 0) return res.status(400).json({ error: "Invalid amount or insufficient balance" });
  if (!mgr.payoutDetails) return res.status(400).json({ error: "No bank details saved. Update profile first." });

  // DEFAULT: Attempt auto Paystack payout
  const transferResult = await initiateTransfer(mgr.id, payoutAmount, "Wallet withdrawal");

  const s = await loadStore();
  let entryType = "payout_requested";
  let note = `Payout to bank requested`;

  // Determine real outcome: Paystack /transfer returns {status: true, data: {status: 'success'|'pending'|'failed', ...}}
  // Treat 'success' or initial 'pending' (queued from our balance) as initiated-ok for auto-complete record.
  // Only failures (explicit error, !status, or data.status==='failed') go to manual fallback path.
  let autoSucceeded = false;
  if (transferResult && transferResult.success) {
    const d = transferResult.data || {};
    const ps = (d.status || '').toLowerCase();
    if (ps === 'success' || ps === 'pending' || ps === '') {
      autoSucceeded = true;
    }
  }

  if (autoSucceeded) {
    entryType = "payout_completed";
    note = `Auto Paystack payout to bank successful`;
  } else {
    note = `Auto Paystack payout FAILED or pending. Admin notified for manual handling.`;
    // Notify admin only on failure/pending
    const adminText = `PAYOUT AUTO FAILED (manual is fallback option only)\n\nManager: ${mgr.displayName} (${mgr.email})\nAmount: ₦${payoutAmount}\nBank details: ${mgr.payoutDetails || 'not set'}\n\nTransfer result: ${JSON.stringify(transferResult)}\n\nOpen admin cockpit → see in RECENT PAYOUTS + PENDING box. Do real bank transfer (or Paystack manual), then click CONFIRM MANUAL to flip the ledger entry (no double debit). Success autos are already recorded as payout_completed.`;
    await sendEmail(ADMIN_EMAIL, `D League Payout AUTO FAILED: ${mgr.displayName} - ₦${payoutAmount}`, adminText);
  }

  s.ledger.push({
    id: generateId("ldg"),
    type: entryType,
    managerId: mgr.id,
    amount: -payoutAmount,
    note,
    at: nowISO(),
    payoutDetails: mgr.payoutDetails,
    transferResult
  });
  await persistStore();

  const message = autoSucceeded
    ? "Payout requested and auto-completed via Paystack. Check your bank and ledger."
    : "Payout requested. Auto attempt failed — admin has been notified and can handle manually.";

  res.json({ 
    ok: true, 
    requested: payoutAmount, 
    newBalance: getWalletBalance(mgr.id), 
    transfer: transferResult,
    message
  });
});

// Proxy list of Nigerian banks from Paystack (for accurate codes in local forms)
// Always attempt fetch (bank list works without secret in most cases)
app.get("/api/paystack/banks", async (req, res) => {
  const options = {
    hostname: "api.paystack.co",
    path: "/bank?country=NG",
    method: "GET",
    headers: PAYSTACK_SECRET ? {
      Authorization: `Bearer ${PAYSTACK_SECRET}`
    } : {}
  };
  const reqPay = https.request(options, (pres) => {
    let data = "";
    pres.on("data", c => data += c);
    pres.on("end", () => {
      try {
        const body = JSON.parse(data);
        const banks = (body.data || []).map(b => ({ name: b.name, code: b.code }));
        res.json({ banks: banks.length ? banks : [] });
      } catch (e) {
        res.json({ banks: [] });
      }
    });
  });
  reqPay.on("error", () => res.json({ banks: [] }));
  reqPay.end();
});

// Manager updates own bank details for payouts (incl international)
app.post("/api/manager/update-payout", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });
  const { payoutDetails } = req.body || {};
  if (!payoutDetails) return res.status(400).json({ error: "Bank details required" });

  const s = await loadStore();
  const dbMgr = s.managers.find(m => m.id === mgr.id);
  if (!dbMgr) return res.status(404).json({ error: "Manager not found" });

  dbMgr.payoutDetails = payoutDetails;
  await persistStore();
  await logEvent("payout_details_updated", { managerId: mgr.id });

  res.json({ ok: true, message: "Bank details updated. Paystack will auto-create recipient for settlements." });
});

// Lightweight self-update for persona (5-min extension for persistence)
app.post("/api/manager/update-persona", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });
  const { persona } = req.body || {};
  if (!persona) return res.status(400).json({ error: "persona required" });

  const s = await loadStore();
  const dbMgr = s.managers.find(m => m.id === mgr.id);
  if (!dbMgr) return res.status(404).json({ error: "Manager not found" });

  dbMgr.persona = persona;
  await persistStore();
  await logEvent("persona_updated", { managerId: mgr.id, persona });

  res.json({ ok: true, message: "Persona saved." });
});

app.post("/api/sponsor", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });
  const { sponsorName, target, amount } = req.body || {};
  if (!target || !amount || amount <= 0) return res.status(400).json({ error: "Invalid sponsor data" });
  const s = await loadStore();
  const balance = getWalletBalance(mgr.id);
  if (balance < amount) {
    return res.json({ ok: false, needPaystack: true });
  }
  s.ledger.push({
    id: generateId("ldg"),
    type: "sponsor_wallet",
    managerId: mgr.id,
    amount: -amount,
    note: `Sponsored ${target} by ${sponsorName || mgr.displayName} (wallet)`,
    at: nowISO()
  });
  s.sponsorships = s.sponsorships || [];
  s.sponsorships.push({
    id: generateId("sp"),
    sponsor: sponsorName || mgr.displayName,
    amount,
    target,
    status: 'active'
  });
  // Immediate house cut 60/40 to 1st/2nd runner-up pots for wallet sponsors/awards too (reflects on pay)
  const sponsorAmtW = Number(amount) || 0;
  const sponsorCutW = Math.floor(sponsorAmtW * 0.1);
  if (sponsorCutW > 0) {
    const sfW = Math.floor(sponsorCutW * 0.6);
    const ssW = sponsorCutW - sfW;
    s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + sfW;
    s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + ssW;
    s.ledger.push({
      id: generateId("ldg"),
      type: "runner_up_fund",
      managerId: "system",
      amount: -sponsorCutW,
      note: `10% house cut 60/40 from sponsor "${target}" (wallet)`,
      at: nowISO()
    });
    writeAtomicCollection('settings', s.settings);
  }
  writeAtomicSidecar(s);
  writeAtomicCollection('sponsorships', s.sponsorships);
  writeAtomicCollection('ledger', s.ledger);
  await persistStore();

  // Notify sponsor via email
  const text = `Thank you! Your sponsorship of ₦${amount} for "${target}" has been recorded.\n\nIt will boost the pot for the award winner. Check the app for updates.`;
  await sendEmail(mgr.email, 'Sponsorship Confirmed - D League', text);

  // Notify admin
  if (ADMIN_EMAIL && ADMIN_EMAIL !== mgr.email) {
    await sendEmail(ADMIN_EMAIL, `New Sponsorship: ${target}`, `Sponsor: ${mgr.displayName} (${mgr.email})\nAmount: ₦${amount}\nTarget: ${target}`);
  }

  res.json({ ok: true });
});

// Manager submits a complaint / issue (visible to admin in events + overview)
app.post("/api/manager/complaint", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { title, description, relatedRound } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: "title and description required" });

  const s = await loadStore();
  const complaint = {
    id: generateId("cmp"),
    managerId: mgr.id,
    email: mgr.email,
    displayName: mgr.displayName,
    title: String(title).slice(0, 200),
    description: String(description).slice(0, 2000),
    relatedRound: relatedRound || null,
    at: nowISO(),
    status: 'open'
  };
  s.complaints = s.complaints || [];
  s.complaints.unshift(complaint); // newest first
  await logEvent("complaint_submitted", { managerId: mgr.id, email: mgr.email, title: complaint.title, id: complaint.id });
  await persistStore();
  res.json({ ok: true, complaintId: complaint.id, message: "Complaint received. The commissioner will review it." });
});

// Server-persisted personal beefs (critical for not losing user data on restarts)
app.post("/api/beef/propose", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { opponentIds, category, stake, paidFromWallet, joinDeadline } = req.body || {};
  if (!opponentIds || !category || !stake) return res.status(400).json({ error: "opponentIds, category, stake required" });

  const s = await loadStore();
  const opponentList = Array.isArray(opponentIds) ? opponentIds : [opponentIds];
  const currentGW = (s.settings.currentRound && s.settings.currentRound.fpl) || null;
  const beef = {
    id: generateId("beef"),
    proposerId: mgr.id,
    proposerName: mgr.displayName,
    opponentIds: opponentList,
    participants: [mgr.id, ...opponentList],
    category,
    stake: Number(stake),
    status: "proposed",
    paidFromWallet: !!paidFromWallet,
    at: nowISO(),
    paidBy: {},
    locked: false,
    joinDeadline: Math.max(1, joinDeadline || currentGW || 1),  // min 1, pre-season safe
    lockedAt: null,
    autoSettle: !!BEEF_LOGIC_MAP[category]  // only preset logic categories auto-settle; user custom categories stay manual to prevent wrong auto-settlement
  };
  if (paidFromWallet) {
    const paidAmt = Number(stake);
    beef.paidBy[mgr.id] = { amount: paidAmt, ref: 'wallet', paidAt: nowISO() };
    beef.totalStaked = paidAmt;
    const cut = Math.floor(paidAmt * 0.1);
    const first = Math.floor(cut * 0.6);
    const second = cut - first;
    s.settings.firstRunnerUpPot = (s.settings.firstRunnerUpPot || 0) + first;
    s.settings.secondRunnerUpPot = (s.settings.secondRunnerUpPot || 0) + second;
    s.ledger.push({
      id: generateId("ldg"),
      type: "runner_up_fund",
      managerId: "system",
      amount: -cut,
      note: `House cut 60/40 to 1st/2nd runner up from beef stake (wallet) for "${category}"`,
      at: nowISO()
    });
    beef.prizePot = paidAmt - cut;
  }
  s.beefs = s.beefs || [];
  s.beefs.push(beef);
  await logEvent("beef_proposed", { beefId: beef.id, proposer: mgr.email, stake: beef.stake, category });
  writeAtomicSidecar(s);
  writeAtomicCollection('beefs', s.beefs);
  writeAtomicCollection('ledger', s.ledger);
  writeAtomicCollection('settings', s.settings || {});
  await persistStore();

  // Notify opponents via email (if configured) and log for WhatsApp share
  const s2 = await loadStore();
  for (const oppId of beef.opponentIds) {
    const opp = s2.managers.find(m => m.id === oppId);
    if (opp && opp.email) {
      const text = `Hi ${opp.displayName},\n\n${beef.proposerName} has challenged you in D League!\n\nCategory: ${beef.category}\nStake: ₦${beef.stake}\nStatus: proposed (pay stake to accept)\n\nLog in to accept: ${process.env.RENDER_EXTERNAL_URL || 'https://d-league-clubhouse.onrender.com'}\n\nWhatsApp your group if needed.`;
      await sendEmail(opp.email, `D League Beef Challenge from ${beef.proposerName}`, text);
    }
  }
  // Confirm to proposer
  const textProposer = `Your beef challenge to ${beef.opponentIds.length} manager(s) for "${beef.category}" (₦${beef.stake}) has been recorded. Opponents notified via email if configured.`;
  await sendEmail(mgr.email, 'Beef Proposed - D League', textProposer);

  // Also notify admin for visibility
  if (ADMIN_EMAIL) {
    await sendEmail(ADMIN_EMAIL, `New Beef Proposed: ${beef.category}`, `Proposer: ${mgr.displayName} (${mgr.email})\nOpponents: ${beef.opponentIds.length}\nStake: ₦${beef.stake}\nCategory: ${beef.category}`);
  }

  res.json({ ok: true, beef });
});

app.post("/api/beef/accept", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { beefId } = req.body || {};
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef) return res.status(404).json({ error: "Beef not found" });
  if (beef.status !== "proposed") return res.status(400).json({ error: "Beef not in proposed state" });
  if (beef.locked) {
    return res.status(400).json({ error: "This beef is locked. Accepts not allowed." });
  }

  beef.status = "accepted";
  beef.acceptedBy = mgr.id;
  beef.acceptedAt = nowISO();
  await logEvent("beef_accepted", { beefId, accepter: mgr.email });
  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicSidecar(s);
  await persistStore();

  // Notify proposer
  const s2 = await loadStore();
  const proposer = s2.managers.find(m => m.id === beef.proposerId);
  if (proposer && proposer.email) {
    const text = `Hi ${proposer.displayName},\n\n${mgr.displayName} has accepted your beef challenge "${beef.category}" for ₦${beef.stake}!\n\nCheck the app for details and settlement after the round.`;
    await sendEmail(proposer.email, 'Beef Accepted - D League', text);
  }

  res.json({ ok: true, beef });
});

app.post("/api/beef/decline", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { beefId } = req.body || {};
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef) return res.status(404).json({ error: "Beef not found" });
  if (beef.status !== "proposed") return res.status(400).json({ error: "Beef not in proposed state" });

  if (!beef.opponentIds.includes(mgr.id)) {
    return res.status(403).json({ error: "Only an opponent can decline this beef" });
  }

  beef.status = "declined";
  beef.declinedBy = mgr.id;
  beef.declinedAt = nowISO();
  await logEvent("beef_declined", { beefId, decliner: mgr.email });
  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicSidecar(s);
  await persistStore();

  // Notify proposer
  const s2 = await loadStore();
  const proposer = s2.managers.find(m => m.id === beef.proposerId);
  if (proposer && proposer.email) {
    const text = `Hi ${proposer.displayName},\n\n${mgr.displayName} has declined your beef challenge "${beef.category}" for ₦${beef.stake}.`;
    await sendEmail(proposer.email, 'Beef Declined - D League', text);
  }

  res.json({ ok: true, beef });
});

app.post("/api/beef/request-join", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { beefId } = req.body || {};
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef || beef.status !== 'accepted') {
    return res.status(400).json({ error: "Beef must be accepted by original parties before join requests open" });
  }
  if (beef.locked) {
    return res.status(400).json({ error: "This beef is locked by admin. No new joins allowed." });
  }
  const currentGW = (s.settings.currentRound && s.settings.currentRound.fpl) || 0;
  if (beef.joinDeadline && currentGW > beef.joinDeadline) {
    return res.status(400).json({ error: "Join deadline has passed for this beef (before FPL GW lock)." });
  }

  const currentParts = beef.participants || [beef.proposerId, ...(beef.opponentIds || [])];
  if (currentParts.includes(mgr.id)) {
    return res.status(400).json({ error: "Already participating" });
  }

  beef.joinRequests = beef.joinRequests || [];
  if (!beef.joinRequests.includes(mgr.id)) {
    beef.joinRequests.push(mgr.id);
  }
  beef.joinApprovals = beef.joinApprovals || {};
  if (!beef.joinApprovals[mgr.id]) beef.joinApprovals[mgr.id] = [];

  await logEvent("beef_join_requested", { beefId, requester: mgr.email });
  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicSidecar(s);
  await persistStore();

  // Notify current participants
  const s2 = await loadStore();
  currentParts.forEach(pid => {
    const p = s2.managers.find(m => m.id === pid);
    if (p && p.email && p.id !== mgr.id) {
      sendEmail(p.email, `Join Request for Beef`, `${mgr.displayName} wants to join the beef "${beef.category}" for ₦${beef.stake}. Check the Clubhouse to approve or decline.`);
    }
  });

  res.json({ ok: true });
});

app.post("/api/beef/respond-join", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  if (!mgr) return res.status(401).json({ error: "Login required" });

  const { beefId, requesterId, approve } = req.body || {};
  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef) return res.status(404).json({ error: "Beef not found" });

  const currentParts = beef.participants || [beef.proposerId, ...(beef.opponentIds || [])];
  const isAdmin = mgr.email && mgr.email.toLowerCase() === 'bolade.oladejo@gmail.com';
  if (!currentParts.includes(mgr.id) && !isAdmin) {
    return res.status(403).json({ error: "Not a current participant" });
  }

  beef.joinApprovals = beef.joinApprovals || {};
  if (!beef.joinApprovals[requesterId]) beef.joinApprovals[requesterId] = [];

  if (approve) {
    if (isAdmin) {
      // Admin can directly approve (bypasses participant count)
      if (!beef.participants) beef.participants = currentParts;
      if (!beef.participants.includes(requesterId)) beef.participants.push(requesterId);
      beef.joinRequests = (beef.joinRequests || []).filter(id => id !== requesterId);
      await logEvent("beef_join_approved", { beefId, requester: requesterId, approver: mgr.email, byAdmin: true });
    } else {
      if (!beef.joinApprovals[requesterId].includes(mgr.id)) {
        beef.joinApprovals[requesterId].push(mgr.id);
      }
      // Only ONE participant approval needed now (reduced stress)
      if (beef.joinApprovals[requesterId].length >= 1) {
        if (!beef.participants) beef.participants = currentParts;
        if (!beef.participants.includes(requesterId)) beef.participants.push(requesterId);
        beef.joinRequests = (beef.joinRequests || []).filter(id => id !== requesterId);
        await logEvent("beef_join_approved", { beefId, requester: requesterId, approver: mgr.email });
      }
    }
  } else {
    // Decline rejects the join (admin or participant can decline)
    beef.joinRequests = (beef.joinRequests || []).filter(id => id !== requesterId);
    delete beef.joinApprovals[requesterId];
    await logEvent("beef_join_declined", { beefId, requester: requesterId, decliner: mgr.email, byAdmin: isAdmin });
  }

  writeAtomicCollection('beefs', s.beefs || []);
  writeAtomicSidecar(s);
  await persistStore();
  res.json({ ok: true, beef });
});

// Return active beefs for the logged in user or all (admin sees all)
app.get("/api/beefs", async (req, res) => {
  const mgr = getAuthenticatedManager(req);
  const s = await loadStore();
  // Reconstruct any lost beefs + paidBy from payments (beefs must never disappear)
  try { reconstructBeefsFromPayments(s); } catch (e) {}
  if (Array.isArray(s.beefs) && Array.isArray(s.payments)) {
    s.beefs.forEach(b => {
      if (!b.paidBy) b.paidBy = {};
      s.payments.filter(p => p.type === 'beef_stake' && p.beefId === b.id && p.status === 'confirmed').forEach(p => {
        if (!b.paidBy[p.managerId]) {
          b.paidBy[p.managerId] = { amount: p.amount || b.stake || 0, ref: p.reference, paidAt: p.confirmedAt || p.at };
          b.totalStaked = (b.totalStaked || 0) + (p.amount || b.stake || 0);
        }
      });
    });
  }
  // Return all active (proposed or accepted) beefs so everyone can see and join
  let beefs = (s.beefs || []).filter(b => ['proposed', 'accepted'].includes(b.status));

  // Enrich with actual names for display + paid details + pot size (cuts taken immediately on payments)
  beefs = beefs.map(b => {
    const proposer = s.managers.find(m => m.id === b.proposerId);
    const oppNames = (b.opponentIds || []).map(oid => {
      const m = s.managers.find(mm => mm.id === oid);
      return m ? m.displayName : oid;
    });
    const partNames = (b.participants || []).map(pid => {
      const m = s.managers.find(mm => mm.id === pid);
      return m ? m.displayName : pid;
    });
    const paidDetails = [];
    let paidTotal = 0;
    if (b.paidBy) {
      Object.entries(b.paidBy).forEach(([id, p]) => {
        const m = s.managers.find(mm => mm.id === id);
        paidDetails.push({
          managerId: id,
          displayName: m ? m.displayName : id,
          amount: p.amount,
          ref: p.ref || ''
        });
        paidTotal += p.amount || 0;
      });
    }
    const potSize = b.prizePot || Math.floor(paidTotal * 0.9);
    return {
      ...b,
      proposerName: proposer ? proposer.displayName : (b.proposerName || 'Unknown'),
      opponentNames: oppNames,
      participantNames: partNames,
      paidDetails,
      currentPot: potSize,
      locked: !!b.locked,
      joinDeadline: b.joinDeadline || null
    };
  });

  res.json({ beefs });
});

// Admin view all beefs (including settled/cancelled) with full payment details
app.get("/api/admin/beefs", async (req, res) => {
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

  const s = await loadStore();
  // Reconstruct any lost beefs + paidBy from payments (never lose paid beefs)
  try { reconstructBeefsFromPayments(s); } catch (e) {}
  if (Array.isArray(s.beefs) && Array.isArray(s.payments)) {
    s.beefs.forEach(b => {
      if (!b.paidBy) b.paidBy = {};
      s.payments.filter(p => p.type === 'beef_stake' && p.beefId === b.id && p.status === 'confirmed').forEach(p => {
        if (!b.paidBy[p.managerId]) {
          b.paidBy[p.managerId] = { amount: p.amount || b.stake || 0, ref: p.reference, paidAt: p.confirmedAt || p.at };
          b.totalStaked = (b.totalStaked || 0) + (p.amount || b.stake || 0);
        }
      });
    });
  }
  const allBeefs = (s.beefs || []).map(b => {
    const proposer = s.managers.find(m => m.id === b.proposerId);
    const oppNames = (b.opponentIds || []).map(oid => {
      const m = s.managers.find(mm => mm.id === oid);
      return m ? m.displayName : oid;
    });
    const partNames = (b.participants || []).map(pid => {
      const m = s.managers.find(mm => mm.id === pid);
      return m ? m.displayName : pid;
    });
    const paidDetails = [];
    let paidTotal = 0;
    if (b.paidBy) {
      Object.entries(b.paidBy).forEach(([id, p]) => {
        const m = s.managers.find(mm => mm.id === id);
        paidDetails.push({
          managerId: id,
          displayName: m ? m.displayName : id,
          amount: p.amount,
          ref: p.ref || ''
        });
        paidTotal += p.amount || 0;
      });
    }
    const potSize = b.prizePot || Math.floor(paidTotal * 0.9);
    return {
      ...b,
      proposerName: proposer ? proposer.displayName : (b.proposerName || 'Unknown'),
      opponentNames: oppNames,
      participantNames: partNames,
      paidDetails,
      currentPot: potSize,
      locked: !!b.locked,
      joinDeadline: b.joinDeadline || null
    };
  });
  res.json({ beefs: allBeefs });
});

// Admin cancel a beef + auto refund to wallets + reverse cuts
app.post("/api/admin/cancel-beef", async (req, res) => {
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

  const { beefId } = req.body || {};
  if (!beefId) return res.status(400).json({ error: "beefId required" });

  const ok = await cancelBeef(beefId);
  if (!ok) return res.status(400).json({ error: "Unable to cancel beef (already cancelled or not found)" });

  res.json({ ok: true, message: "Beef settlement undone if it was settled (reverted to accepted, winner payout reversed by deducting from wrong manager; pot available for correct settlement). House cuts untouched on settlement-undo (as they were taken at payment). For true cancel of an un-settled beef, full stake refunds + cut reversals. Re-settle correctly after via /api/admin/settle-beef if needed." });
});

// Admin lock beef (prevent new joins after deadline or manually). Prevents tricking after FPL GW deadline.
app.post("/api/admin/lock-beef", async (req, res) => {
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

  const { beefId, deadline } = req.body || {};
  if (!beefId) return res.status(400).json({ error: "beefId required" });

  const s = await loadStore();
  const beef = (s.beefs || []).find(b => b.id === beefId);
  if (!beef) return res.status(404).json({ error: "Beef not found" });
  if (['settled', 'declined', 'cancelled'].includes(beef.status)) {
    return res.status(400).json({ error: "Cannot lock a finished beef" });
  }

  beef.locked = true;
  beef.lockedAt = nowISO();
  if (deadline !== undefined) beef.joinDeadline = deadline;  // prefer GW number to align with FPL

  await persistStore();
  await logEvent("beef_locked", { beefId, byAdmin: true, deadline: beef.joinDeadline });

  res.json({ ok: true, message: "Beef locked. No new joins allowed.", beef });
});

// Admin force settle a specific challenge (pick winner or cancel)
// challenge settle removed (no longer using challenges)


// Admin settle for a beef (after determining winner by category/GW results).
// Applies: 90% of (n * stake) to winner, 10% of total pot to season reserve boost for the 3 group awards.
app.post("/api/admin/settle-beef", async (req, res) => {
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

  const { beefId, winnerManagerId } = req.body || {};
  if (!beefId || !winnerManagerId) return res.status(400).json({ error: "beefId and winnerManagerId required" });

  const ok = await settleBeef(beefId, winnerManagerId);
  if (!ok) return res.status(400).json({ error: "Unable to settle beef (already settled, invalid winner, or zero pot)" });

  res.json({ ok: true, message: "Beef settled. 90% to winner, 10% house cut to 1st/2nd runner-up pots." });
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
  // H2H on load
  try { await populateH2HFixtures(s); } catch (e) {}
  const projections = await getProjectedPayouts();

  // If admin has configured real league IDs, fetch and attach for accurate tracking
  const realLeagues = {};
  const ids = s.settings.leagueIds || {};
  if (ids.fplClassic) {
    realLeagues.fplClassic = await fetchFplLeagueStandings(ids.fplClassic, false);
  }
  if (ids.fplH2h) {
    realLeagues.fplH2h = await fetchFplLeagueStandings(ids.fplH2h, true);
  }
  // UCL league if provided (placeholder for now; use template or future API)
  if (ids.ucl) {
    realLeagues.ucl = { note: "UCL league tracking via configured ID or external adapter", id: ids.ucl };
  }

  res.json({
    currentRound: s.settings.currentRound,
    roundAverages: s.settings.roundAverages,
    ...lb,
    projections,
    realLeagues,  // Admin can use this for real standings/H2H
    leagueIds: ids,
    sponsorships: s.sponsorships || [],
    potBoosts: (s.potBoosts || []).slice(-20).map(b => {  // limit recent to keep responses small/fast
      const m = s.managers.find(mm => mm.id === b.managerId);
      return {
        ...b,
        managerName: m ? m.displayName : 'Manager',
        clubName: (m && m.fplClubName) || ''
      };
    }),
    // Expose GW win history for public "GW Winners Roll" leaderboard (only weekly wins)
    history: {
      weekly: (s.settings.history && s.settings.history.weekly) || []
    }
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
  const { managerId, competition, sponsor } = req.body || {};
  const mgr = getManagerById(managerId);
  if (!mgr) return res.status(404).json({ error: "Manager not found" });

  const s = await loadStore();

  if (sponsor) {
    const { target, amount: sAmount } = sponsor;
    if (!target || !sAmount || sAmount <= 0) return res.status(400).json({ error: "Invalid sponsor data" });
    const reference = `SP-${Date.now()}-${mgr.id.slice(-6)}`;
    s.payments.push({
      id: generateId("pay"),
      managerId: mgr.id,
      type: 'sponsor',
      sponsorTarget: target,
      amount: sAmount,
      reference,
      status: "pending",
      initiatedAt: nowISO()
    });
    await persistStore();

    if (DEMO_MODE || !PAYSTACK_PUBLIC) {
      return res.json({
        demo: true,
        reference,
        amount: sAmount,
        authorizationUrl: null,
        message: "Demo sponsor payment."
      });
    }

    const initRes = await fetchPaystackInit(reference, sAmount, mgr, 'sponsor');
    return res.json({
      reference,
      amount: sAmount,
      authorizationUrl: initRes.authorization_url,
      accessCode: initRes.access_code
    });
  }

  if (req.body.beef) {
    const { beefId, amount: bAmount } = req.body.beef;
    if (!beefId || !bAmount || bAmount <= 0) return res.status(400).json({ error: "Invalid beef stake data" });
    const reference = `BEEF-${Date.now()}-${mgr.id.slice(-6)}`;
    s.payments.push({
      id: generateId("pay"),
      managerId: mgr.id,
      type: 'beef_stake',
      beefId,
      amount: bAmount,
      reference,
      status: "pending",
      initiatedAt: nowISO()
    });
    await persistStore();

    if (DEMO_MODE || !PAYSTACK_PUBLIC) {
      return res.json({
        demo: true,
        reference,
        amount: bAmount,
        authorizationUrl: null,
        message: "Demo beef stake payment. Use simulate after."
      });
    }

    const initRes = await fetchPaystackInit(reference, bAmount, mgr, 'beef');
    return res.json({
      reference,
      amount: bAmount,
      authorizationUrl: initRes.authorization_url,
      accessCode: initRes.access_code
    });
  }

  if (req.body.potBoost) {
    const { target, amount: pAmount } = req.body.potBoost;
    if (!target || !pAmount || pAmount <= 0) return res.status(400).json({ error: "Invalid pot boost target or amount" });
    const validTargets = ['weekly', 'h2h', 'overall', 'cup', 'reserve'];
    if (!validTargets.includes(target)) return res.status(400).json({ error: "Invalid pot target" });
    const reference = `BOOST-${Date.now()}-${mgr.id.slice(-6)}`;
    s.payments.push({
      id: generateId("pay"),
      managerId: mgr.id,
      type: 'pot_boost',
      potTarget: target,
      amount: pAmount,
      reference,
      status: "pending",
      initiatedAt: nowISO()
    });
    await persistStore();

    if (DEMO_MODE || !PAYSTACK_PUBLIC) {
      return res.json({
        demo: true,
        reference,
        amount: pAmount,
        authorizationUrl: null,
        message: `Demo pot boost to ${target}. Use simulate after.`
      });
    }

    const initRes = await fetchPaystackInit(reference, pAmount, mgr, 'pot_boost');
    return res.json({
      reference,
      amount: pAmount,
      authorizationUrl: initRes.authorization_url,
      accessCode: initRes.access_code
    });
  }

  const comp = COMPETITIONS[competition];
  if (!comp) return res.status(400).json({ error: "Invalid competition" });

  if (isFullyPaidFor(mgr, competition)) {
    return res.json({ alreadyPaid: true });
  }

  const adminFee = comp.adminFee || 0;
  const totalAmount = comp.seasonFee + adminFee;
  const reference = `DL-${competition.toUpperCase()}-${Date.now()}-${mgr.id.slice(-6)}`;

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
// Emergency backup sync endpoint only - for hard sync if data out of sync. Normal is fully automatic via interval in boot.
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
      return res.status(403).json({ error: "Unauthorized - emergency use only" });
    }
  }
  const { comp } = req.body || {};
  let result;

  if (!comp || comp === "fpl") result = await syncFPL();
  if (comp === "ucl") result = await syncUCL();

  await autoSettleIfNeeded();
  const s = await loadStore();
  res.json({ ok: true, result, lastSyncAt: s.settings.lastSyncAt, note: "Emergency hard sync only. Use sparingly." });
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
  try { await populateH2HFixtures(s); } catch (e) {}
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
  const projections = await getProjectedPayouts();
  res.json(projections);
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

  const paidFplList = getEligibleManagers("fpl").map(m => ({
    id: m.id,
    displayName: m.displayName,
    restoredByAdmin: !!(m._restored || m._recoveredFromPayments)
  }));
  const paidUclList = getEligibleManagers("ucl").map(m => ({
    id: m.id,
    displayName: m.displayName,
    restoredByAdmin: !!(m._restored || m._recoveredFromPayments)
  }));

  const recentLedger = (s.ledger || []).slice(-30);
  const recentEvents = (s.events || []).slice(-50); // more for admin cockpit history
  const allChallenges = (s.challenges || []);
  const sponsorships = (s.sponsorships || []);
  const totalHouseCommission = (s.ledger || []).filter(l => l.type === "house_commission").reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);

  // Full managers summary for admin insight (includes accessCode for convenience)
  const managersSummary = s.managers.map(m => ({
    id: m.id,
    displayName: m.displayName,
    email: m.email,
    accessCode: m.accessCode,
    fplClubName: m.fplClubName || '',
    fplPaid: !!s.payments.find(p => p.managerId === m.id && p.competition === 'fpl' && p.status === 'confirmed'),
    uclPaid: !!s.payments.find(p => p.managerId === m.id && p.competition === 'ucl' && p.status === 'confirmed'),
    fplTeam: m.fpl || {},
    uclTeam: m.ucl || {},
    selfRegistered: !!m.selfRegistered,
    teamIdMissing: !!m.teamIdMissing
  }));

  res.json({
    totalManagers: s.managers.length,
    paidFpl,
    paidUcl,
    paidFplList,
    paidUclList,
    totalPaymentsConfirmed: s.payments.filter(p => p.status === "confirmed").length,
    totalFines: 0,
    lastSync: s.settings.lastSyncAt,
    reserveEstimate: await getProjectedPayouts(),
    recentLedger,
    recentEvents,
    challenges: allChallenges,
    sponsorships,
    managers: managersSummary,
    totalHouseCommission,  // 10% side cuts (beefs, sponsors, challenges)
    serviceFees: {
      fpl: s.settings.houseFplAdmin || 0,   // ₦5,000 per FPL paid manager (admin/service only)
      ucl: s.settings.houseUclAdmin || 0    // ₦2,500 per UCL
    },
    leagueLocked: s.settings.leagueLocked || { fpl: false, ucl: false },
    leagueIds: s.settings.leagueIds || { fplClassic: '', fplH2h: '', ucl: '' },
    complaints: (s.complaints || []).slice(0, 30),
    beefCount: (s.beefs || []).length,
    firstRunnerUpPot: s.settings.firstRunnerUpPot || 0,
    secondRunnerUpPot: s.settings.secondRunnerUpPot || 0
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

  // End of season (or manual trigger) for H2H + runner ups
  if (!comp || comp === 'season' || (await loadStore()).settings.currentRound.fpl >= 38) {
    await settleEndOfSeasonH2HAndRunners();
  }

  res.json({ ok: true, message: "Settlements processed, payouts initiated where possible. End-of-season awards run if applicable." });
});

// Explicit end-of-season (H2H + runner ups) - safe to call anytime, idempotent-ish via pot zeroing
app.post("/api/admin/settle-end-season", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }
  const awarded = await settleEndOfSeasonH2HAndRunners();
  res.json({ ok: true, awarded, message: "End of season H2H + runner-up awards processed using league IDs + teamId matching." });
});

// Debug endpoint for persistence health (admin only). Shows exactly what is on disk right now.
app.get("/api/admin/persistence-status", async (req, res) => {
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
    if (!allowed) return res.status(401).json({ error: "Unauthorized" });
  }

  const dbPath = path.join(DATA_DIR, "dleague.db");
  const sidecarPath = path.join(DATA_DIR, "current-state.json");
  const backupsDir = path.join(DATA_DIR, "backups");

  // Check our per-collection atomic files (the most frequently written for user data)
  const atomicFiles = ['managers', 'payments', 'ledger', 'beefs', 'sponsorships', 'settings'];
  const atomicStatus = {};
  atomicFiles.forEach(name => {
    const p = path.join(DATA_DIR, `current-${name}.json`);
    try {
      if (fsSync.existsSync(p)) {
        const stat = fsSync.statSync(p);
        const data = JSON.parse(fsSync.readFileSync(p, 'utf8'));
        atomicStatus[name] = {
          exists: true,
          mtime: stat.mtime.toISOString(),
          count: Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 0)
        };
      } else {
        atomicStatus[name] = { exists: false };
      }
    } catch (e) {
      atomicStatus[name] = { exists: false, error: e.message };
    }
  });

  let dbMgrCount = 0, dbPayCount = 0;
  try {
    if (!db) initSQLite(0);
    const mgrRow = db.prepare("SELECT value FROM store WHERE key = ?").get("managers");
    const payRow = db.prepare("SELECT value FROM store WHERE key = ?").get("payments");
    dbMgrCount = mgrRow ? JSON.parse(mgrRow.value || "[]").length : 0;
    dbPayCount = payRow ? JSON.parse(payRow.value || "[]").length : 0;
  } catch (e) { /* ignore */ }

  let sideMgrCount = 0, sideLast = null, sideEmails = [], sideBeefCount = 0;
  let sidecarData = null;
  try {
    if (fsSync.existsSync(sidecarPath)) {
      sidecarData = JSON.parse(fsSync.readFileSync(sidecarPath, "utf8"));
      sideMgrCount = (sidecarData.managers || []).length;
      sideBeefCount = (sidecarData.beefs || []).length;
      sideLast = sidecarData.settings && sidecarData.settings.lastPersistedAt;
      sideEmails = (sidecarData.managers || []).map(m => m.email).filter(Boolean).slice(0, 10);
    }
  } catch (e) { /* */ }

  let latestBackup = null, bestBackupCount = 0;
  try {
    if (fsSync.existsSync(backupsDir)) {
      const files = fsSync.readdirSync(backupsDir).filter(f => f.startsWith("store-") && f.endsWith(".json")).sort().reverse();
      for (const f of files) {
        try {
          const d = JSON.parse(fsSync.readFileSync(path.join(backupsDir, f), "utf8"));
          const c = (d.managers || []).length;
          if (!latestBackup) latestBackup = { file: f, count: c };
          if (c > bestBackupCount) bestBackupCount = c;
        } catch {}
      }
    }
  } catch (e) {}

  const sideBeefs = sidecarData ? (sidecarData.beefs || []).length : 0;
  const atomicBeefCount = atomicStatus.beefs ? atomicStatus.beefs.count : 0;
  const runnerPots = {
    firstRunnerUpPot: (sidecarData && sidecarData.settings && sidecarData.settings.firstRunnerUpPot) || 0,
    secondRunnerUpPot: (sidecarData && sidecarData.settings && sidecarData.settings.secondRunnerUpPot) || 0
  };
  res.json({
    dataDir: DATA_DIR,
    dbFile: dbPath,
    dbManagers: dbMgrCount,
    dbPayments: dbPayCount,
    sidecarFile: sidecarPath,
    sidecarExists: fsSync.existsSync(sidecarPath),
    sidecarManagers: sideMgrCount,
    sidecarBeefs: sideBeefCount,
    atomicBeefCount,
    sidecarLastPersisted: sideLast,
    sidecarSampleEmails: sideEmails,
    bestBackupManagersSeen: bestBackupCount,
    latestBackupSample: latestBackup,
    runnerUpPots: runnerPots,
    atomicFiles: atomicStatus,
    lastHealthPing,
    healthPingCount,
    note: "Beefs protected via atomic current-beefs.json + payment reconstruction. After restore use /api/admin/repair-beefs then /api/admin/force-persist-all. Runner up pots (1st 60% / 2nd 40%) funded immediately on paid beefs & sponsors."
  });
});

// Catch all for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(BASE_DIR, "public", "index.html"));
});

// ============ BOOT ============

async function boot() {
  console.log("[BOOT] Starting with hardened persistence (current-state.json sidecar + multi-source merge + WAL checkpoints)");
  console.log("🛡️ TO KEEP RENDER FREE AWAKE 24/7 (set & forget):");
  console.log("   - Use free https://cron-job.org : Create GET cron to " + (process.env.RENDER_EXTERNAL_URL || 'https://d-league-clubhouse.onrender.com') + "/health every 5 min");
  console.log("   - Or from your GO54: */5 * * * * curl -s " + (process.env.RENDER_EXTERNAL_URL || 'https://d-league-clubhouse.onrender.com') + "/health > /dev/null");
  console.log("   - Or leave admin cockpit tab open (it auto-pings /health every 60s)");
  console.log("   /health now does full auto-heal on every ping.");

  // VERY EARLY: promote best state from disk atomics before any other logic or persist
  // This ensures even on fresh deploy process, we load the best known data first.
  try {
    const atomicM = loadAtomicCollection('managers');
    const atomicP = loadAtomicCollection('payments');
    const atomicL = loadAtomicCollection('ledger');
    const atomicB = loadAtomicCollection('beefs');
    let side = null;
    try {
      const p = path.join(DATA_DIR, 'current-state.json');
      if (fsSync.existsSync(p)) {
        const d = JSON.parse(fsSync.readFileSync(p, 'utf8'));
        if (d && Array.isArray(d.managers)) side = d;
      }
    } catch {}
    const bestB = findBestBackupData();

    let bestState = {};
    const candidates = [atomicM ? {managers: atomicM} : null, side, bestB].filter(Boolean);
    candidates.forEach(c => {
      if (!bestState.managers || (c.managers && c.managers.length > (bestState.managers || []).length)) {
        bestState = c;
      }
    });
    if (bestState.managers && bestState.managers.length > 0) {
      storeCache = { ...createEmptyStore(), ...bestState };
      if (atomicP) storeCache.payments = atomicP;
      if (atomicL) storeCache.ledger = atomicL;
      if (atomicB) storeCache.beefs = atomicB;
      writeAtomicSidecar(storeCache);
      console.log(`[BOOT EARLY PROMOTE] Loaded best state with ${storeCache.managers.length} managers from disk`);
    }
  } catch (e) {
    console.warn('[BOOT EARLY PROMOTE] failed', e.message);
  }

  let store = await loadStore();
  console.log(`[BOOT] Initial loadStore: ${store.managers?.length || 0} managers, payments: ${(store.payments||[]).length}`);

  // Log exactly who we have (very useful on Render deploys)
  const loadedEmails = (store.managers || []).map(m => m.email || m.displayName || m.id).slice(0, 20);
  console.log("[BOOT] Loaded manager emails/names:", loadedEmails.join(", ") || "(none)");

  // Always attempt enrichment at boot using sidecar/best (merge only, keep freshest ledger/winnings)
  const bestAtBoot = findBestBackupData();
  const sideAtBoot = (() => {
    try {
      const p = path.join(DATA_DIR, 'current-state.json');
      return fsSync.existsSync(p) ? JSON.parse(fsSync.readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  })();
  const beforeBoot = (store.managers || []).length;
  if (sideAtBoot || bestAtBoot) {
    const mgrById = new Map((store.managers || []).map(m => [m.id, m]));
    let added = 0;
    [sideAtBoot, bestAtBoot].forEach(src => {
      (src && src.managers || []).forEach(m => {
        if (m && m.id && !mgrById.has(m.id)) {
          mgrById.set(m.id, m);
          added++;
        }
      });
    });
    if (added > 0) {
      store.managers = Array.from(mgrById.values());
      storeCache = store;
      console.log(`[BOOT] Boot enrichment added ${added} managers from sidecar/best (ledger + recent winnings preserved).`);
      await persistStore().catch(()=>{});
    }
  }

  // Force a WAL checkpoint early to help with unclean shutdowns from Render sleep/wake
  try {
    if (db) db.pragma("wal_checkpoint(FULL)");
  } catch (cpErr) { console.warn("[store] early checkpoint warning:", cpErr.message); }

  // Always recover any paid people whose manager records were dropped. Payments + scores + ledger are source of truth.
  await recoverOrphanedPaidManagers();

  if (DEMO_MODE) {
    await seedDemoData();
  } else {
    await ensureAdminManager();

  }

  // Run recovery again after possible demo seed (demo seed can wipe but we heal paid)
  await recoverOrphanedPaidManagers();

  // Final aggressive self-heal on every boot: re-run loadStore (which now always picks the richest source and merges)
  // then force a persist. This is our best guarantee that managers + full ledger are correct after any restart.
  try {
    const healed = await loadStore();
    await persistStore();
    console.log(`[BOOT FINAL SELF-HEAL] Healed & persisted: ${(healed.managers||[]).length} managers, ${(healed.ledger||[]).length} ledger entries`);
  } catch (e) {
    console.warn('[BOOT FINAL SELF-HEAL] failed', e.message);
  }

  const finalS = getStore();
  const finalMgrCount = (finalS.managers || []).length;
  const finalPayCount = (finalS.payments || []).length;
  const finalLedgerCount = (finalS.ledger || []).length;
  const finalSide = (() => { try { const p = path.join(DATA_DIR, 'current-state.json'); return fsSync.existsSync(p) ? JSON.parse(fsSync.readFileSync(p,'utf8')) : null; } catch{ return null; } })();
  console.log(`[BOOT FINAL] Managers: ${finalMgrCount} | Payments: ${finalPayCount} | Ledger entries: ${finalLedgerCount}`);
  console.log(`[BOOT FINAL] current-state.json present: ${!!finalSide} with ${(finalSide && finalSide.managers ? finalSide.managers.length : 0)} managers`);
  if (finalMgrCount <= 1) {
    console.warn("[BOOT WARNING] Low manager count after all recovery. Check Render disk mount + use admin restore endpoints if needed. Re-add via /api/admin/add-manager (it will create or update by email).");
  }

  app.listen(PORT, () => {
    console.log(`\n✅  D League Clubhouse is running!`);
    console.log(`    Open this in your browser:  http://localhost:${PORT}\n`);
    console.log(`    (Keep this terminal window open while using the app)`);
    console.log(`    DEMO_MODE=${DEMO_MODE}  |  NODE_ENV=${process.env.NODE_ENV || "development"}\n`);
  });

  // Fully automatic data refresh and settlements in production (no manual needed, use for backup only)
  if (!DEMO_MODE) {
    // Initial after start
    setTimeout(async () => {
      try {
        await syncFPL();
        await syncUCL();
        await autoSettleIfNeeded();
      } catch (e) { console.error('[AUTO] initial sync error', e); }
    }, 10000);

    // Periodic every 30 min to catch GW/MD conclusion
    setInterval(async () => {
      try {
        console.log('[AUTO SYNC] Running periodic refresh and settle...');
        await syncFPL();
        await syncUCL();
        await autoSettleIfNeeded();
      } catch (e) { console.error('[AUTO] periodic error', e); }
    }, 30 * 60 * 1000);
  }

  // === CREATIVE FREE-TIER KEEP-ALIVE / MAINTENANCE (while process is awake) ===
  // Every 5 minutes while the service is running (woken by pings/users/webhooks):
  // - Force write all durable sidecars and atomics (ensures state is fresh).
  // - Full WAL checkpoint.
  // This "keeps it ready" without manual work. Combined with external free pinger, it helps stay consistent 24/7.
  // No sleep prevention from inside (Render free will sleep without traffic), but instant heal on any traffic.
  setInterval(async () => {
    try {
      const s = await loadStore();
      writeAtomicSidecar(s);
      writeAtomicCollection('managers', s.managers);
      writeAtomicCollection('payments', s.payments);
      writeAtomicCollection('ledger', s.ledger);
      writeAtomicCollection('beefs', s.beefs || []);
      writeAtomicCollection('sponsorships', s.sponsorships || []);
      writeAtomicCollection('settings', s.settings || {});
      if (db) db.pragma("wal_checkpoint(FULL)");
      console.log('[MAINTENANCE] Sidecars + checkpoint refreshed while awake');
    } catch (e) {
      console.warn('[MAINTENANCE] failed', e.message);
    }
  }, 5 * 60 * 1000); // 5 min
}

boot().catch(err => {
  console.error("Boot failed", err);
  process.exit(1);
});

// Best-effort WAL checkpoint on shutdown (helps durability across sleeps/deploys)
['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(sig => {
  process.on(sig, () => {
    try {
      if (db) {
        db.pragma("wal_checkpoint(FULL)");
        console.log("[store] WAL checkpoint on shutdown");
      }
    } catch (e) { /* ignore */ }
    process.exit(0);
  });
});
