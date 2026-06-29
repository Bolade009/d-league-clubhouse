const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");

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

const FPL_BASE = "https://fantasy.premierleague.com/api";

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

async function loadStore() {
  if (storeCache) return storeCache;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    storeCache = JSON.parse(raw);
  } catch (e) {
    storeCache = createEmptyStore();
    await persistStore();
  }
  return storeCache;
}

async function persistStore() {
  if (storeWriteLock) return;
  storeWriteLock = true;
  try {
    const tmp = STORE_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(storeCache, null, 2));
    await fs.rename(tmp, STORE_FILE);
  } finally {
    storeWriteLock = false;
  }
}

function getStore() {
  if (!storeCache) {
    // synchronous fallback for early calls
    try {
      const raw = fsSync.readFileSync(STORE_FILE, "utf8");
      storeCache = JSON.parse(raw);
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

// ============ SCORING & FINES ============

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

          // Extract detailed data
          extra.captain = picksData.picks?.find(p => p.multiplier === 2 || p.multiplier === 3)?.element || null;
          extra.activeChip = picksData.active_chip || null;
          extra.picks = picksData.picks || [];
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
  await logEvent("sync_ucl_completed", { rounds });
  return { ok: true };
}

// ============ FINES & CALCULATIONS ============

async function finalizeRoundAndApplyFines(comp, round) {
  const s = await loadStore();
  const avg = s.settings.roundAverages[comp] || 0;
  const eligible = getEligibleManagers(comp);

  let finesCreated = 0;

  for (const mgr of eligible) {
    const sc = getManagerScore(mgr.id, comp, round);
    if (!sc || typeof sc.points !== "number" || !sc.isFinal) continue;

    if (sc.points < avg) {
      const fineAmount = 500;
      const already = s.ledger.find(l => l.type === "fine" && l.managerId === mgr.id && l.round === round && l.competition === comp);
      if (!already) {
        s.ledger.push({
          id: generateId("ldg"),
          type: "fine",
          managerId: mgr.id,
          competition: comp,
          round,
          amount: -fineAmount,
          note: `Below average (${sc.points} < ${avg})`,
          at: nowISO()
        });
        finesCreated++;
      }
    }
  }

  await persistStore();
  return finesCreated;
}

function getWalletBalance(managerId) {
  const s = getStore();
  return s.ledger
    .filter(l => l.managerId === managerId)
    .reduce((sum, l) => sum + (l.amount || 0), 0);
}

function getManagerFines(managerId) {
  const s = getStore();
  return s.ledger.filter(l => l.type === "fine" && l.managerId === managerId);
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
  const fines = getManagerFines(mgr.id).reduce((a, b) => a + Math.abs(b.amount), 0);

  return {
    id: mgr.id,
    displayName: mgr.displayName,
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
    totalFines: fines,
    eligible: fplPaid || uclPaid
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
  const s = await loadStore();
  if (s.managers.length > 0 && !force) return;

  const demoManagers = [
    { displayName: "Ayo Balogun", email: "ayo@dleague.ng", code: "ayo2026", fplId: "4782912", uclId: "ucl-ayo-91" },
    { displayName: "Chinedu Eze", email: "chinedu@dleague.ng", code: "chi2026", fplId: "3129847", uclId: "ucl-chi-47" },
    { displayName: "Amara Okoro", email: "amara@dleague.ng", code: "ama2026", fplId: "5567341", uclId: "ucl-ama-12" },
    { displayName: "Emeka Obi", email: "emeka@dleague.ng", code: "eme2026", fplId: "1982734", uclId: "ucl-eme-88" },
    { displayName: "Fatima Sule", email: "fatima@dleague.ng", code: "fat2026", fplId: "6671203", uclId: "ucl-fat-55" },
    { displayName: "Tunde Adebayo", email: "tunde@dleague.ng", code: "tun2026", fplId: "4458921", uclId: "ucl-tun-29" },
    { displayName: "Zainab Ibrahim", email: "zainab@dleague.ng", code: "zai2026", fplId: "7783945", uclId: "ucl-zai-03" },
    { displayName: "Chukwudi Nwosu", email: "chukwudi@dleague.ng", code: "chu2026", fplId: "2234765", uclId: "ucl-chu-71" }
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
      fpl: { teamId: dm.fplId, teamName: dm.displayName.split(" ")[0] + " FC" },
      ucl: { teamId: dm.uclId, teamName: dm.displayName.split(" ")[0] + " United" },
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

  // Some fines
  const some = s.managers[3];
  if (some) {
    s.ledger.push({
      id: generateId("ldg"), type: "fine", managerId: some.id, competition: "fpl", round: 3,
      amount: -500, note: "Below average (GW3)", at: now
    });
  }

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

  // Challenges
  s.challenges = [
    { id: generateId("ch"), title: "Most Clean Sheets GW6", status: "open", prize: 2000, entrants: 4 },
    { id: generateId("ch"), title: "Highest Scoring MD3 UCL", status: "settled", prize: 1500, entrants: 6, winner: s.managers[1].displayName }
  ];

  // Ledger seed for some payouts
  const top = s.managers[0];
  if (top) {
    s.ledger.push({ id: generateId("ldg"), type: "pot_win", managerId: top.id, competition: "fpl", round: 2, amount: 4500, note: "GW2 winner (90%)", at: now });
    s.ledger.push({ id: generateId("ldg"), type: "reserve", managerId: top.id, competition: "fpl", round: null, amount: 1200, note: "League reserve share", at: now });
  }

  s.settings.lastSyncAt = nowISO();

  await persistStore();
  await logEvent("demo_seeded", { count: s.managers.length });
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
  await seedDemoData();
  const { email, code } = req.body || {};
  const s = await loadStore();

  const mgr = s.managers.find(m => m.email.toLowerCase() === String(email || "").toLowerCase());
  if (!mgr) return res.status(404).json({ error: "Manager not found" });
  if (mgr.accessCode !== code) return res.status(401).json({ error: "Invalid access code" });

  const token = signToken({ managerId: mgr.id, iat: Date.now() });
  const view = buildManagerView(mgr);

  res.json({
    token,
    manager: view,
    message: "Welcome to the D League Clubhouse"
  });
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
  await seedDemoData();
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
  const fines = getManagerFines(mgr.id);
  const h2h = getH2HForManager(mgr.id);

  res.json({
    ...view,
    fplScores,
    uclScores,
    ledger,
    fines,
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

// Protected sync
app.post("/api/sync/run", requireSyncAuth, async (req, res) => {
  const { comp } = req.body || {};
  let result;

  if (!comp || comp === "fpl") result = await syncFPL();
  if (comp === "ucl") result = await syncUCL();

  // After sync attempt to finalize previous round fines
  const s = await loadStore();
  const curF = s.settings.currentRound.fpl;
  const curU = s.settings.currentRound.ucl;

  await finalizeRoundAndApplyFines("fpl", curF - 1);
  await finalizeRoundAndApplyFines("ucl", curU - 1);

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
  await seedDemoData();
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
      fines: m.totalFines,
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
    "Fines auto-deducted from next pot payout",
    "Cup QF live — check bracket"
  ];
  res.json({ messages, lastSync: s.settings.lastSyncAt });
});

// Admin-ish overview (no sensitive data)
app.get("/api/admin/overview", async (req, res) => {
  const s = await loadStore();
  const paidFpl = getEligibleManagers("fpl").length;
  const paidUcl = getEligibleManagers("ucl").length;

  res.json({
    totalManagers: s.managers.length,
    paidFpl,
    paidUcl,
    totalPaymentsConfirmed: s.payments.filter(p => p.status === "confirmed").length,
    totalFines: s.ledger.filter(l => l.type === "fine").length,
    lastSync: s.settings.lastSyncAt,
    reserveEstimate: getProjectedPayouts()
  });
});

// Catch all for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(BASE_DIR, "public", "index.html"));
});

// ============ BOOT ============

async function boot() {
  await loadStore();
  if (DEMO_MODE) {
    await seedDemoData();
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
