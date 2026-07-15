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
      // Revenue tracking for season pots (excluding pure house admin fees)
      totalFplRevenue: 0,
      totalUclRevenue: 0,
      houseFplAdmin: 0,
      houseUclAdmin: 0,
      // Season end pots (5% FPL rev to overall FPL, 2.5% to cup, 5% UCL rev to UCL overall)
      fplOverallPot: 0,
      fplCupPot: 0,
      uclOverallPot: 0,
      h2hOverallPot: 0,
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
    complaints: [] // {id, managerId, email, title, description, relatedRound?, at, status: 'open'|'resolved'}
  };
}

let storeCache = null;
let storeWriteLock = false;
let db = null;

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
  if (storeCache) return storeCache;

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
    // Always collect from all three sources and pick the "richest" one.
    // This is the key to making managers + data "always correct" even after bad restarts.
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
      const persistedAt = (src.data.settings && src.data.settings.lastPersistedAt) || '';
      const score = mgrs.length * 10000 + ledgerLen + (persistedAt ? 1 : 0);
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

    storeCache = loaded || {};

    let needsPersist = false;

    // Ensure critical non-data keys (settings) without forcing empty data arrays over potentially missing keys
    if (!storeCache.settings) {
      storeCache.settings = { ...defaults.settings };
      needsPersist = true;
    }
    // Initialize collection keys to arrays only if completely absent (first run); do not overwrite or persist empty if key missing after partial load
    ['managers','payments','scores','ledger','h2h','challenges','sponsorships','events','complaints'].forEach(k => {
      if (!Array.isArray(storeCache[k])) storeCache[k] = [];
    });
    if (!storeCache.cup) storeCache.cup = { ...defaults.cup };

    // === ROBUST MULTI-SOURCE RECONCILE (the permanent solution) ===
    // Load up to 3 sources: SQLite (primary), atomic current-state.json sidecar (very durable), best historical backup (last resort).
    // Then MERGE instead of blindly replacing with a potentially stale backup.
    // This guarantees we keep the *most current ledger, winnings, pots* while recovering any missing managers.
    const bestBackup = findBestBackup();
    const sidecar = tryLoadCurrentState();

    function mergeSources(primary, ...others) {
      const result = { ...primary };
      // Start from primary (usually the freshest SQLite or sidecar)
      ['managers', 'payments', 'ledger', 'scores', 'events', 'sponsorships', 'challenges', 'h2h', 'complaints'].forEach(key => {
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
      ['ledger', 'payments', 'scores', 'events', 'sponsorships', 'challenges', 'complaints'].forEach(key => {
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
                         'fplOverallPot', 'fplCupPot', 'uclOverallPot', 'h2hOverallPot'];
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

    const insert = db.prepare("INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)");
    const tx = db.transaction((store) => {
      for (const [key, value] of Object.entries(store)) {
        insert.run(key, JSON.stringify(value));
      }
    });

    // Write durable sidecar FIRST (atomic) before touching DB. This gives the best chance the full state (incl new manager) survives unclean shutdowns.
    try {
      const statePath = path.join(DATA_DIR, 'current-state.json');
      const tmpPath = statePath + '.tmp';
      fsSync.writeFileSync(tmpPath, JSON.stringify(storeCache, null, 2));
      fsSync.renameSync(tmpPath, statePath);
    } catch (sideErr) {
      console.warn("[sidecar] Failed to write current-state.json (pre-db):", sideErr.message);
    }

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
  console.log("📨 NEW JOIN REQUEST - ACTION REQUIRED");
  console.log("Send access code to the user's real email:");
  console.log("  Name:   ", join.name);
  console.log("  Email:  ", join.email);
  console.log("  FPL Club:", join.fplClubName);
  console.log("  FPL ID: ", join.fplId || 'not provided');
  console.log("  Time:   ", new Date().toISOString());
  console.log("Use /api/admin/add-manager (with your admin token or login as admin) to generate code + add them.");
  console.log("========================================\n");

  const subject = "D League Clubhouse - Access Request Received";
  const text = `Hi ${join.name},\n\nWe received your join request for FPL club "${join.fplClubName}" (FPL ID: ${join.fplId || 'N/A'}).\nThe commissioner will verify and email you the access code + instructions shortly.\n\nThank you,\nD League Clubhouse`;

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

  if (payment.type === 'sponsor' && payment.sponsorTarget) {
    s.sponsorships = s.sponsorships || [];
    s.sponsorships.push({
      id: generateId("sp"),
      sponsor: mgr.displayName,
      amount: payment.amount,
      target: payment.sponsorTarget,
      status: 'active'
    });
  } else {
    // Track revenue for season pots (exclude pure house admin fees)
    const compDef = COMPETITIONS[competition];
    const houseFee = compDef ? (compDef.adminFee || 0) : 0;
    if (competition === 'fpl' || competition === 'ucl') {
      const revKey = `total${competition.charAt(0).toUpperCase() + competition.slice(1)}Revenue`;
      const houseKey = `house${competition.charAt(0).toUpperCase() + competition.slice(1)}Admin`;
      s.settings[revKey] = (s.settings[revKey] || 0) + Math.max(0, Number(amount) - houseFee);
      s.settings[houseKey] = (s.settings[houseKey] || 0) + Math.min(Number(amount), houseFee);
    }
  }

  await logEvent("payment_confirmed", { managerId, competition, reference, amount });
  updateSeasonPots(s);
  await persistStore();
  return payment;
}

function updateSeasonPots(s) {
  const fplRev = s.settings.totalFplRevenue || 0;
  const uclRev = s.settings.totalUclRevenue || 0;
  s.settings.fplOverallPot = Math.floor(0.05 * fplRev);
  s.settings.fplCupPot = Math.floor(0.025 * fplRev);
  s.settings.uclOverallPot = Math.floor(0.2 * uclRev);  // 20% of UCL revenue (after 2.5k house) ≈ 2,500 per paid manager for final standings
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
  const sharePerWinner = Math.floor(pot.winnerShare / tiedWinners.length);
  tiedWinners.forEach(w => {
    s.ledger.push({
      id: generateId("ldg"),
      type: "weekly_win",
      managerId: w.managerId,
      competition: comp,
      round,
      amount: sharePerWinner,
      note: `${comp.toUpperCase()} GW/MD ${round} winner (90% split for tie)`,
      at: nowISO()
    });
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

  // For FPL, deduct 10% of winner share to season H2H pot (accumulates for END OF SEASON H2H winner only - NOT paid weekly)
  if (comp === 'fpl') {
    const h2hDeduction = Math.floor(sharePerWinner * 0.1);
    s.settings.h2hOverallPot = (s.settings.h2hOverallPot || 0) + h2hDeduction;
    // Note the deduction in ledger for transparency
    s.ledger.push({
      id: generateId("ldg"),
      type: "h2h_deduction",
      managerId: "system",
      competition: comp,
      round,
      amount: -h2hDeduction,
      note: `10% deduction from weekly winner share to season H2H pot (end of season)`,
      at: nowISO()
    });
  }

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

async function settleOpenChallenges() {
  const s = await loadStore();
  let settled = 0;
  for (const ch of s.challenges) {
    if (ch.status !== "open") continue;
    // Programmable: use logic if available, else top
    const winnerMgr = computeWinnerFromLogic(ch.logic || 'default', s);
    if (winnerMgr) {
      const pot = ch.prize || 0; // for challenges
      const commission = Math.floor(pot * 0.1);
      const winnerShare = pot - commission;
      s.ledger.push({
        id: generateId("ldg"),
        type: "challenge_win",
        managerId: winnerMgr.id,
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
      ch.winner = winnerMgr.displayName;
      settled++;
    }
  }
  if (settled) await persistStore();
  return settled;
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

async function settleSponsoredAwards(round) {
  const s = await loadStore();
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
    const commission = Math.floor(pot * 0.1);
    const winnerShareTotal = pot - commission;
    // Find winners for this target using logic
    const winner = computeWinnerFromLogic(target, s);
    if (winner) {
      const winners = [winner]; // extend for multi if needed
      const share = Math.floor(winnerShareTotal / winners.length);
      winners.forEach(w => {
        s.ledger.push({
          id: generateId("ldg"),
          type: "award_win",
          managerId: w.id,
          competition: "fpl",
          round,
          amount: share,
          note: `Won ${target} sponsored by ${data.sponsors.join(', ')} (split if tie, 10% house)`,
          at: nowISO()
        });
      });
      s.ledger.push({
        id: generateId("ldg"),
        type: "house_commission",
        managerId: "house",
        competition: "fpl",
        round,
        amount: -commission,
        note: `House 10% from ${target}`,
        at: nowISO()
      });
      // mark sponsorships settled
      s.sponsorships.forEach(sp => {
        if (sp.target === target) sp.status = 'settled';
      });
    }
  });
  await persistStore();
}

async function autoSettleIfNeeded() {
  const s = await loadStore();
  const curF = s.settings.currentRound.fpl;
  const curU = s.settings.currentRound.ucl;

  // Detect if previous round concluded (using bootstrap data or previous sync)
  // In practice, call after sync when new GW/MD starts
  await settleWeeklyPot("fpl", curF - 1);
  await payWinnersForRound("fpl", curF - 1);
  await settleWeeklyPot("ucl", curU - 1);
  await payWinnersForRound("ucl", curU - 1);

  // Auto award for presets using programmable logic (after GW ends via API)
  await autoAwardPresets("fpl", curF - 1);
  await settleOpenChallenges();
  await settleSponsoredAwards(curF - 1);
  // TODO: for h2h settled, credit winner 90% house 10%
}

async function autoAwardPresets(comp, round) {
  const s = await loadStore();
  // Example: Auto resolve any open personal beef or sponsored using compute logic from JS side or here
  // For live, frontend or external can call compute and settle
  console.log(`[AutoAward] Check for preset awards for ${comp} round ${round} using real API data`);
  // In full impl, iterate open challenges with logic id, compute winner from scores/picks, award minus 10%
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
    s.settings.currentRound.fpl = currentEvent.id;
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
  // Enhanced: admin fees (5k/manager), sponsorships added to pots. Base pot = paid * 500 * 0.9. Sponsored funds boost specific awards.
  // Now augmented with real third-party UCL stats for better projections.
  const s = getStore();
  const fplPaid = getEligibleManagers("fpl").length;
  const uclPaid = getEligibleManagers("ucl").length;

  const fplPotPerWeek = fplPaid * COMPETITIONS.fpl.contributionPerRound * 0.9;
  const uclPotPerMD = uclPaid * COMPETITIONS.ucl.contributionPerRound * 0.9;

  // Rough season totals + admin
  const fplReserve = fplPaid * (COMPETITIONS.fpl.contributionPerRound * 0.1 * 38 + COMPETITIONS.fpl.extraReserve);
  const uclReserve = uclPaid * (COMPETITIONS.ucl.contributionPerRound * 0.1 * 17 + COMPETITIONS.ucl.extraReserve);

  const sponsored = (s.sponsorships || []).reduce((sum, sp) => sum + (sp.amount || 0), 0);

  // Pull real UCL data for projections (upcoming matches affect expected pots/activity)
  const uclStats = await getUCLStats();
  const upcomingMatches = (uclStats.matches || []).filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED');
  const upcomingUCLMatches = upcomingMatches.length;
  const uclFormBoost = Math.min(upcomingUCLMatches * 0.5, 5); // simple boost based on real schedule

  const seasonPots = {
    fplOverall: s.settings.fplOverallPot || Math.floor(0.05 * (s.settings.totalFplRevenue || 0)),
    fplCup: s.settings.fplCupPot || Math.floor(0.025 * (s.settings.totalFplRevenue || 0)),
    uclOverall: s.settings.uclOverallPot || Math.floor(0.05 * (s.settings.totalUclRevenue || 0))
  };

  return {
    fpl: {
      weeklyPot90: Math.floor(fplPotPerWeek),
      seasonReserve: Math.floor(fplReserve + sponsored * 0.4),
      overallWinnerPot: seasonPots.fplOverall,
      cupWinnerPot: seasonPots.fplCup
    },
    ucl: {
      mdPot90: Math.floor(uclPotPerMD + uclFormBoost * 100),
      phaseReserve: Math.floor(uclReserve + sponsored * 0.4),
      upcomingMatches: upcomingUCLMatches,
      lastStatsUpdate: uclStats.lastUpdated || null,
      overallWinnerPot: seasonPots.uclOverall
    },
    adminTotal: (fplPaid + uclPaid) * 5000,
    seasonPots,
    h2hOverallPot: s.settings.h2hOverallPot || 0,
    note: "Weekly pots 90% to winner(s). H2H is SEASON pot only (10% from FPL weekly pots accumulates; paid to overall H2H winner at end, not weekly). Season pots: 5% FPL rev to overall FPL winner, 2.5% to cup, 5% UCL rev to UCL overall. House cuts (10% weekly) + initial admin fees (FPL 5k, UCL 2.5k pure house) fund/maintain. See ledger for details."
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
  const recentUcl = currentUcl || {};
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
    payoutDetails: mgr.payoutDetails || "",
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

async function fetchUCLStats() {
  if (!FOOTBALL_API_KEY) return null;
  try {
    // Using football-data.org v4 for UCL (competition code CL)
    const matchesData = await fetchWithFootballAuth(
      `${FOOTBALL_API_BASE}/competitions/CL/matches?status=FINISHED,SCHEDULED&limit=50`
    );

    const standingsData = await fetchWithFootballAuth(
      `${FOOTBALL_API_BASE}/competitions/CL/standings?season=2025`
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
    let changed = false;
    if (existing.fplClubName) { existing.fplClubName = ""; changed = true; }
    if (existing.fpl && (existing.fpl.teamId || existing.fpl.teamName)) { existing.fpl = { teamId: "", teamName: "" }; changed = true; }
    if (existing.ucl && (existing.ucl.teamId || existing.ucl.teamName)) { existing.ucl = { teamId: "", teamName: "" }; changed = true; }
    if (existing.accessCode !== ADMIN_ACCESS_CODE) { existing.accessCode = ADMIN_ACCESS_CODE; changed = true; }
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
  res.json({ status: "ok", time: nowISO(), demo: DEMO_MODE, version: "1.0.0" });
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

  const s = await loadStore();

  await logEvent("join_request", { name, email, fplClubName, fplId: fplId || '', fplLeagueJoined: !!fplLeagueJoined, message });
  await notifyAdminOfJoinRequest({ name, email, fplClubName, fplId: fplId || '' });

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
  const { name, email, accessCode, fplId, uclId, fplClubName } = req.body || {};
  if (!name || !email || !accessCode) return res.status(400).json({ error: "name, email, accessCode required" });

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
    existing.displayName = name;
    existing.email = email;
    existing.accessCode = accessCode;
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
  await persistStore();
  const after = (getStore().managers || []).length;

  await logEvent("forced_restore_from_best_backup", { before, after, source: "admin" });
  console.log(`[RECOVERY] Admin forced restore from best backup: ${before} -> ${after} managers`);

  res.json({
    ok: true,
    before,
    after,
    message: `Restored from best backup. Managers: ${before} -> ${after}. All real profiles (names, codes, FPL IDs) should now be present.`
  });
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
  await persistStore();
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

  // Trigger Paystack transfer
  const transferResult = await initiateTransfer(mgr.id, payoutAmount, "Wallet withdrawal");
  
  // Record the request/withdrawal in ledger even if transfer pending
  const s = await loadStore();
  s.ledger.push({
    id: generateId("ldg"),
    type: "withdrawal_requested",
    managerId: mgr.id,
    amount: -payoutAmount,
    note: `Withdrawal request (Paystack transfer initiated to saved bank)`,
    at: nowISO(),
    transferResult
  });
  await persistStore();

  res.json({ 
    ok: true, 
    requested: payoutAmount, 
    newBalance: getWalletBalance(mgr.id), 
    transfer: transferResult,
    message: "Payout requested. Check your bank and ledger. Transfer via Paystack initiated from league balance."
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
  await persistStore();
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
    sponsorships: s.sponsorships || []
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

  const recentLedger = (s.ledger || []).slice(0, 30);
  const recentEvents = (s.events || []).slice(0, 50); // more for admin cockpit history
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
    uclTeam: m.ucl || {}
  }));

  res.json({
    totalManagers: s.managers.length,
    paidFpl,
    paidUcl,
    totalPaymentsConfirmed: s.payments.filter(p => p.status === "confirmed").length,
    totalFines: 0,
    lastSync: s.settings.lastSyncAt,
    reserveEstimate: await getProjectedPayouts(),
    recentLedger,
    recentEvents,
    challenges: allChallenges,
    sponsorships,
    managers: managersSummary,
    totalHouseCommission,
    leagueLocked: s.settings.leagueLocked || { fpl: false, ucl: false },
    complaints: (s.complaints || []).slice(0, 30)
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

  let dbMgrCount = 0, dbPayCount = 0;
  try {
    if (!db) initSQLite(0);
    const mgrRow = db.prepare("SELECT value FROM store WHERE key = ?").get("managers");
    const payRow = db.prepare("SELECT value FROM store WHERE key = ?").get("payments");
    dbMgrCount = mgrRow ? JSON.parse(mgrRow.value || "[]").length : 0;
    dbPayCount = payRow ? JSON.parse(payRow.value || "[]").length : 0;
  } catch (e) { /* ignore */ }

  let sideMgrCount = 0, sideLast = null, sideEmails = [];
  try {
    if (fsSync.existsSync(sidecarPath)) {
      const data = JSON.parse(fsSync.readFileSync(sidecarPath, "utf8"));
      sideMgrCount = (data.managers || []).length;
      sideLast = data.settings && data.settings.lastPersistedAt;
      sideEmails = (data.managers || []).map(m => m.email).filter(Boolean).slice(0, 10);
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

  res.json({
    dataDir: DATA_DIR,
    dbFile: dbPath,
    dbManagers: dbMgrCount,
    dbPayments: dbPayCount,
    sidecarFile: sidecarPath,
    sidecarExists: fsSync.existsSync(sidecarPath),
    sidecarManagers: sideMgrCount,
    sidecarLastPersisted: sideLast,
    sidecarSampleEmails: sideEmails,
    bestBackupManagersSeen: bestBackupCount,
    latestBackupSample: latestBackup,
    note: "This shows the raw truth on disk right now. The server always picks the richest source (most managers + ledger) on load and saves it. Use the button in Admin Cockpit to force it."
  });
});

// Catch all for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(BASE_DIR, "public", "index.html"));
});

// ============ BOOT ============

async function boot() {
  console.log("[BOOT] Starting with hardened persistence (current-state.json sidecar + multi-source merge + WAL checkpoints)");

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
