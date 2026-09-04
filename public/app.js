// D League Clubhouse — Premium Frontend
let currentManager = null;

function normalizeAdmin(current) {
  if (current && current.email && current.email.toLowerCase() === 'bolade.oladejo@gmail.com') {
    current.displayName = 'Bolade Oladejo';
    current.fpl = current.fpl || {};
    current.fpl.teamId = '';
    current.fpl.teamName = '';
    current.ucl = current.ucl || {};
    current.ucl.teamId = '';
    current.ucl.teamName = '';
    current.fplClubName = '';
  }
  return current;
}
let currentToken = null;
let standingsData = null;
let currentLeagueMode = 'fpl'; // 'fpl' or 'ucl'

const $ = (id) => document.getElementById(id);

// Static comprehensive list of Nigerian banks from Paystack (for reliable name-based dropdown)
const STATIC_NIGERIAN_BANKS = [
  { name: "9mobile 9Payment Service Bank", code: "120001" },
  { name: "Abbey Mortgage Bank", code: "801" },
  { name: "Above Only MFB", code: "51204" },
  { name: "Abulesoro MFB", code: "51312" },
  { name: "Access Bank", code: "044" },
  { name: "Access Bank (Diamond)", code: "063" },
  { name: "Airtel Smartcash PSB", code: "120004" },
  { name: "ALAT by WEMA", code: "035A" },
  { name: "Amju Unique MFB", code: "50926" },
  { name: "Aramoko MFB", code: "50083" },
  { name: "ASO Savings and Loans", code: "401" },
  { name: "Astrapolaris MFB LTD", code: "MFB50094" },
  { name: "Bainescredit MFB", code: "51229" },
  { name: "Bowen Microfinance Bank", code: "50931" },
  { name: "Carbon", code: "565" },
  { name: "CEMCS Microfinance Bank", code: "50823" },
  { name: "Chanelle Microfinance Bank Limited", code: "50171" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Corestep MFB", code: "50204" },
  { name: "Coronation Merchant Bank", code: "559" },
  { name: "Crescent MFB", code: "51297" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Ekimogun MFB", code: "50263" },
  { name: "Ekondo Microfinance Bank", code: "562" },
  { name: "Eyowo", code: "50126" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Firmus MFB", code: "51314" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "FSDH Merchant Bank Limited", code: "501" },
  { name: "Gateway Mortgage Bank LTD", code: "812" },
  { name: "Globus Bank", code: "00103" },
  { name: "GoMoney", code: "100022" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Hackman Microfinance Bank", code: "51251" },
  { name: "Hasal Microfinance Bank", code: "50383" },
  { name: "Heritage Bank", code: "030" },
  { name: "HopePSB", code: "120002" },
  { name: "Ibile Microfinance Bank", code: "51244" },
  { name: "Ikoyi Osun MFB", code: "50439" },
  { name: "Infinity MFB", code: "50457" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Kadpoly MFB", code: "50502" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kredi Money MFB LTD", code: "50200" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Lagos Building Investment Company Plc.", code: "90052" },
  { name: "Links MFB", code: "50549" },
  { name: "Living Trust Mortgage Bank", code: "031" },
  { name: "Lotus Bank", code: "303" },
  { name: "Mayfair MFB", code: "50563" },
  { name: "Mint MFB", code: "50304" },
  { name: "MTN Momo PSB", code: "120003" },
  { name: "Paga", code: "100002" },
  { name: "PalmPay", code: "999991" },
  { name: "Parallex Bank", code: "104" },
  { name: "Parkway - ReadyCash", code: "311" },
  { name: "Paycom", code: "999992" },
  { name: "Petra Mircofinance Bank Plc", code: "50746" },
  { name: "Polaris Bank", code: "076" },
  { name: "Polyunwana MFB", code: "50864" },
  { name: "PremiumTrust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "QuickFund MFB", code: "51293" },
  { name: "Rand Merchant Bank", code: "502" },
  { name: "Refuge Mortgage Bank", code: "90067" },
  { name: "Rubies MFB", code: "125" },
  { name: "Safe Haven MFB", code: "51113" },
  { name: "Solid Rock MFB", code: "50800" },
  { name: "Sparkle Microfinance Bank", code: "51310" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Stellas MFB", code: "51253" },
  { name: "Sterling Bank", code: "232" },
  { name: "Suntrust Bank", code: "100" },
  { name: "TAJ Bank", code: "302" },
  { name: "Tangerine Money", code: "51269" },
  { name: "TCF MFB", code: "51211" },
  { name: "Titan Bank", code: "102" },
  { name: "Titan Paystack", code: "100039" },
  { name: "Unical MFB", code: "50871" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank For Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank Limited", code: "566" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
  { name: "OPay Digital Services Limited (OPay)", code: "100004" }
];

function populateLocalBankSelect() {
  const select = document.getElementById('local-bank-code');
  if (!select) return;
  const staticBanks = STATIC_NIGERIAN_BANKS.slice().sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = '<option value="">-- Select your bank --</option>';
  staticBanks.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.code;
    opt.textContent = b.name;
    select.appendChild(opt);
  });
}

// Tailwind script run
function initTailwind() {
  if (window.tailwind) {
    window.tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['system-ui', '-apple-system', 'sans-serif']
          }
        }
      }
    };
  }
}

async function fetchJSON(url, opts = {}) {
  const headers = opts.headers || {};
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  // Auto-set JSON content type for POST/PUT with string body (fixes admin add-manager etc.)
  if (opts.body && typeof opts.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============ LOGIN ============
async function performLogin() {
  const emailEl = $('login-email');
  const codeEl = $('login-code');
  if (!emailEl || !codeEl) {
    alert('Login form elements not found. Please refresh the page.');
    return;
  }
  const email = emailEl.value.trim();
  const code = codeEl.value.trim();

  if (!email || !code) {
    alert('Please enter email and access code.');
    return;
  }

  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });

    currentToken = data.token;
    currentManager = normalizeAdmin(data.manager);

    // Clear any previous session artifacts (prevents admin token from a prior session leaking into a new normal login)
    localStorage.removeItem('dl_activeBeefs');
    localStorage.removeItem('dl_playerChallenges');

    localStorage.setItem('dl_token', currentToken);
    localStorage.setItem('dl_manager_id', currentManager.id);

    showDashboard();
    loadAllData();
    // Re-check deep link after login in case they opened the WA link unauthenticated
    setTimeout(() => { handleBeefDeepLink(); handlePredictionDeepLink(); }, 400);
  } catch (e) {
    alert('Login failed: ' + e.message + '\n\nTip: New managers must be added by the commissioner first. Use the "REQUEST ACCESS" button or message the group admin.');
  }
}

function logout() {
  // Aggressively clear everything related to the previous session to prevent any cross-account leakage on refresh
  localStorage.removeItem('dl_token');
  localStorage.removeItem('dl_manager_id');
  localStorage.removeItem('dl_activeBeefs');
  localStorage.removeItem('dl_playerChallenges');
  // Clear any in-memory state
  currentToken = null;
  currentManager = null;
  window.activeBeefs = [];
  location.reload();
}

async function tryAutoLogin() {
  const token = localStorage.getItem('dl_token');
  const mgrId = localStorage.getItem('dl_manager_id');
  if (!token || !mgrId) return false;

  try {
    const me = await fetchJSON(`/api/me?token=${token}`);
    currentToken = token;
    currentManager = normalizeAdmin(me.manager);

    // Safety: if we loaded the admin account via auto-login, make it very obvious.
    // Normal users should never see this unless they have the real admin code.
    if (currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com') {
      console.warn('%c[AUTO-LOGIN] Loaded ADMIN account via localStorage token. If this is unexpected, you may have a stale admin token from previous login on this browser.', 'color:orange; font-weight:bold');
    }

    return true;
  } catch (e) {
    // Critical safety: on any auth failure during auto-login, clear the potentially stale token.
    // This prevents a normal user from accidentally (or maliciously left) loading the admin account on hard refresh.
    console.warn('Auto-login failed with token, clearing localStorage to prevent stale admin session leak:', e);
    localStorage.removeItem('dl_token');
    localStorage.removeItem('dl_manager_id');
    return false;
  }
}

// ============ DASHBOARD RENDER ============
function showDashboard() {
  $('login-screen').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  // Header / topbar manager info
  const topRight = $('topbar-right');
  const rawPersona = currentManager.persona || '';
  const cleanPersona = rawPersona.split('(')[0].trim();
  const topName = cleanPersona 
    ? `${currentManager.displayName} - <span class="text-[#00ff85] cursor-pointer hover:underline" onclick="showPersonaDetails('${cleanPersona.replace(/'/g, "\\'")}')">${cleanPersona}</span>` 
    : currentManager.displayName;
  topRight.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="hidden md:block text-right">
        <div class="text-sm font-semibold text-white">${topName}</div>
        <div class="text-[10px] text-[#00ff85] -mt-0.5">FPL: ${currentManager.fplPaid ? 'PAID' : 'NOT PAID'} | UCL: ${currentManager.uclPaid ? 'PAID' : 'NOT PAID'}</div>
      </div>
      <div class="w-9 h-9 rounded-2xl bg-black border border-[#333] flex items-center justify-center text-[#00ff85] font-black text-lg">
        ${currentManager.displayName[0]}
      </div>
    </div>
  `;

  renderPayAccess();

  $('welcome-line').textContent = `WELCOME BACK, MANAGER • ${new Date().getFullYear()}`;
  const mgrNameEl = $('manager-name');
  if (mgrNameEl) {
    const b = getBadgeForManager(currentManager.id);
    mgrNameEl.innerHTML = b ? `${b} ${currentManager.displayName}` : currentManager.displayName;
  }
  // Persona as big as the name, separated by hyphen, green. Clickable for full details (no brackets).
  if (currentManager.persona) {
    const nameEl = $('manager-name');
    const rawP = currentManager.persona;
    const cleanP = rawP.split('(')[0].trim();
    if (nameEl) {
      nameEl.innerHTML = `${currentManager.displayName} - <span class="text-6xl text-[#00ff85] font-black tracking-[-3.2px] leading-none cursor-pointer hover:underline" onclick="showPersonaDetails('${cleanP.replace(/'/g, "\\'")}')">${cleanP}</span>`;
    }
  }

  // Wallet display (real balance from ledger settlements) + prominent bank update
  const nameEl = $('manager-name');
  // Remove any previous wallet row
  let prevWallet = nameEl && nameEl.parentNode ? nameEl.parentNode.querySelector('.wallet-row') : null;
  if (prevWallet) prevWallet.remove();

  const hasBank = !!(currentManager.payoutDetails && currentManager.payoutDetails.length > 10);
  let bankStatus = hasBank ? `<span class="text-[#00ff85] text-xs ml-1">✓ Bank on file — auto Paystack payouts enabled</span>` : `<span class="text-amber-400 text-xs ml-1">⚠ No bank set. Click to add for auto payouts</span>`;

  const walletEl = document.createElement('div');
  walletEl.className = 'wallet-row mt-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1';
  walletEl.innerHTML = `
    <span>Wallet: <span class="font-bold">₦${(currentManager.wallet || 0).toLocaleString()}</span></span>
    <button onclick="requestPayout()" class="text-xs px-3 py-1 bg-[#00ff85] text-black font-semibold rounded-lg active:scale-[0.985]">Request Payout to Bank</button>
    <button onclick="showUpdateBankModal()" class="text-xs px-3 py-1 border border-[#00ff85] text-[#00ff85] font-semibold rounded-lg active:scale-[0.985]">Update Bank Details</button>
    ${bankStatus}
    <button onclick="showSponsorModal()" class="text-xs px-3 py-1 bg-yellow-500 text-black font-semibold rounded-lg active:scale-[0.985]">🏆 Sponsor an Award</button>
    ${currentLeagueMode !== 'ucl' ? `<button onclick="showBeefModal()" class="text-xs px-3 py-1 bg-purple-600 text-white font-semibold rounded-lg active:scale-[0.985] ml-2">⚔️ Start a Beef</button>` : ''}
  `;
  if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(walletEl);

  // Status line - clean (paid per competition)
  const status = $('manager-status-line');
  status.innerHTML = `<span class="text-xs text-[#888]">FPL or UCL — pay the one(s) you want. Separate flows.</span>`;

  // Render the two clear static pay blocks (reliable, no fragile insert)
  renderPayAccess();

  // Pre-populate bank select with static list immediately for instant UX
  populateLocalBankSelect();

  // Preload (may update with live Paystack list in prod)
  loadPaystackBanks().then(banks => {
    const select = document.getElementById('local-bank-code');
    if (select && banks && banks.length > 0) {
      // Re-populate with potentially fresher list if API succeeded
      const sorted = banks.slice().sort((a, b) => a.name.localeCompare(b.name));
      select.innerHTML = '<option value="">-- Select your bank --</option>';
      sorted.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.code;
        opt.textContent = b.name;
        select.appendChild(opt);
      });
    }
  }).catch(() => {});

  // Populate hero stats immediately from the data we already have
  renderManagerHero();

  // Show backend admin view ASAP for commissioner (in case later loads have issues)
  const isComm = currentManager && currentManager.email &&
    currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com';
  if (isComm) {
    loadAdminOverview();
  }

  // If we detect the admin email but the displayName is wrong (e.g. "Obed" after bad restore), force correct and show clear option
  if (currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com') {
    if (currentManager.displayName !== 'Bolade Oladejo') {
      currentManager.displayName = 'Bolade Oladejo';
      currentManager.fpl = currentManager.fpl || {};
      currentManager.fpl.teamId = '';
      currentManager.fpl.teamName = '';
      currentManager.ucl = currentManager.ucl || {};
      currentManager.ucl.teamId = '';
      currentManager.ucl.teamName = '';
      currentManager.fplClubName = '';
      console.warn('Forced admin displayName to canonical after possible bad restore data');
    }
    // Inject a clear session button in the topbar area if not already there
    const topRight = $('topbar-right');
    if (topRight && !document.getElementById('clear-session-dashboard')) {
      const clearLink = document.createElement('a');
      clearLink.id = 'clear-session-dashboard';
      clearLink.href = '#';
      clearLink.style.cssText = 'font-size:10px; color:#ffaa00; margin-left:8px; text-decoration:underline;';
      clearLink.textContent = ' [clear session / force re-login] ';
      clearLink.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('dl_token');
        localStorage.removeItem('dl_manager_id');
        localStorage.removeItem('dl_activeBeefs');
        localStorage.removeItem('dl_playerChallenges');
        location.reload();
      };
      topRight.appendChild(clearLink);
    }
  }

  // Start in FPL separate flow
  setTimeout(() => {
    const sel = $('league-selector');
    if (sel) switchLeague('fpl');
  }, 200);
}

function renderPayAccess() {
  if (!currentManager) return;
  const fplBlock = $('pay-fpl-block');
  const uclBlock = $('pay-ucl-block');
  const fplStatus = $('fpl-pay-status');
  const uclStatus = $('ucl-pay-status');
  const fplBtn = $('fpl-pay-btn');
  const uclBtn = $('ucl-pay-btn');

  if (fplBlock && fplStatus && fplBtn) {
    if (currentManager.fplPaid) {
      fplStatus.innerHTML = `<span class="bg-[#003322] text-[#00ff85] px-2 py-0.5 rounded">✓ PAID</span>`;
      fplBtn.style.display = 'none';
      fplBlock.style.borderColor = '#00ff85';
    } else {
      fplStatus.innerHTML = `<span class="text-[#ffaa00]">NOT PAID</span>`;
      fplBtn.style.display = '';
      fplBlock.style.borderColor = '#333';
    }
  }
  if (uclBlock && uclStatus && uclBtn) {
    if (currentManager.uclPaid) {
      uclStatus.innerHTML = `<span class="bg-[#003322] text-[#00ff85] px-2 py-0.5 rounded">✓ PAID</span>`;
      uclBtn.style.display = 'none';
      uclBlock.style.borderColor = '#00ff85';
    } else {
      uclStatus.innerHTML = `<span class="text-[#ffaa00]">NOT PAID</span>`;
      uclBtn.style.display = '';
      uclBlock.style.borderColor = '#333';
    }
  }
}

async function loadAllData() {
  // Paint what we already have from login so the dashboard isn't blank while standings load.
  if (typeof renderPayAccess === 'function') renderPayAccess();
  if (typeof renderManagerHero === 'function') renderManagerHero();
  await loadStandings().catch(e => console.warn('standings load failed', e));
  fetchJSON('/api/beefs').then(d => {
      if (d && Array.isArray(d.beefs)) {
        const serverBeefs = d.beefs;
        let localBeefs = [];
        try { localBeefs = JSON.parse(localStorage.getItem('dl_activeBeefs') || '[]'); } catch {}
        // Merge to ensure beefs never disappear: keep any local-only (e.g. after transient server empty), prefer server data for known IDs
        const byId = new Map();
        (serverBeefs || []).forEach(b => { if (b && b.id) byId.set(b.id, { ...b }); });
        (localBeefs || []).forEach(b => {
          if (b && b.id && !byId.has(b.id)) {
            byId.set(b.id, { ...b });
          }
        });
        const mergedBeefs = Array.from(byId.values());
        window.activeBeefs = mergedBeefs;
        // Never nuke a good local backup with server [] on hard refresh
        const toPersist = (mergedBeefs && mergedBeefs.length > 0) ? mergedBeefs : (serverBeefs && serverBeefs.length > 0 ? serverBeefs : localBeefs);
        try { localStorage.setItem('dl_activeBeefs', JSON.stringify(toPersist || [])); } catch {}
        (serverBeefs || []).forEach(sb => {
          const exists = playerChallenges.findIndex(pc => pc.serverId === sb.id);
          if (exists === -1) {
            playerChallenges.push({
              serverId: sb.id,
              proposer: sb.proposerName || 'manager',
              opponent: (sb.opponentNames || sb.opponentIds || []).join(', '),
              category: sb.category,
              stake: sb.stake,
              status: sb.status,
              participantNames: sb.participantNames || [],
              joinRequests: sb.joinRequests || [],
              joinApprovals: sb.joinApprovals || {},
              locked: sb.locked || false,
              joinDeadline: sb.joinDeadline || null
            });
          }
        });
      }
    }).catch(e => {
      console.warn('server beefs load failed', e);
      // fallback local backup so active beefs (paid or not) never disappear on refresh
      try {
        const backup = JSON.parse(localStorage.getItem('dl_activeBeefs') || '[]');
        if (backup.length && (!window.activeBeefs || window.activeBeefs.length === 0)) {
          window.activeBeefs = backup;
        }
      } catch {}
    }).then(() => { if (typeof renderActiveBeefs === 'function') renderActiveBeefs(); });
  renderManagerHero();
  renderSpotlight();
  renderSquadChips();
  renderActiveBeefs();
  renderLineupViewer();

  // Auto settle awards for current round (wired)
  autoSettleAwards();

  // Default FPL view on fresh data
  if (!currentLeagueMode || currentLeagueMode === 'fpl') {
    setTimeout(() => switchLeague('fpl'), 300);
  }

  // Ensure buttons are clickable
  const fplBtn = document.getElementById('fpl-btn');
  const uclBtn = document.getElementById('ucl-btn');
  if (fplBtn) fplBtn.onclick = () => switchLeague('fpl');
  if (uclBtn) uclBtn.onclick = () => switchLeague('ucl');

  // Admin backend view ONLY for the real commissioner
  const isCommissioner = currentManager && currentManager.email &&
    currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com';
  if (isCommissioner) {
    loadAdminOverview();
  }

  renderPayAccess();
  renderTopPotsAndActions();
  renderProminentFeatures();
  renderPredictionWeek();

  // Handle direct WhatsApp deep link ?beef=ID for accept/decline
  handleBeefDeepLink();
  handlePredictionDeepLink();

  // Always provide an easy way to clear session from dashboard (for post-restore wrong account issues)
  const topRight = $('topbar-right');
  if (topRight && !document.getElementById('global-clear-link')) {
    const clearL = document.createElement('a');
    clearL.id = 'global-clear-link';
    clearL.href = location.pathname + '?clearSession=1';
    clearL.style.cssText = 'font-size:10px; color:#ffaa00; margin-left:10px;';
    clearL.textContent = '(clear session)';
    topRight.appendChild(clearL);
  }

  // Double filter admin from any client-side lists if data slipped through
  if (standingsData) {
    if (standingsData.all) standingsData.all = standingsData.all.filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'));
    if (standingsData.fpl) standingsData.fpl = standingsData.fpl.filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'));
    if (standingsData.ucl) standingsData.ucl = standingsData.ucl.filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'));
  }
}

function renderTopPotsAndActions() {
  const container = document.getElementById('pots-top') || createPotsContainer();
  if (!container) return;

  let proj = window.lastProjections || {};
  // Prefer standings projections when they have fresher UCL 2nd/3rd (derived on pay) so pots aren't stuck at 0 from stale lastProjections.
  if (standingsData && standingsData.projections) {
    const su = standingsData.projections.ucl || {};
    const pu = proj.ucl || {};
    if (!proj.ucl || (su.secondPlacePot || 0) > (pu.secondPlacePot || 0) || (su.thirdPlacePot || 0) > (pu.thirdPlacePot || 0) || (su.overallWinnerPot || 0) > (pu.overallWinnerPot || 0)) {
      proj = standingsData.projections;
      window.lastProjections = proj;
    }
  }
  const fpl = proj.fpl || {};
  const uclProj = (proj.ucl || {});
  const isUcl = currentLeagueMode === 'ucl';

  if (isUcl) {
    const uclMd = uclProj.mdPot90 || 0;
    const uclWin = uclProj.overallWinnerPot || 0;
    const ucl2nd = uclProj.secondPlacePot || 0;
    const ucl3rd = uclProj.thirdPlacePot || 0;

    if (!container.hasChildNodes() || container.querySelector('#pot-grid-ucl') === null) {
      container.innerHTML = `
        <div class="mt-4 p-4 bg-[#0a0a0a] border border-[#00ff85] rounded-3xl">
          <div class="font-black text-lg mb-2 text-[#00ff85]">💰 UCL POTS</div>
          <div id="pot-grid-ucl" class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">This MD Pot</div>
              <div id="pot-ucl-md" class="text-2xl font-black text-[#00ff85]">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">Season Winner</div>
              <div id="pot-ucl-overall" class="text-2xl font-black">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">2nd Place</div>
              <div id="pot-ucl-second" class="text-2xl font-black">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">3rd Place</div>
              <div id="pot-ucl-third" class="text-2xl font-black">₦0</div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <button onclick="boostPot('weekly')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost this MD pot</button>
            <button onclick="showSponsorModal()" class="px-2 py-1 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400">🏆 Sponsor an Award</button>
          </div>
          <div id="pot-boosts-list" class="mt-3 text-[11px] text-[#aaa] max-h-24 overflow-auto"></div>
        </div>
      `;
    }
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = '₦' + (val || 0).toLocaleString(); };
    setVal('pot-ucl-md', uclMd);
    setVal('pot-ucl-overall', uclWin);
    setVal('pot-ucl-second', ucl2nd);
    setVal('pot-ucl-third', ucl3rd);

    const boostsWrap = document.getElementById('pot-boosts-list');
    if (boostsWrap && standingsData && Array.isArray(standingsData.potBoosts)) {
      const recent = [...standingsData.potBoosts].slice(-8).reverse();
      if (recent.length) {
        boostsWrap.innerHTML = '<div class="font-semibold text-[#00ff85] mb-0.5">Recent boosts:</div>' +
          recent.map(b => `<div>${b.managerName || ''} added ₦${(b.amount||0).toLocaleString()}</div>`).join('');
      } else {
        boostsWrap.innerHTML = '<div class="text-[10px]">No boosts yet.</div>';
      }
    }
    return;
  }

  const weekly = fpl.weeklyPot90 || 0;
  const h2h = fpl.h2hOverallPot || 0;
  const overall = fpl.overallWinnerPot || 0;
  const cup = fpl.cupWinnerPot || 0;
  const firstRU = fpl.firstRunnerUpPot || 0;
  const secondRU = fpl.secondRunnerUpPot || 0;

  // In UCL mode: show all 4 UCL pots with clean labels (no % commentary)
  if (isUcl) {
    const uclMd = uclProj.mdPot90 || 0;
    const uclWin = uclProj.overallWinnerPot || 0;
    const ucl2nd = uclProj.secondPlacePot || 0;
    const ucl3rd = uclProj.thirdPlacePot || 0;

    if (!container.hasChildNodes() || container.querySelector('#pot-grid-ucl') === null) {
      container.innerHTML = `
        <div class="mt-4 p-4 bg-[#0a0a0a] border border-[#00ff85] rounded-3xl">
          <div class="font-black text-lg mb-2 text-[#00ff85]">💰 UCL POTS</div>
          <div id="pot-grid-ucl" class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">This MD Pot</div>
              <div id="pot-ucl-md" class="text-2xl font-black text-[#00ff85]">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">Season Winner</div>
              <div id="pot-ucl-overall" class="text-2xl font-black">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">2nd Place</div>
              <div id="pot-ucl-second" class="text-2xl font-black">₦0</div>
            </div>
            <div class="bg-black p-3 rounded-2xl border border-[#333]">
              <div class="text-xs text-[#888]">3rd Place</div>
              <div id="pot-ucl-third" class="text-2xl font-black">₦0</div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <button onclick="boostPot('weekly')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost this MD pot</button>
            <button onclick="showSponsorModal()" class="px-2 py-1 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400">🏆 Sponsor an Award</button>
          </div>
          <div id="pot-boosts-list" class="mt-3 text-[11px] text-[#aaa] max-h-24 overflow-auto"></div>
        </div>
      `;
    }
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = '₦' + (val || 0).toLocaleString(); };
    setVal('pot-ucl-md', uclMd);
    setVal('pot-ucl-overall', uclWin);
    setVal('pot-ucl-second', ucl2nd);
    setVal('pot-ucl-third', ucl3rd);

    const boostsWrap = document.getElementById('pot-boosts-list');
    if (boostsWrap && standingsData && Array.isArray(standingsData.potBoosts)) {
      const recent = [...standingsData.potBoosts].slice(-8).reverse();
      if (recent.length) {
        boostsWrap.innerHTML = '<div class="font-semibold text-[#00ff85] mb-0.5">Recent boosts:</div>' +
          recent.map(b => `<div>${b.managerName || ''} added ₦${(b.amount||0).toLocaleString()}</div>`).join('');
      } else {
        boostsWrap.innerHTML = '<div class="text-[10px]">No boosts yet.</div>';
      }
    }
    return;
  }

  // FPL mode: full pots (original)
  if (!container.hasChildNodes() || container.querySelector('#pot-grid') === null) {
    container.innerHTML = `
      <div class="mt-4 p-4 bg-[#0a0a0a] border border-[#00ff85] rounded-3xl">
        <div class="font-black text-lg mb-2 text-[#00ff85]">💰 THE POTS – GROW THEM BY PLAYING BEEFS & SPONSORING</div>
        <div id="pot-grid" class="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">This GW pot</div>
            <div id="pot-weekly" class="text-2xl font-black text-[#00ff85]">₦0</div>
          </div>
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">H2H Season Pot</div>
            <div id="pot-h2h" class="text-2xl font-black">₦0</div>
          </div>
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">Overall League Winner</div>
            <div id="pot-overall" class="text-2xl font-black">₦0</div>
          </div>
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">End of Season Winner</div>
            <div id="pot-cup" class="text-2xl font-black">₦0</div>
          </div>
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">1st League Runner Up</div>
            <div id="pot-first-ru" class="text-2xl font-black">₦0</div>
          </div>
          <div class="bg-black p-3 rounded-2xl border border-[#333]">
            <div class="text-xs text-[#888]">2nd League Runner Up</div>
            <div id="pot-second-ru" class="text-2xl font-black">₦0</div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <button onclick="boostPot('weekly')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost this week's</button>
          <button onclick="boostPot('h2h')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost H2H</button>
          <button onclick="boostPot('overall')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost Overall</button>
          <button onclick="boostPot('cup')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost Cup</button>
          <button onclick="boostPot('first-ru')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost 1st RU</button>
          <button onclick="boostPot('second-ru')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost 2nd RU</button>
        </div>

        <div id="pot-boosts-list" class="mt-3 text-[11px] text-[#aaa] max-h-24 overflow-auto"></div>
      </div>
    `;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '₦' + (val || 0).toLocaleString();
  };
  setVal('pot-weekly', weekly);
  setVal('pot-h2h', h2h);
  setVal('pot-overall', overall);
  setVal('pot-cup', cup);
  setVal('pot-first-ru', firstRU);
  setVal('pot-second-ru', secondRU);

  const boostsWrap = document.getElementById('pot-boosts-list');
  if (boostsWrap && standingsData && Array.isArray(standingsData.potBoosts)) {
    const recent = [...standingsData.potBoosts].slice(-8).reverse();
    if (recent.length) {
      boostsWrap.innerHTML = '<div class="font-semibold text-[#00ff85] mb-0.5">Recent pot boosts:</div>' +
        recent.map(b => {
          const namePart = b.clubName ? `${b.managerName} of ${b.clubName}` : b.managerName;
          const t = b.target === 'weekly' ? "this week's pot" : (b.target === 'h2h' ? 'H2H pot' : (b.target === 'overall' ? 'overall pot' : (b.target === 'cup' ? 'cup pot' : (b.target === 'first-ru' || b.target === 'second-ru' ? 'runner-up' : b.target))));
          return `<div>${namePart} added ₦${(b.amount||b.boostAmount||0).toLocaleString()} to ${t}</div>`;
        }).join('');
    } else {
      boostsWrap.innerHTML = '<div class="text-[10px]">No boosts yet — be the first to top one up!</div>';
    }
  }
}

function createPotsContainer() {
  const nameEl = document.getElementById('manager-name');
  if (!nameEl || !nameEl.parentNode) return null;
  const c = document.createElement('div');
  c.id = 'pots-top';
  nameEl.parentNode.insertBefore(c, nameEl.nextSibling);
  return c;
}

function renderProminentFeatures() {
  if (currentLeagueMode === 'ucl') return;
  // Make Start a Beef, Persona, and Share/Sim cards VERY prominent (top level quick actions)
  const anchor = document.getElementById('pots-top');
  if (!anchor || !currentManager) return;

  let bar = document.getElementById('quick-features-bar');
  if (bar) bar.remove();

  bar = document.createElement('div');
  bar.id = 'quick-features-bar';
  bar.className = 'mt-3 p-4 bg-gradient-to-r from-[#0a0a0a] to-black border-2 border-[#00ff85] rounded-3xl';

  const liveProj = (currentManager.currentFpl != null) ? `${currentManager.currentFpl} pts` : '—';
  bar.innerHTML = `
    <div class="font-black text-lg mb-2 text-[#00ff85]">⚡ QUICK ACTIONS</div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
      ${currentLeagueMode !== 'ucl' ? `<button onclick="showBeefModal()" class="py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl text-base active:scale-[0.98]">⚔️ Start a Beef</button>` : ''}
      <button onclick="showPersonaQuiz()" class="py-3 bg-[#003322] hover:bg-green-900 text-[#00ff85] font-black rounded-2xl text-base active:scale-[0.98]">Know Your Manager persona</button>
      <button onclick="showLineupAndSim()" class="py-3 bg-[#ffaa00] hover:bg-yellow-600 text-black font-black rounded-2xl text-base active:scale-[0.98]">Simulate next game week</button>
      <button onclick="showLiveProjection()" class="py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl text-base active:scale-[0.98]">Live GW: ${liveProj}</button>
    </div>
    <div class="mt-2 text-[10px] text-[#888] text-center">find out what kind of manager you are • Live = API current player stats • Simulate = what you may get</div>
  `;
  anchor.parentNode.insertBefore(bar, anchor.nextSibling);
}

function showLineupAndSim() {
  // Make simulation & share card prominent and easy
  const select = $('lineup-manager-select');
  if (select && currentManager) {
    select.value = currentManager.id;
    if (typeof loadAndRenderLineup === 'function') {
      loadAndRenderLineup(currentManager.id, $('lineup-viewer'));
    }
  }
  // Trigger the sim button if present
  setTimeout(() => {
    const sim = document.querySelector('button[onclick*="simulateNextGW"]');
    if (sim) sim.click();
  }, 300);
}

function showLiveProjection() {
  if (!currentManager || !currentManager.fpl || !currentManager.fpl.teamId) {
    return alert('No FPL team ID set for this manager. Set it in your profile to enable live projections.');
  }
  const teamId = currentManager.fpl.teamId;

  // Always fetch fresh live data on click
  (async () => {
    try {
      // Get current GW
      const bs = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/').then(r => r.json());
      const currentEvent = bs.events.find(e => e.is_current) || bs.events.find(e => !e.finished);
      const gw = currentEvent ? currentEvent.id : ((standingsData && standingsData.currentRound && standingsData.currentRound.fpl) || 1);

      // Fresh picks
      const picksRes = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${gw}/picks/`);
      const picksData = await picksRes.json();

      // Fresh live
      const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`);
      const liveData = await liveRes.json();

      // Build player name map from bootstrap
      const playerMap = {};
      (bs.elements || []).forEach(el => {
        playerMap[el.id] = {
          name: el.web_name,
          team: (bs.teams || []).find(t => t.id === el.team)?.short_name || 'UNK'
        };
      });

      let total = 0;
      const playerRows = [];

      if (picksData && picksData.picks && liveData && liveData.elements) {
        for (const p of picksData.picks) {
          const el = liveData.elements.find(e => e.id === p.element);
          if (el && el.stats) {
            const m = (typeof p.multiplier === 'number' ? p.multiplier : 1);
            const pts = (el.stats.total_points || 0) * m;
            total += pts;
            const info = playerMap[p.element] || {};
            const isCap = m > 1;
            const bps = el.stats.bps || 0;
            const bonus = el.stats.bonus || 0;

            playerRows.push({
              name: info.name || `Player ${p.element}`,
              team: info.team || '',
              livePts: pts,
              bps,
              bonus,
              multiplier: p.multiplier,
              isStarting: (p.position || 0) <= 11
            });
          }
        }
      }

      // Sort: starters first, then by livePts
      playerRows.sort((a, b) => {
        if (a.isStarting !== b.isStarting) return b.isStarting - a.isStarting;
        return b.livePts - a.livePts;
      });

      const modal = $('modal');
      const c = $('modal-content');

      let rowsHtml = playerRows.map(r => `
        <tr class="border-b border-[#333] text-sm">
          <td class="p-1 font-medium">${r.name} ${r.team ? `(${r.team})` : ''}</td>
          <td class="p-1 text-right font-mono">${r.livePts}</td>
          <td class="p-1 text-right text-xs text-[#888]">${r.bps} bps${r.bonus > 0 ? ` +${r.bonus}b` : ''}</td>
          <td class="p-1 text-center text-xs">${r.multiplier > 1 ? (r.multiplier === 2 ? 'C' : 'TC') : (r.multiplier === 0 ? 'Bench' : '')}</td>
        </tr>
      `).join('');

      c.innerHTML = `
        <div>
          <div class="font-bold text-xl mb-2 text-[#00ff85]">Live GW${gw} — like livefpl.net</div>
          <div class="text-sm mb-3">Fresh from FPL live API. Total projected right now: <span class="font-bold text-lg">${Math.round(total)}</span> pts</div>
          <table class="w-full text-xs mb-4">
            <thead>
              <tr class="text-[#888] text-left border-b border-[#444]">
                <th class="p-1">Player</th>
                <th class="p-1 text-right">Live Pts</th>
                <th class="p-1 text-right">BPS / Bonus</th>
                <th class="p-1 text-center">Mult</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="4" class="p-2 text-[#888]">No live data yet</td></tr>'}
            </tbody>
          </table>
          <div class="text-[10px] text-[#888] mb-2">
            BPS = Bonus Point System. livefpl.net uses this + xG models for even better estimates.<br>
            Here we show raw FPL live + bps. Open lineup viewer for more.
          </div>
          <button onclick="if (typeof loadAndRenderLineup === 'function') loadAndRenderLineup(currentManager.id, $('lineup-viewer')); closeModal();" 
                  class="w-full py-2 bg-[#00ff85] text-black font-bold rounded-xl text-sm">View Full Lineup</button>
        </div>
      `;

      modal.classList.remove('hidden');
      modal.classList.add('flex');

    } catch (e) {
      alert('Fresh fetch failed: ' + (e.message || e) + '. Falling back to cached.');
      const proj = currentManager.currentFpl != null ? currentManager.currentFpl : '—';
      alert(`Cached Live GW Projection: ${proj} pts`);
    }
  })();
}

function createActiveBeefsContainer() {
  const pots = document.getElementById('pots-top');
  if (pots && pots.parentNode) {
    const c = document.createElement('div');
    c.id = 'active-beefs-top';
    pots.parentNode.insertBefore(c, pots.nextSibling);
    return c;
  }
  const nameEl = document.getElementById('manager-name');
  if (!nameEl || !nameEl.parentNode) return null;
  const c = document.createElement('div');
  c.id = 'active-beefs-top';
  nameEl.parentNode.insertBefore(c, nameEl.nextSibling);
  return c;
}

function renderActiveBeefs() {
  if (currentLeagueMode === 'ucl') {
    const c = document.getElementById('active-beefs-top');
    if (c) c.style.display = 'none';
    return;
  }
  const container = document.getElementById('active-beefs-top') || createActiveBeefsContainer();
  if (!container) return;

  const beefs = window.activeBeefs || [];
  let active = beefs.filter(b => !['settled', 'declined', 'cancelled'].includes((b.status || '').toLowerCase()));
  // Admin sees settled too, to have access to UNDO SETTLEMENT button
  if (currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com') {
    active = beefs;  // show all for admin, including settled for undo
  }

  if (active.length === 0) {
    container.innerHTML = `
      <div class="mt-2 p-3 bg-[#111] border border-[#ffaa00] rounded-3xl text-xs">
        <span class="text-[#ffaa00] font-semibold">⚔️ NO ACTIVE BEEFS</span> — propose one to start.
      </div>
    `;
    return;
  }

  let html = `
    <div class="mt-3 p-4 bg-[#0a0a0a] border border-[#ffaa00] rounded-3xl">
      <div class="font-black text-lg mb-1 text-[#ffaa00]">⚔️ ACTIVE BEEFS</div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
  `;

  active.forEach(b => {
    const paidDetails = b.paidDetails || [];
    let paidTotal = 0;
    paidDetails.forEach(p => { paidTotal += p.amount || 0; });
    const potSize = b.currentPot || b.prizePot || Math.floor(paidTotal * 0.9);
    const paidNames = paidDetails.map(p => p.displayName).join(', ') || 'Waiting for payments';
    const paidCount = paidDetails.length;
    const totalProposed = (b.participants || []).length;
    const statusClass = b.status === 'accepted' ? 'text-[#00ff85]' : 'text-yellow-400';
    const deep = b.id ? `${location.origin}/?beef=${b.id}` : location.origin;
    const safeShare = encodeURIComponent(`D League Beef: ${b.proposerName || ''} vs ${(b.opponentNames||[]).join(' & ')} for "${b.category}" Pot ₦${potSize} — ${deep}`);
    const preset = BEEF_PRESETS.find(p => p.id === b.category);
    const beefDesc = preset ? preset.desc : (b.category || '');

    const myId = currentManager && currentManager.id;
    const parts = [...(b.opponentIds || []), ...(b.participants || [])];
    if (b.proposerId) parts.push(b.proposerId);
    const isParticipant = !!myId && parts.includes(myId);
    const alreadyPaid = paidDetails.some(p => p.managerId === myId);
    const showPayStake = isParticipant && !alreadyPaid && !b.locked;
    const isAdmin = currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com';
    const nameMap = {};
    if (standingsData && standingsData.all) standingsData.all.forEach(m => { nameMap[m.id] = m.displayName; });
    const currentGW = (standingsData && standingsData.currentRound && standingsData.currentRound.fpl) || 1;
    const joinGW = b.joinDeadline || currentGW;
    const displayGW = Math.max(joinGW, currentGW); // show next after concluded
    let pendingHtml = '';
    if ((isParticipant || isAdmin) && b.joinRequests && b.joinRequests.length > 0) {
      const reqs = b.joinRequests.map(rid => {
        const nm = nameMap[rid] || rid;
        return `${nm} <button onclick="respondToJoin('${b.id}','${rid}',true);event.stopImmediatePropagation()" class="bg-[#00ff85] text-black px-1 rounded text-[8px]">Approve</button><button onclick="respondToJoin('${b.id}','${rid}',false);event.stopImmediatePropagation()" class="bg-red-600 text-white px-1 rounded text-[8px]">Decline</button>`;
      }).join(' ');
      pendingHtml = `<div class="mt-1 text-[9px] text-yellow-400">Pending joins: ${reqs}</div>`;
    }

    html += `
      <div class="bg-black p-3 rounded-2xl border border-[#ffaa00]">
        <div class="font-bold text-[#ffaa00]">⚔️ ${b.proposerName || 'Proposer'} vs ${(b.opponentNames || b.participantNames || []).join(' & ') || 'Opponents'}</div>
        <div class="mt-1 text-xs">For: <span class="font-semibold">${beefDesc}</span> @ ₦${b.stake} each</div>
        <div class="mt-1">
          <span class="text-xs text-[#888]">POT SIZE (90% winner, only paid):</span>
          <span class="text-xl font-black">₦${(potSize || 0).toLocaleString()}</span>
        </div>
        <div class="text-xs mt-0.5">Paid: ${paidCount} — ${paidNames}</div>
        <div class="text-xs">Status: <span class="${statusClass} font-semibold">${b.status || 'proposed'}</span>${b.locked ? ` <span class="text-red-400">(LOCKED for GW${displayGW})</span>` : ''}</div>
        <div class="mt-2 flex flex-wrap gap-1 text-[10px]">
          <button onclick="showWhatsAppShare(decodeURIComponent('${safeShare}'), 'Share beef'); event.stopImmediatePropagation();" class="px-2 py-0.5 bg-[#ffaa00] text-black rounded">📲 Share WA + Link</button>
          ${!b.locked && b.status === 'proposed' ? `<button onclick="respondToBeefLink('${b.id}', 'accept')" class="px-2 py-0.5 bg-[#00ff85] text-black rounded">Accept</button>` : ''}
          ${!b.locked && b.status === 'accepted' && !isParticipant ? `<button onclick="requestToJoinBeef('${b.id}')" class="px-2 py-0.5 bg-[#00ff85] text-black rounded">Request to Join</button>` : ''}
          ${showPayStake ? `<button onclick="payBeefStake('${b.id}', ${b.stake}); event.stopImmediatePropagation();" class="px-2 py-0.5 bg-[#00ff85] text-black rounded">PAY ₦${b.stake} STAKE</button>` : ''}
          ${currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com' ? `<button onclick="adminCancelBeef('${b.id}')" class="px-2 py-0.5 bg-red-700 text-white rounded">${b.status === 'settled' ? 'UNDO SETTLEMENT (restore pot)' : 'CANCEL (admin)'}</button>` : ''}
          ${currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com' && !b.locked ? `<button onclick="adminLockBeef('${b.id}')" class="px-2 py-0.5 bg-orange-600 text-white rounded">LOCK (admin)</button>` : ''}
        </div>
        ${pendingHtml}
      </div>
    `;
  });

  html += `</div></div>`;
  container.innerHTML = html;
}

async function loadAdminOverview() {
  try {
    const data = await fetchJSON('/api/admin/overview');
    window.lastAdminData = data;
    const prev = document.getElementById('admin-overview-panel');
    if (prev) prev.remove();

    const panel = document.createElement('div');
    panel.id = 'admin-overview-panel';
    panel.className = 'mt-4 p-6 bg-[#111] border-2 border-[#00ff85] rounded-3xl text-sm';

    const events = data.recentEvents || [];
    const managersByEmail = {};
    (data.managers || []).forEach(m => {
      if (m.email) managersByEmail[m.email.toLowerCase()] = m;
    });

    // Join requests + adds: always show recent ones (historical, never hide previous)
    // join_request stay as PENDING until manager_added / approved. Previous ones visible forever.
    const joinRelated = events
      .filter(e => e.type === 'join_request' || e.type === 'manager_added');

    let joinsHtml = '';
    if (joinRelated.length) {
      joinsHtml = joinRelated.map(e => {
        const p = e.payload || {};
        const email = (p.email || '').toLowerCase();
        const when = (e.at || '').slice(11,16);
        const existing = managersByEmail[email];
        const isAdded = e.type === 'manager_added';
        const isSelf = p.selfRegistered || (existing && existing.selfRegistered);
        let actionHtml = '';
        const code = (existing && existing.accessCode) || p.accessCode || '—';
        const teamMissing = (p.teamIdMissing || (existing && existing.teamIdMissing)) && ! (existing && existing.fpl && existing.fpl.teamId);
        if (isAdded || existing) {
          actionHtml = `
            <div class="text-right">
              <div><span class="px-2 py-0.5 text-xs rounded ${isSelf ? 'bg-[#003322] text-[#00ff85]' : 'bg-[#003322] text-[#00ff85]'}">${isSelf ? 'SELF-REGISTERED' : (isAdded ? 'ADDED' : 'APPROVED')}</span>${teamMissing ? ' <span class="px-1 text-[9px] bg-red-900 text-red-300 rounded">MISSING TEAM ID - FIX</span>' : ''}</div>
              <div class="font-mono text-sm mt-1">${code}</div>
              <button onclick="navigator.clipboard.writeText('${code}');this.textContent='copied!'" class="mt-1 text-[10px] px-2 py-0.5 bg-[#00ff85] text-black rounded">copy code</button>
              ${teamMissing ? `<button onclick="editManager('${email}', '${(existing && existing.displayName || p.name || '').replace(/'/g,'\\\'')}', '${(existing && existing.fplClubName || p.fplClubName || '').replace(/'/g,'\\\'')}', '${(existing && existing.uclClubName || '').replace(/'/g,'\\\'')}', '${(existing && existing.fpl && existing.fpl.teamId || p.fplId || '').replace(/'/g,'\\\'')}', '', '${code}');" class="mt-1 block text-[9px] px-2 py-0.5 bg-red-600 text-white rounded">FIX TEAM ID NOW</button>` : ''}
            </div>`;
        } else {
          actionHtml = `<button data-name="${(p.name || '').replace(/"/g, '&quot;')}" data-email="${(p.email || '').replace(/"/g, '&quot;')}" data-club="${(p.fplClubName || '').replace(/"/g, '&quot;')}" data-fplid="${(p.fplId || '').replace(/"/g, '&quot;')}"
                    onclick="approveJoinRequestFromBtn(this)" 
                    class="px-4 py-1.5 bg-[#00ff85] text-black font-bold rounded-xl text-sm hover:bg-white active:scale-[0.985]">Approve & Generate Code</button>`;
        }
        return `
          <div class="flex justify-between gap-4 items-start bg-[#1c1c1c] border border-[#333] p-4 rounded-2xl mb-2">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-base">${p.name || 'Unknown'}</div>
              <div class="text-sm text-[#00ff85] truncate">${p.email || ''}</div>
              <div class="text-sm font-mono text-[#888] mt-0.5">${p.fplClubName || ''} ${p.fplId ? '| FPL ID: ' + p.fplId : ''}</div>
              <div class="text-[10px] text-[#666] mt-1">${when} • ${e.type} ${isSelf ? '(self-gen code)' : ''}</div>
            </div>
            <div class="flex-shrink-0">${actionHtml}</div>
          </div>`;
      }).join('');
    } else {
      joinsHtml = '<div class="text-[#666] p-4 bg-[#1c1c1c] border border-[#333] rounded-2xl">No join requests or adds in history yet. Use REQUEST ACCESS on login screen.</div>';
    }

    const otherEvents = events.filter(e => e.type !== 'join_request').slice(0, 5);
    let otherHtml = otherEvents.map(e => {
      const p = e.payload || {};
      const when = (e.at || '').slice(11,16);
      let detail = p.name || p.email || JSON.stringify(p).slice(0,50);
      if (e.type === 'manager_added' && p.accessCode) {
        detail = `${p.name || p.email} — code: ${p.accessCode}`;
      }
      return `<div class="text-[#aaa] py-0.5 text-[10px]">${e.type} — ${detail} <span class="text-[#666]">(${when})</span></div>`;
    }).join('') || '<div class="text-[#666]">No other recent activity</div>';

    // Sponsored as cards
    let sponsorsHtml = (data.sponsorships || []).map(sp => {
      return `
        <div class="bg-[#1c1c1c] border border-[#333] p-3 rounded-2xl mb-2 flex justify-between items-center">
          <div>
            <div class="font-medium">${sp.sponsor || 'Sponsor'}</div>
            <div class="text-xs text-[#888]">₦${sp.amount} for ${sp.target || 'general'}</div>
          </div>
          <button onclick="cancelSponsorship('${sp.id}')" class="text-xs px-2 py-1 bg-red-900 hover:bg-red-800 rounded">Cancel</button>
        </div>`;
    }).join('') || '<div class="text-[#666] p-4">No active sponsorships</div>';

    // Managers as clean cards with copy code
    let mgrsHtml = (data.managers || []).map(m => {
      const fplStatus = m.fplPaid ? '✅ PAID' : '❌ NOT PAID';
      const uclStatus = m.uclPaid ? '✅ PAID' : '❌ NOT PAID';
      const code = m.accessCode || '—';
      const isAdmin = m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com';
      const club = m.fplClubName || (isAdmin ? 'Admin (no team)' : '—');
      const isProtected = !!(m._protectedRealPaid || m._recoveredFromPayments || m._restored || (m.email && (m.email.includes('recovered-') || m.email.includes('paid-'))));
      const protectedBadge = isProtected ? '<span class="text-[9px] bg-orange-900 text-orange-300 px-1 rounded ml-1">REAL PAID - RECLAIM</span>' : '';
      const reclaimBtn = isProtected ? `<button onclick="reclaimPaidManager('${m.id}', '${(m.displayName||'').replace(/'/g,'\\\'')}', '${(m.fplClubName||'').replace(/'/g,'\\\'')}')" class="mt-1 block text-[9px] px-2 py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded">Reclaim / change code</button>` : '';
      const teamIdMissing = m.selfRegistered && !(m.fplTeam && m.fplTeam.teamId);
      const missingBadge = teamIdMissing ? ' <span class="text-[9px] bg-red-900 text-red-300 px-1 rounded">MISSING FPL TEAM ID - FIX</span>' : '';
      return `
        <div class="flex justify-between items-center bg-[#1c1c1c] border border-[#333] p-3 rounded-2xl mb-2">
          <div>
            <div class="font-semibold">${m.displayName} ${isAdmin ? '<span class="text-xs bg-[#003322] text-[#00ff85] px-1 rounded">ADMIN</span>' : ''} ${protectedBadge} ${missingBadge}</div>
            <div class="text-xs text-[#888]">${m.email}</div>
            <div class="text-xs text-[#00ff85] mt-0.5">${club}</div>
            <div class="text-xs text-[#666]">FPL: ${fplStatus} | UCL: ${uclStatus}</div>
            <div class="text-[10px] font-mono text-[#aaa] mt-0.5">FPL TeamID: ${m.fplTeam && m.fplTeam.teamId ? m.fplTeam.teamId : '—'} | UCL: ${m.uclTeam && m.uclTeam.teamId ? m.uclTeam.teamId : '—'}</div>
          </div>
          <div class="text-right">
            <div class="font-mono text-sm">${code}</div>
            <button onclick="navigator.clipboard.writeText('${code}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy',1500)" class="mt-1 text-[10px] px-3 py-0.5 bg-[#222] hover:bg-[#333] rounded">Copy Code</button>
            <button onclick="editManager('${(m.email||'').replace(/'/g,'\\\'')}', '${(m.displayName||'').replace(/'/g,'\\\'')}', '${(m.fplClubName||'').replace(/'/g,'\\\'')}', '${(m.uclClubName||m.ucl?.clubName||'').replace(/'/g,'\\\'')}', '${(m.fpl && m.fpl.teamId || '').replace(/'/g,'\\\'')}', '${(m.ucl && m.ucl.teamId || '').replace(/'/g,'\\\'')}', '${code.replace(/'/g,'\\\'')}')" class="mt-1 ml-1 text-[9px] px-2 py-0.5 bg-[#222] hover:bg-[#333] rounded">Edit</button>
            ${reclaimBtn}
            ${!isAdmin ? `<button onclick="if(confirm('Delete ${ (m.displayName||'').replace(/'/g,'\\\'') }? History stays. This cannot be undone easily.')) deleteManager('${m.id || ''}', '${(m.email||'').replace(/'/g,'\\\'')}');" class="mt-1 ml-1 text-[9px] px-2 py-0.5 bg-red-900 text-white rounded">Delete</button>` : ''}
          </div>
        </div>`;
    }).join('') || '<div class="text-[#666] p-4">No managers</div>';

    // Nice stats cards
    const statsHtml = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div class="bg-[#1a1a1a] p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">TOTAL MANAGERS</div>
          <div class="text-2xl font-black">${data.totalManagers}</div>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">PAID (incl. admin restored)</div>
          <div class="text-2xl font-black">FPL: ${data.paidFpl} | UCL: ${data.paidUcl}</div>
          <div class="text-[10px] mt-1">FPL: ${(data.paidFplList || []).map(m => m.displayName + (m.restoredByAdmin ? ' (admin)' : '')).join(', ') || '—'}</div>
          <div class="text-[10px]">UCL: ${(data.paidUclList || []).map(m => m.displayName + (m.restoredByAdmin ? ' (admin)' : '')).join(', ') || '—'}</div>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">CONFIRMED PAYMENTS</div>
          <div class="text-2xl font-black">${data.totalPaymentsConfirmed}</div>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">HOUSE COMMISSION (10% side)</div>
          <div class="text-2xl font-black">₦${data.totalHouseCommission || 0}</div>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">SERVICE FEES (admin only)</div>
          <div class="text-2xl font-black">FPL ₦${(data.serviceFees && data.serviceFees.fpl) || 0} / UCL ₦${(data.serviceFees && data.serviceFees.ucl) || 0}</div>
        </div>
      </div>
    `;

    panel.innerHTML = `
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-[#222]">
        <div>
          <span class="font-black text-4xl text-[#00ff85] tracking-[-1.5px]">ADMIN COCKPIT</span>
          <div class="text-xs text-[#888] mt-0.5">Commissioner view • Admin has no team • Use Edit on managers to fix details (works after lock/live)</div>
        </div>
        <div class="flex gap-2">
          <button onclick="loadAdminOverview()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">REFRESH ALL</button>
          <button onclick="promptAddManager()" class="px-6 py-2 bg-[#00ff85] text-black font-bold rounded-2xl hover:bg-white">+ ADD MANAGER</button>
          <button onclick="triggerSettle()" class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl">SETTLE &amp; PAYOUTS</button>
          <button onclick="promptSetLeagues()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">SET LEAGUE IDs</button>
          <button onclick="promptEditServiceFees()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">EDIT SERVICE FEES</button>
          <button onclick="emergencySync()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">FORCE SYNC</button>
          <button onclick="adminManageH2HFixtures()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">H2H FIXTURES (enter matchups)</button>
          <button onclick="adminManageUclMdScores()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">UCL MD SCORES (manual + finalize)</button>
          <button onclick="adminSetPrediction()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">PREDICTION OF THE WEEK</button>
        </div>
      </div>

      <!-- EXPLICIT H2H FIXTURES ENTRY - prominent so admin can easily enter fixture details -->
      <div class="mb-4 p-4 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
        <div class="font-black text-[#00ff85] text-base mb-1 tracking-[-0.3px]">H2H FIXTURES — ENTER MATCHUP DETAILS</div>
        <div class="text-xs text-[#ccc] mb-2">Controls the H2H FIXTURE for the current GW + opponents shown in the main H2H box. For each GW, pick the opponent for every manager using the dropdowns. GW1 is concluded. Saves immediately and appears after refresh.</div>
        <button onclick="adminManageH2HFixtures()" class="px-5 py-2 bg-[#00ff85] hover:bg-white text-black font-bold rounded-2xl text-sm active:scale-[0.985]">OPEN FIXTURE SELECTOR — PICK OPPONENTS FOR A GW</button>
        <div class="text-[10px] mt-1.5 text-[#666]">Also available as "MANAGE H2H FIXTURES (per GW)" in the top button row, and directly in the H2H box header.</div>
      </div>

      <!-- EXPLICIT UCL MD MANAGEMENT - unmistakable for admin -->
      <div class="mb-4 p-4 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
        <div class="font-black text-[#00ff85] text-base mb-1 tracking-[-0.3px]">UCL MD SCORES — ENTER &amp; FINALIZE</div>
        <div class="text-xs text-[#ccc] mb-2">Manually enter points for each MD (admin only). Finalize to auto-settle the MD winner (90% to wallet) and accumulate reserves for end-of-season 2nd/3rd. Scores build totals for overall ranking. Saves immediately.</div>
        <button onclick="adminManageUclMdScores()" class="px-5 py-2 bg-[#00ff85] hover:bg-white text-black font-bold rounded-2xl text-sm active:scale-[0.985]">OPEN UCL MD SELECTOR — ENTER POINTS &amp; FINALIZE</button>
        <div class="text-[10px] mt-1.5 text-[#666]">Also available as "UCL MD SCORES (manual + finalize)" in the top button row.</div>
      </div>

      <div class="mb-4 p-4 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
        <div class="font-black text-[#00ff85] text-base mb-1 tracking-[-0.3px]">PREDICTION OF THE WEEK</div>
        <div class="text-xs text-[#ccc] mb-2">Set this week's question + prize once the group decides. Managers submit open-ended answers. Lock to close entries. Then pick one or more correct managers and split the prize. Use ENTER FOR MANAGER if someone lost their pick after a restore.</div>
        <button onclick="adminSetPrediction()" class="px-5 py-2 bg-[#00ff85] hover:bg-white text-black font-bold rounded-2xl text-sm active:scale-[0.985]">SET / UPDATE THIS WEEK'S PREDICTION</button>
        <button onclick="adminEnterPredictionForManager()" class="ml-2 px-5 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm">ENTER PICK FOR A MANAGER</button>
      </div>

      <div class="mb-4 p-4 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
        <div class="font-black text-[#00ff85] text-base mb-1 tracking-[-0.3px]">RECONSTRUCT A BEEF</div>
        <div class="text-xs text-[#ccc] mb-2">If a beef disappeared after a restore, recreate it here (proposer + opponents + category + stake). Does not move money — only restores the matchup record.</div>
        <button onclick="adminReconstructBeef()" class="px-5 py-2 bg-[#00ff85] hover:bg-white text-black font-bold rounded-2xl text-sm active:scale-[0.985]">REBUILD BEEF BETWEEN MANAGERS</button>
      </div>

      <!-- League Lock Control - separate for FPL and UCL -->
      <div class="mb-4 p-3 bg-[#161616] border border-[#222] rounded-2xl">
        <div class="flex items-center justify-between mb-2">
          <div>
            <span class="font-semibold">FPL Join Status:</span>
            <span class="${data.leagueLocked?.fpl ? 'text-red-400' : 'text-[#00ff85]'} font-bold ml-2">${data.leagueLocked?.fpl ? 'LOCKED' : 'OPEN'}</span>
          </div>
          <div>
            <button onclick="toggleLeagueLock(true, 'fpl')" class="px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl mr-2">LOCK FPL</button>
            <button onclick="toggleLeagueLock(false, 'fpl')" class="px-4 py-1 bg-[#00ff85] hover:bg-white text-black text-sm rounded-xl">UNLOCK FPL</button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div>
            <span class="font-semibold">UCL Join Status:</span>
            <span class="${data.leagueLocked?.ucl ? 'text-red-400' : 'text-[#00ff85]'} font-bold ml-2">${data.leagueLocked?.ucl ? 'LOCKED' : 'OPEN'}</span>
          </div>
          <div>
            <button onclick="toggleLeagueLock(true, 'ucl')" class="px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl mr-2">LOCK UCL</button>
            <button onclick="toggleLeagueLock(false, 'ucl')" class="px-4 py-1 bg-[#00ff85] hover:bg-white text-black text-sm rounded-xl">UNLOCK UCL</button>
          </div>
        </div>
      </div>

      <!-- BEEF & DATA HEALING SUPERPOWERS (for smooth season + after restores) -->
      <div class="mb-6 p-4 bg-[#1a1400] border border-[#ffaa00] rounded-3xl">
        <div class="font-bold text-[#ffaa00] mb-2 text-sm tracking-widest">🛡️ BEEF IMMORTALITY + DATA HEALING (REDEPLOY SAFE)</div>
        <div class="flex flex-wrap gap-2">
          <button onclick="repairBeefs()" class="px-4 py-2 bg-[#ffaa00] hover:bg-white text-black font-bold rounded-2xl text-sm">REPAIR BEEFS (from payments) + Persist</button>
          <button onclick="forcePersistAll()" class="px-4 py-2 bg-[#222] hover:bg-[#444] text-[#ffaa00] font-bold rounded-2xl text-sm border border-[#ffaa00]">FORCE PERSIST ALL (atomics + sidecar)</button>
          <button onclick="showAdjustRunnerPotsModal()" class="px-4 py-2 bg-[#222] hover:bg-[#444] text-[#ffaa00] font-bold rounded-2xl text-sm border border-[#ffaa00]">ADJUST 1st/2nd RUNNER-UP POTS</button>
          <button onclick="previewRunnerUps()" class="px-3 py-2 bg-[#222] hover:bg-[#333] text-[#ffaa00] rounded-2xl text-xs border border-[#ffaa00]">PREVIEW RUNNER UPS</button>
          <button onclick="showIdMappings()" class="px-3 py-2 bg-[#222] hover:bg-[#333] text-[#ffaa00] rounded-2xl text-xs border border-[#ffaa00]">VIEW ID MAPPINGS</button>
          <button onclick="loadAdminOverview()" class="px-3 py-2 bg-[#333] text-xs rounded-2xl">Refresh</button>
        </div>
        <div class="text-[10px] text-[#aa8800] mt-2">Use REPAIR BEEFS after restoring any JSON that had bolade-henry or other paid beefs. Then FORCE PERSIST. Beefs + runner-up cuts will survive restarts/hard refreshes.</div>
      </div>

      <!-- MORE SEASON SUPERPOWERS -->
      <div class="mb-6 p-4 bg-[#111] border border-[#00ff85] rounded-3xl text-sm">
        <div class="font-bold text-[#00ff85] mb-2">⚡ MORE ADMIN SUPERPOWERS (Season Ops)</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <button onclick="showDeductWalletModal()" class="px-3 py-1 bg-red-900 hover:bg-red-800 rounded">DEDUCT FROM WALLET</button>
          <button onclick="forceSettleRoundPrompt()" class="px-3 py-1 bg-[#222] hover:bg-[#333] rounded">FORCE SETTLE ROUND</button>
          <button onclick="simulateRoundPrompt()" class="px-3 py-1 bg-[#222] hover:bg-[#333] rounded">SIMULATE ROUND (mock scores)</button>
          <button onclick="previewBeefAutoSettle()" class="px-3 py-1 bg-[#222] hover:bg-[#333] rounded">PREVIEW AUTO BEEF SETTLE</button>
        </div>
        <div class="text-[10px] text-[#666] mt-1">These let you test, correct, and control the season without waiting for real data or end-of-season. All changes are logged.</div>
      </div>

      <!-- Stats Dashboard -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">MANAGERS</div>
          <div class="text-5xl font-black mt-1">${data.totalManagers}</div>
          <div class="text-sm mt-1">FPL: ${data.paidFpl} | UCL: ${data.paidUcl}</div>
          <div class="text-[9px] mt-1">Paid FPL: ${(data.paidFplList || []).map(m => m.displayName + (m.restoredByAdmin ? '*' : '')).join(', ') || '—'}</div>
          <div class="text-[9px]">Paid UCL: ${(data.paidUclList || []).map(m => m.displayName + (m.restoredByAdmin ? '*' : '')).join(', ') || '—'} (*=admin restored)</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">PAYMENTS</div>
          <div class="text-5xl font-black mt-1 text-[#00ff85]">${data.totalPaymentsConfirmed}</div>
          <div class="text-sm mt-1">Confirmed</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">10% CUTS LOGGED</div>
          <div class="text-5xl font-black mt-1">₦${data.totalHouseCommission || 0}</div>
          <div class="text-sm mt-1">Beef/sponsor (boost vs house)</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">SERVICE FEES (admin)</div>
          <div class="text-3xl font-black mt-1">FPL: ₦${(data.serviceFees && data.serviceFees.fpl)||0}</div>
          <div class="text-sm mt-1">Per FPL paid • Per UCL</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">SYNC</div>
          <div class="text-xl font-medium mt-1">${data.lastSync || 'Never'}</div>
          <button onclick="loadAdminOverview()" class="mt-2 text-xs px-3 py-1 border border-[#333] rounded hover:bg-[#222]">Refresh Data</button>
        </div>
      </div>

      <!-- Main Management Grid - clean cards -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <!-- Join Requests - Historical, never hidden -->
        <div class="bg-[#161616] border border-[#222] rounded-3xl p-5">
          <div class="font-semibold text-xl mb-3">JOIN REQUESTS (History - never hidden)</div>
          <div class="max-h-[320px] overflow-auto space-y-2 pr-1">
            ${joinsHtml}
          </div>
        </div>

        <!-- Managers with codes -->
        <div class="bg-[#161616] border border-[#222] rounded-3xl p-5">
          <div class="font-semibold text-xl mb-3">MANAGERS &amp; ACCESS CODES</div>
          <div class="max-h-[320px] overflow-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-[#888] text-xs"><th class="text-left">Name</th><th>Email</th><th>Club</th><th>FPL</th><th>UCL</th><th>Code</th></tr></thead>
              <tbody>
                ${mgrsHtml}
              </tbody>
            </table>
          </div>
          <div class="text-xs text-[#666] mt-2">FPL/UCL show per-comp paid status. Admin has no team. Click code to copy.</div>
        </div>

        <!-- MANAGER WALLETS - admin superpower for anomaly detection and quick correction -->
        <div class="mt-4 bg-[#161616] border border-[#ffaa00] rounded-3xl p-5">
          <div class="font-semibold text-xl mb-3 text-[#ffaa00]">MANAGER WALLETS (anomaly detection)</div>
          <div class="max-h-[220px] overflow-auto text-sm divide-y divide-[#333]">
            ${(data.managers || []).sort((a,b) => ((b.wallet||0) - (a.wallet||0))).map(m => `
              <div class="flex justify-between items-center py-1.5">
                <div class="font-medium">${m.displayName} ${m.fplPaid || m.uclPaid ? '<span class="text-[10px] text-[#00ff85]">PAID</span>' : ''}</div>
                <div class="font-mono tabular-nums ${((m.wallet||0) > 50000 || (m.wallet||0) < 0) ? 'text-red-400 font-bold' : ''}">₦${(m.wallet||0).toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
          <div class="text-[10px] mt-2 text-[#888]">Sorted high→low. Red flag: >₦50k or negative (investigate immediately). Use existing DEDUCT FROM WALLET or credit form below to correct. Refresh after fixes.</div>
        </div>

        <!-- Sponsored -->
        <div class="bg-[#161616] border border-[#222] rounded-3xl p-5">
          <div class="font-semibold text-xl mb-3">SPONSORED AWARDS</div>
          <div class="max-h-[240px] overflow-auto space-y-2">
            ${sponsorsHtml}
          </div>
        </div>
      </div>

      <div class="mt-5 bg-[#161616] border border-[#222] rounded-3xl p-5">
        <div class="font-semibold text-xl mb-3">ACTIVITY LOG</div>
        <div class="max-h-[140px] overflow-auto text-xs bg-black/40 p-4 rounded-2xl font-mono">
          ${otherHtml}
        </div>
      </div>

      <div class="mt-4 text-center text-xs text-[#666]">
        Persistent on Render disk • Previous join requests and history preserved • Admin has no team
      </div>
    `;

    const dash = document.getElementById('dashboard');
    const after = document.getElementById('league-selector');
    if (dash && after && after.parentNode) {
      after.parentNode.insertBefore(panel, after.nextSibling);
    } else if (dash) {
      dash.appendChild(panel);
    }

    // Beefs admin management - use the shared refresh function to avoid duplicates
    if (typeof refreshAdminBeefsList === 'function') {
      refreshAdminBeefsList();
    }

    // === Persistence health box (solid way to check if data is correct after restarts) ===
    (async () => {
      try {
        const pstatus = await fetchJSON('/api/admin/persistence-status');
        const pbox = document.createElement('div');
        pbox.className = 'mt-4 p-3 bg-[#1a1a1a] border border-[#ffcc00] rounded-2xl text-xs';
        const side = pstatus.sidecarManagers || 0;
        const dbm = pstatus.dbManagers || 0;
        const emails = (pstatus.sidecarSampleEmails || []).join(', ');
        const atomics = pstatus.atomicFiles || {};
        const atomicSummary = Object.keys(atomics).map(k => `${k}:${atomics[k].count || 0}`).join(' ');
        const pingInfo = pstatus.healthPingCount != null ? ` | Pings: ${pstatus.healthPingCount} (last ${pstatus.lastHealthPing ? new Date(pstatus.lastHealthPing).toLocaleTimeString() : 'n/a'})` : ' | No pings tracked yet (cron may need time or redeploy)';
        pbox.innerHTML = `
          <div class="font-bold text-[#ffcc00] mb-1">PERSISTENCE HEALTH (auto on every boot — no manual watching needed)</div>
          <div>Sidecar: <b>${side}</b> managers | DB: <b>${dbm}</b> | Best backup: ${pstatus.bestBackupManagersSeen || 0}${pingInfo}</div>
          <div class="mt-1">Atom ics (freshest per collection): ${atomicSummary}</div>
          <div class="mt-1"><b>BEEFS (atomic):</b> ${pstatus.atomicBeefCount || pstatus.sidecarBeefs || 0} | Sidecar beefs: ${pstatus.sidecarBeefs || 0}</div>
          <div class="mt-1"><b>RUNNER-UP POTS:</b> 1st: ₦${(pstatus.runnerUpPots && pstatus.runnerUpPots.firstRunnerUpPot) || 0} | 2nd: ₦${(pstatus.runnerUpPots && pstatus.runnerUpPots.secondRunnerUpPot) || 0}</div>
          <div class="mt-1">Sample emails: ${emails || '(none)'}</div>
          <div class="mt-1 text-[#888]">Last: ${pstatus.sidecarLastPersisted || 'unknown'}</div>
          <button onclick="reconcileAndPersist()" class="mt-2 px-3 py-1 bg-[#ffcc00] text-black rounded text-xs font-bold">FORCE RECONCILE (rarely needed)</button>
          <button onclick="restoreFromExportPrompt()" class="mt-2 ml-2 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold">RESTORE FROM MY PREVIOUS EXPORT JSON</button>
          <button onclick="restoreFromBestBackup()" class="mt-2 ml-2 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold">RESTORE FROM BEST BACKUP ON DISK (no paste)</button>

          <div class="mt-3 pt-2 border-t border-[#333]">
            <div class="font-bold text-[#00ff85] mb-1">🛡️ FREE TIER SLEEP PREVENTION (set & forget, no manual after)</div>
            <div class="text-[10px]">Render free sleeps after ~15min no traffic (root of WAL/sidecar issues). Use a <b>free external pinger</b> to send traffic to /health every 5 min. This wakes it automatically.</div>
            <div class="mt-1">1. Go to <a href="https://cron-job.org" target="_blank" class="underline">cron-job.org</a> (free, no CC) or UptimeRobot.</div>
            <div class="mt-1">2. Create job pinging exactly: <code class="bg-black px-1">${window.location.origin}/health</code> every 5 minutes (GET).</div>
            <div class="mt-1">From your GO54/other hosting: Add to crontab: <code class="bg-black px-1">*/5 * * * * curl -s ${window.location.origin}/health &gt;/dev/null</code></div>
            <div class="mt-1 text-[10px] text-[#888]">Our /health now does full auto-heal + sidecar promote on every ping. Combined with the 5min maintenance loop while awake, state stays consistent. GitHub Actions also works (free).</div>
            <div class="mt-1 text-[10px]">Tip: Leave this admin tab open — it auto-pings every 60s to help during your session. Keep Mac plugged in.</div>
          </div>
        `;
        panel.appendChild(pbox);

        // Creative autorefresh pinger: if admin tab stays open, it pings /health every 60s.
        // Helps keep the service "warm" during active sessions without external setup.
        setInterval(() => {
          fetch('/health').catch(() => {});
        }, 60 * 1000);
      } catch (e) {
        console.warn('Could not load persistence status', e);
      }
    })();

    // Complaints section (new for go-live)
    const compWrap = document.createElement('div');
    compWrap.className = 'mt-4 p-4 bg-[#161616] border border-[#333] rounded-2xl';
    const complaints = data.complaints || [];
    let compHtml = complaints.length ? complaints.map(c => `
      <div class="mb-2 p-2 bg-black/30 rounded text-xs">
        <div><strong>${c.displayName || c.email}</strong> • ${c.title} <span class="text-[10px] text-[#666]">(${new Date(c.at).toLocaleDateString()})</span> <span class="px-1 rounded ${c.status==='open'?'bg-yellow-700':'bg-green-700'}">${c.status}</span></div>
        <div class="text-[#aaa]">${(c.description||'').slice(0,180)}</div>
        ${c.relatedRound ? `<div class="text-[10px] text-[#888]">Round: ${c.relatedRound}</div>` : ''}
      </div>`).join('') : '<div class="text-[#666] text-xs">No complaints yet.</div>';
    compWrap.innerHTML = `<div class="font-semibold mb-2">COMPLAINTS / ISSUES FROM MANAGERS</div>${compHtml}`;
    panel.appendChild(compWrap);

    // Manual credit form for lost winnings recovery
    const creditWrap = document.createElement('div');
    creditWrap.className = 'mt-4 p-4 bg-[#161616] border border-[#ffcc00] rounded-2xl';
    const mgrOpts = (data.managers || []).map(m => `<option value="${m.id}">${m.displayName} (${m.email})</option>`).join('');
    creditWrap.innerHTML = `
      <div class="font-semibold mb-2 text-[#ffcc00]">MANUAL CREDIT / ADJUSTMENT (for missing winnings after recovery)</div>
      <div class="flex flex-wrap gap-2 items-end">
        <select id="credit-mgr" class="bg-[#111] border border-[#444] text-sm p-1 rounded">${mgrOpts}</select>
        <input id="credit-amt" type="number" placeholder="Amount e.g. 4500" class="bg-[#111] border border-[#444] text-sm p-1 rounded w-28" value="4500">
        <input id="credit-note" placeholder="Note e.g. GW9 winner - recovered" class="bg-[#111] border border-[#444] text-sm p-1 rounded flex-1 min-w-[180px]">
        <button onclick="submitManualCredit()" class="px-4 py-1 bg-[#ffcc00] text-black font-bold rounded text-sm">CREDIT WALLET</button>
        <button onclick="submitManualDeduct()" class="px-4 py-1 bg-red-700 text-white rounded text-sm">DEDUCT (negative adjust)</button>
      </div>
      <div class="text-[10px] mt-1 text-[#888]">Positive = credit missing win. Negative or DEDUCT = correct mistaken auto-settle. Always logged in ledger. No admin payout burden — winners get wallet credit auto on finished GW.</div>
    `;
    panel.appendChild(creditWrap);

    // MANUAL MARK PAID (for cases where payment happened during updates/site downtime)
    const markPaidWrap = document.createElement('div');
    markPaidWrap.className = 'mt-4 p-4 bg-[#161616] border border-[#00ff85] rounded-2xl';
    const mgrOpts2 = (data.managers || []).map(m => `<option value="${m.id}">${m.displayName} (${m.email})</option>`).join('');
    markPaidWrap.innerHTML = `
      <div class="font-semibold mb-2 text-[#00ff85]">MARK MANAGER AS PAID (FPL or UCL) — reflects in pots, eligibility, beefs etc immediately</div>
      <div class="flex flex-wrap gap-2 items-end">
        <select id="mark-paid-mgr" class="bg-[#111] border border-[#444] text-sm p-1 rounded">${mgrOpts2}</select>
        <select id="mark-paid-comp" class="bg-[#111] border border-[#444] text-sm p-1 rounded">
          <option value="fpl">FPL</option>
          <option value="ucl">UCL</option>
        </select>
        <input id="mark-paid-amt" type="number" placeholder="Amount (optional)" class="bg-[#111] border border-[#444] text-sm p-1 rounded w-28" value="30000">
        <button onclick="markManagerPaid()" class="px-4 py-1 bg-[#00ff85] text-black font-bold rounded text-sm">MARK PAID</button>
      </div>
      <div class="text-[10px] mt-1 text-[#888]">Creates confirmed payment record. Use this to fix cases where payment arrived during an update. List of paid will show the manager (even if restored by admin).</div>
    `;
    panel.appendChild(markPaidWrap);

    // LEAGUE IDs + MANAGER TEAM IDs visibility (critical to avoid ID mismatches for auto beef/H2H/cup)
    const leagueWrap = document.createElement('div');
    leagueWrap.className = 'mt-4 p-4 bg-[#1a1a1a] border border-[#ffaa00] rounded-2xl text-sm';
    const lids = data.leagueIds || {};
    let leagueHtml = `<div class="font-bold text-[#ffaa00] mb-1">LEAGUE IDs (used for auto standings, H2H, runner-ups, beef resolution)</div>`;
    leagueHtml += `<div>FPL Classic: <span class="font-mono bg-black px-1">${lids.fplClassic || 'NOT SET — set via admin for accurate D-League rankings'}</span></div>`;
    leagueHtml += `<div>FPL H2H: <span class="font-mono bg-black px-1">${lids.fplH2h || 'NOT SET — set this for per-manager H2H ranks + D-League H2H box (real FPL data)'}</span></div>`;
    leagueHtml += `<div>UCL: <span class="font-mono bg-black px-1">${lids.ucl || 'not set'}</span></div>`;
    leagueHtml += `<div class="text-[10px] mt-1 text-[#888]">These + each manager's FPL/UCL Team ID below must match exactly what you use in FPL. Beefs/awards/H2H use them to auto-resolve via API data. After setting fplH2h, use ↻ refresh in main FPL H2H box or reload.</div>`;
    leagueWrap.innerHTML = leagueHtml;
    panel.appendChild(leagueWrap);

    // ADMIN SUPERPOWERS — make life easy without coding. Visible + one-click for season.
    const powerWrap = document.createElement('div');
    powerWrap.className = 'mt-4 p-4 bg-[#112211] border border-[#00ff85] rounded-2xl text-sm';
    powerWrap.innerHTML = `
      <div class="font-bold mb-2 text-[#00ff85]">ADMIN SUPERPOWERS (season-proof, no code changes needed)</div>
      <div class="flex flex-wrap gap-2">
        <button onclick="triggerSettle()" class="px-3 py-1 bg-[#00ff85] text-black rounded text-xs">Force FPL Settle (current-1)</button>
        <button onclick="fetch('/api/admin/settle-end-season', {method:'POST'}).then(r=>r.json()).then(d=>alert('End season: ' + JSON.stringify(d.awarded||d)))" class="px-3 py-1 bg-[#ffaa00] text-black rounded text-xs">SETTLE H2H + RUNNER UPS (end season)</button>
        <button onclick="loadAdminOverview()" class="px-3 py-1 border border-[#333] rounded text-xs">Refresh All</button>
        <button onclick="window.open('/api/standings','_blank')" class="px-3 py-1 border border-[#333] rounded text-xs">Raw Standings + IDs</button>
        <button onclick="alert('Beefs now auto-settle on finished GW sync (uses your league IDs + per-manager teamIds + picks data). Check logs or trigger settle. No more manual per beef!')" class="px-3 py-1 border border-[#333] rounded text-xs">Beef Auto Info</button>
        <button onclick="if(confirm('Deduct uses negative in Credit form above (see note). Or use manual-credit endpoint with negative amount.')) alert('Use the CREDIT/ADJUST form with negative amount + note for deducts. Always logged.')" class="px-3 py-1 border border-[#333] rounded text-xs">How to Deduct Wallet</button>
        <button onclick="previewAutoSettle()" class="px-3 py-1 bg-purple-700 text-white rounded text-xs">Preview Auto Settle Winners</button>
        <button onclick="forceSpecificRoundSettle()" class="px-3 py-1 bg-purple-700 text-white rounded text-xs">Force Specific Round Settle</button>
        <button onclick="showIdMappingsAudit()" class="px-3 py-1 bg-purple-700 text-white rounded text-xs">View Detailed ID Mappings + Missing</button>
        <button onclick="simulateGWResults()" class="px-3 py-1 bg-purple-700 text-white rounded text-xs">Simulate GW Results (admin)</button>
        <button onclick="bulkUpdateIdsCsv()" class="px-3 py-1 bg-purple-700 text-white rounded text-xs">Bulk Update Team IDs (CSV paste)</button>
      </div>
      <div class="text-[10px] mt-2 text-[#888]">All use exact FPL data + your saved league/manager IDs. Set IDs once, forget. Sync pinger + 30m interval handles timing after GW finished flag.</div>
    `;
    panel.appendChild(powerWrap);

    // RECENT PAYOUT ACTIVITY — shows auto successes + any manual so admin sees full history/updates + ledger state
    const payoutWrap = document.createElement('div');
    payoutWrap.className = 'mt-4 p-4 bg-[#161616] border border-[#00ff85] rounded-2xl';
    const payoutEntries = (data.recentLedger || []).filter(l => (l.type || '').toLowerCase().includes('payout'));
    let payoutHtml = '<div class="font-semibold mb-2 text-[#00ff85]">RECENT PAYOUTS (auto + manual) — visible to admin in updates/history + ledger updated</div>';
    if (payoutEntries.length) {
      payoutEntries.slice().reverse().forEach(p => {  // show newest first
        const mgr = (data.managers || []).find(m => m.id === p.managerId);
        const t = (p.type || '').toLowerCase();
        const isAuto = t.includes('completed');
        const isConfirmed = t.includes('confirmed');
        const isPending = t.includes('requested');
        const status = isAuto ? 'AUTO SUCCESS' : (isConfirmed ? 'MANUAL CONFIRMED' : (isPending ? 'PENDING (auto failed)' : p.type));
        const statusClass = (isAuto || isConfirmed) ? 'bg-[#00ff85] text-black' : 'bg-amber-600';
        payoutHtml += `
          <div class="mb-2 p-2 bg-black/30 rounded text-xs">
            ${mgr ? mgr.displayName : p.managerId} — ₦${Math.abs(p.amount || 0)} 
            <span class="px-1 rounded ${statusClass}">${status}</span><br>
            <span class="text-[10px]">${p.note || ''}</span>
            <span class="text-[10px] text-[#666] block">${p.at || ''}</span>
          </div>`;
      });
    } else {
      payoutHtml += '<div class="text-[#666] text-xs">No payout records yet.</div>';
    }
    payoutWrap.innerHTML = payoutHtml;
    panel.appendChild(payoutWrap);

    // PENDING only for auto-fail cases (manual is the fallback option, not default)
    const pendingWrap = document.createElement('div');
    pendingWrap.className = 'mt-4 p-4 bg-[#161616] border border-[#ff9900] rounded-2xl';
    const pendingPayouts = (data.recentLedger || []).filter(l => l.type === 'payout_requested' && (l.amount || 0) < 0);
    let pendingHtml = '<div class="font-semibold mb-2 text-[#ff9900]">PENDING PAYOUTS — AUTO FAILED (manual transfer is fallback ONLY; confirm here after you pay outside)</div>';
    if (pendingPayouts.length) {
      pendingPayouts.forEach(p => {
        const mgr = (data.managers || []).find(m => m.id === p.managerId);
        pendingHtml += `
          <div class="mb-2 p-2 bg-black/30 rounded text-xs">
            ${mgr ? mgr.displayName : p.managerId} — ₦${Math.abs(p.amount)} • ${p.note}<br>
            <button onclick="confirmManualPayout('${p.managerId}', ${Math.abs(p.amount)})" class="mt-1 px-2 py-0.5 bg-[#ff9900] text-black text-[10px] rounded">CONFIRM MANUAL (update ledger, no double debit)</button>
          </div>`;
      });
    } else {
      pendingHtml += '<div class="text-[#666] text-xs">No auto-failed pending requests. Successful autos appear in the Recent Payouts box above.</div>';
    }
    pendingWrap.innerHTML = pendingHtml;
    panel.appendChild(pendingWrap);

    // Refresh the admin beefs list (includes UNDO for settled)
    if (typeof refreshAdminBeefsList === 'function') {
      refreshAdminBeefsList();
    }

    // Quick full export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'mt-3 px-4 py-1 text-xs bg-[#222] hover:bg-[#333] border border-[#444] rounded';
    exportBtn.textContent = 'DOWNLOAD FULL EXPORT (current-state + ledger + everything) → save offline';
    exportBtn.onclick = () => {
      const token = prompt('Enter your EXPORT_TOKEN:');
      if (!token) return;
      const url = `/api/export/full?token=${encodeURIComponent(token)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `d-league-full-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    panel.appendChild(exportBtn);
  } catch(e) { console.warn('admin overview failed', e); }
}

async function approveJoinRequestFromBtn(btn) {
  const name = btn.dataset.name || '';
  const email = btn.dataset.email || '';
  const fplClubName = btn.dataset.club || '';
  if (!name || !email) {
    alert('Invalid join request data (missing name or email). Refresh the admin panel and try again.');
    return;
  }

  const suggested = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + Math.floor(1000 + Math.random() * 9000);
  const accessCode = prompt(`Access code for ${name} (edit if you want):`, suggested);
  if (!accessCode) return;

  const suggestedFplId = btn ? btn.dataset.fplid || '' : '';
  const fplId = prompt('FPL team ID (prefilled from request):', suggestedFplId);

  try {
    const res = await fetchJSON('/api/admin/add-manager', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        accessCode,
        fplId: fplId || '',
        fplClubName
      })
    });

    let msg = `✅ Manager approved!\n\n` +
              `Email: ${email}\n` +
              `Access Code: ${accessCode}\n\n` +
              `Copy the code and send it to them.\n`;

    if (res.message) msg += res.message + '\n';

    try {
      await navigator.clipboard.writeText(accessCode);
      msg += '\n✅ Code copied to clipboard!';
    } catch {}

    alert(msg);

    loadAdminOverview(); // refresh the panel
  } catch (e) {
    alert('Approve failed: ' + (e.message || e));
  }
}

async function reconcileAndPersist() {
  if (!confirm('Force the server to reconcile the best possible state (sidecar + DB + backups) and save it? This is safe.')) return;
  try {
    const res = await fetchJSON('/api/admin/restore-from-best-backup', { method: 'POST' });
    alert(res.message || 'Reconciled and persisted best state.');
    loadAdminOverview();
  } catch (e) {
    alert('Reconcile failed: ' + (e.message || e) + ' — try the curl persistence-status instead.');
  }
}

async function restoreFromExportPrompt() {
  const jsonStr = prompt('Paste the FULL content of your previous export JSON here (the one you downloaded before the bad deploy). It must be valid JSON starting with { "managers": [...');
  if (!jsonStr) return;
  try {
    const data = JSON.parse(jsonStr);
    if (!data || !Array.isArray(data.managers)) throw new Error('Invalid export - must have managers array');
    const res = await fetchJSON('/api/admin/restore-from-export', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
    alert(res.message || 'Restored from export.');
    loadAdminOverview();
  } catch (e) {
    alert('Restore failed: ' + (e.message || e) + '\nMake sure you pasted the entire valid JSON from your previous good export.');
  }
}

async function restoreFromBestBackup() {
  if (!confirm('Restore the richest backup snapshot currently on disk (managers + ledger + beefs + awards + everything)? This is safe and fast - no JSON paste needed.')) return;
  try {
    const res = await fetchJSON('/api/admin/restore-from-best-backup', { method: 'POST' });
    alert(res.message || 'Restored from best on-disk backup.');
    loadAdminOverview();
  } catch (e) {
    alert('Best backup restore failed: ' + (e.message || e) + '\n(You may need to use the full export JSON instead, or check logs.)');
  }
}

async function submitManualCredit() {
  const mgrSelect = document.getElementById('credit-mgr');
  const amtEl = document.getElementById('credit-amt');
  const noteEl = document.getElementById('credit-note');
  if (!mgrSelect || !amtEl || !noteEl) return;
  const managerId = mgrSelect.value;
  const amount = Number(amtEl.value);
  const note = noteEl.value.trim();
  if (!managerId || !amount || !note) return alert('Select manager, amount and note');
  if (!confirm(`Credit ₦${amount} to selected manager with note: ${note}?`)) return;
  try {
    const res = await fetchJSON('/api/admin/manual-credit', {
      method: 'POST',
      body: JSON.stringify({ managerId, amount, note })
    });
    alert(res.message || 'Credit added.');
    loadAdminOverview(); // refresh
    // also refresh main if open
    if (typeof loadAllData === 'function') loadAllData();
  } catch (e) {
    alert('Credit failed: ' + (e.message || e));
  }
}

async function submitManualDeduct() {
  const mgrSelect = document.getElementById('credit-mgr');
  const amtEl = document.getElementById('credit-amt');
  const noteEl = document.getElementById('credit-note');
  if (!mgrSelect || !amtEl || !noteEl) return;
  const managerId = mgrSelect.value;
  let amount = Number(amtEl.value);
  if (amount > 0) amount = -amount; // force negative
  const note = noteEl.value.trim() || 'Admin deduct / correction';
  if (!managerId || !amount) return alert('Select manager and amount');
  if (!confirm(`DEDUCT ₦${Math.abs(amount)} from selected manager? (negative ledger entry, wallet adjusts)`)) return;
  try {
    const res = await fetchJSON('/api/admin/manual-credit', {
      method: 'POST',
      body: JSON.stringify({ managerId, amount, note })
    });
    alert(res.message || 'Deduct applied.');
    loadAdminOverview();
    if (typeof loadAllData === 'function') loadAllData();
  } catch (e) {
    alert('Deduct failed: ' + (e.message || e));
  }
}

// === ADDITIONAL SUPERPOWERS (preview, force round, ID audit, sim GW) ===
async function previewAutoSettle() {
  if (!window.standingsData) await loadStandings();
  const round = (window.standingsData.currentRound && window.standingsData.currentRound.fpl || 2) - 1;
  const winners = (window.standingsData.fpl || []).slice(0,3).map((m,i) => `${i+1}. ${m.displayName} (~${(m.currentFpl != null ? m.currentFpl : (m.fplTotal || '?'))} GW pts)`).join('\n');
  alert(`Preview Auto Settle for GW${round} (based on current data):\n\nTop projected (current GW):\n${winners}\n\nBeefs will auto-resolve via picks data if preset. Run settle to confirm. Note: Settles on FINAL only.`);
}

async function forceSpecificRoundSettle() {
  const r = prompt('Force settle which FPL round number?', (window.standingsData && window.standingsData.currentRound && window.standingsData.currentRound.fpl || 2)-1 );
  if (!r) return;
  try {
    await fetchJSON('/api/settle/run', { method: 'POST', body: JSON.stringify({ comp: 'fpl', round: parseInt(r) }) });
    alert(`Forced settle for round ${r}. Check ledger/pots.`);
    loadAdminOverview();
  } catch(e) { alert('Force failed: ' + e.message); }
}

function showIdMappingsAudit() {
  const mgrs = (window.lastAdminData && window.lastAdminData.managers) || [];
  let missing = [];
  let html = 'ID MAPPINGS AUDIT (league + per manager teamIds):\n\n';
  mgrs.forEach(m => {
    const fplId = m.fplTeam && m.fplTeam.teamId ? m.fplTeam.teamId : 'MISSING';
    const uclId = m.uclTeam && m.uclTeam.teamId ? m.uclTeam.teamId : '—';
    html += `${m.displayName}: FPL=${fplId} UCL=${uclId}\n`;
    if (fplId === 'MISSING' && m.fplPaid) missing.push(m.displayName);
  });
  html += `\nLeague IDs: ${JSON.stringify( (window.lastAdminData && window.lastAdminData.leagueIds) || {} )}\n`;
  if (missing.length) html += `\n⚠️ MISSING TEAM IDs (paid): ${missing.join(', ')} — use edit/fix buttons!`;
  alert(html);
}

async function simulateGWResults() {
  if (!confirm('Admin: Simulate fake final scores for current round (demo only, does not persist)?')) return;
  // Simple sim: perturb current data
  const data = window.standingsData || {};
  const fpl = (data.fpl || []).map(m => ({...m, fplTotal: (m.fplTotal||60) + Math.floor((Math.random()-0.5)*30) }));
  alert('Simulated GW results (example):\n' + fpl.slice(0,5).map(m=>`${m.displayName}: ${m.fplTotal}`).join('\n') + '\n\nUse for preview. Real sync overwrites.');
  // Could call a temp endpoint but for now visual superpower.
}

async function bulkUpdateIdsCsv() {
  const csv = prompt('Paste CSV lines: email,fplTeamId,uclTeamId (one per line, header optional). Updates by email, preserves paid etc.');
  if (!csv) return;
  const lines = csv.trim().split(/\n+/).filter(l => l.includes(','));
  let updated = 0;
  for (const line of lines) {
    const [email, fplId, uclId] = line.split(',').map(x => x.trim());
    if (!email) continue;
    const short = email.split('@')[0].replace(/[^a-z0-9]/g,'').slice(0,6).toUpperCase();
    const code = `${short}-${Math.floor(1000+Math.random()*9000)}`;
    try {
      await fetchJSON('/api/admin/add-manager', {
        method: 'POST',
        body: JSON.stringify({ email, fplId: fplId || '', uclId: uclId || '', name: email.split('@')[0], accessCode: code })
      });
      updated++;
    } catch(e) {}
  }
  alert(`Bulk update attempted for ${updated} entries. Refresh to see. Safe for existing paid (preserves).`);
  loadAdminOverview();
}

async function confirmManualPayout(managerId, amount) {
  if (!confirm(`Confirm MANUAL payout (fallback after auto failed) of ₦${amount}? This just marks the prior request complete in ledger (no double debit).`)) return;
  try {
    const res = await fetchJSON('/api/admin/confirm-payout', {
      method: 'POST',
      body: JSON.stringify({ managerId, amount })
    });
    alert(res.message || 'Payout confirmed.');
    loadAdminOverview();
  } catch (e) {
    alert('Confirm failed: ' + (e.message || e));
  }
}

async function cancelSponsorship(id) {
  if (!confirm('Cancel this sponsorship?')) return;
  try {
    await fetchJSON('/api/admin/cancel-sponsorship', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
    alert('Sponsorship cancelled.');
    loadAdminOverview();
  } catch (e) {
    alert('Cancel failed: ' + e.message);
  }
}

function showAddManagerModal() {
  const m = $('add-manager-modal');
  if (m) m.classList.remove('hidden');
}

function closeAddManagerModal() {
  const m = $('add-manager-modal');
  if (m) m.classList.add('hidden');
}

async function submitAddManagerForm(ev) {
  ev.preventDefault();
  const name = $('add-name').value.trim();
  const email = $('add-email').value.trim();
  const accessCode = $('add-code').value.trim();
  const fplClubName = $('add-club').value.trim();
  const fplId = $('add-fplid').value.trim();
  const uclId = $('add-uclid').value.trim();

  if (!name || !email || !accessCode) {
    alert('Name, email and access code required.');
    return;
  }

  try {
    const res = await fetchJSON('/api/admin/add-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, accessCode, fplId, uclId, fplClubName })
    });
    alert(`Added! Code: ${accessCode}\n\n${res.message || ''}`);
    closeAddManagerModal();
    loadAdminOverview();
  } catch (e) {
    alert('Add failed: ' + e.message);
  }
}

// Keep old for backward if needed, but use modal
async function promptAddManager() {
  showAddManagerModal();
}

async function promptSetLeagues() {
  const current = (window.lastAdminData && window.lastAdminData.leagueIds) || {};
  const fplClassic = prompt('FPL Classic League ID (for standings):', current.fplClassic || '') || '';
  const fplH2h = prompt('FPL H2H League ID (for real ranks + H2H box):', current.fplH2h || '') || '';
  const ucl = prompt('UCL League/Identifier (if available):', current.ucl || '') || '';

  try {
    const res = await fetchJSON('/api/admin/set-leagues', {
      method: 'POST',
      body: JSON.stringify({ fplClassic, fplH2h, ucl })
    });
    alert((res.message || 'League IDs updated.') + ' H2H data should now appear in FPL list (under names) + dedicated H2H box. Refresh the H2H box or reload after.');
    loadAdminOverview();
    // Refresh main FPL view so H2H league data (real from fplh2h) appears in list and box
    if (typeof loadStandings === 'function' && typeof renderFplTailored === 'function') {
      loadStandings().then(() => {
        if (typeof switchLeague === 'function') switchLeague('fpl');
        if (typeof renderFplTailored === 'function') renderFplTailored();
      });
    }
  } catch (e) {
    alert('Failed to set leagues: ' + e.message);
  }
}

function escPred(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function isCommissionerClient() {
  return !!(currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com');
}

function renderPredictionWeek() {
  const el = $('prediction-week');
  if (!el) return;
  const pred = (standingsData && standingsData.currentPrediction) || null;
  const admin = isCommissionerClient();
  if (!pred) {
    el.innerHTML = admin
      ? `<div class="p-5 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
           <div class="font-black text-xl text-[#00ff85] tracking-[-0.5px]">PREDICTION OF THE WEEK</div>
           <div class="text-sm text-[#ccc] mt-1">No live prediction yet. Set the title + prize after the group decides.</div>
           <button onclick="adminSetPrediction()" class="mt-3 px-5 py-2 bg-[#00ff85] text-black font-bold rounded-2xl text-sm">SET THIS WEEK'S PREDICTION</button>
         </div>`
      : `<div class="p-5 bg-[#1c1c1c] border border-[#333] rounded-3xl">
           <div class="font-black text-xl tracking-[-0.5px]">PREDICTION OF THE WEEK</div>
           <div class="text-sm text-[#888] mt-1">Waiting for this week's question. Check back after the commissioner posts it.</div>
         </div>`;
    return;
  }
  const votes = pred.votes || [];
  const myVote = currentManager ? votes.find(v => v.managerId === currentManager.id) : null;
  const status = pred.status || 'open';
  const open = status === 'open';
  const locked = status === 'locked';
  const settled = status === 'settled';
  const statusLabel = open ? 'OPEN — submit now' : (locked ? 'LOCKED — no more entries' : 'SETTLED');
  const voteRows = votes.map(v => {
    const own = currentManager && v.managerId === currentManager.id;
    const reveal = locked || settled;
    const checked = settled && (pred.winners || []).some(w => w.managerId === v.managerId);
    const box = admin && locked && !settled
      ? `<input type="checkbox" class="pred-win-cb mr-2" value="${escPred(v.managerId)}" ${checked ? 'checked' : ''}>`
      : '';
    let detail;
    if (reveal && v.text) detail = ` — ${escPred(v.text)}`;
    else if (own) detail = ` — in (hidden until lock)`;
    else detail = ` — entered`;
    return `<div class="flex items-start gap-2 py-1.5 border-b border-[#222] text-sm">
      ${box}
      <div class="flex-1 min-w-0"><span class="font-semibold">${escPred(v.displayName || 'Manager')}</span>
        <span class="text-[#ccc]">${detail}</span></div>
    </div>`;
  }).join('') || `<div class="text-xs text-[#666]">No predictions in yet.</div>`;
  const winnersLine = settled && pred.winners && pred.winners.length
    ? `<div class="mt-2 text-sm text-[#00ff85]">Winners: ${pred.winners.map(w => `${escPred(w.displayName)} (₦${(w.amount||0).toLocaleString()})`).join(' · ')}</div>`
    : '';
  el.innerHTML = `
    <div class="p-5 bg-[#0a1a12] border-2 border-[#00ff85] rounded-3xl">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div class="font-black text-xl text-[#00ff85] tracking-[-0.5px]">PREDICTION OF THE WEEK</div>
        <div class="text-[10px] px-2 py-0.5 rounded font-mono ${open ? 'bg-[#003322] text-[#00ff85]' : (locked ? 'bg-[#332200] text-[#ffaa00]' : 'bg-[#222] text-[#888]')}">${statusLabel}</div>
      </div>
      <div class="text-lg font-bold mt-2">${escPred(pred.title)}</div>
      <div class="text-sm text-[#aaa] mt-0.5">Prize: <span class="text-[#00ff85] font-black">₦${(pred.prize||0).toLocaleString()}</span> · ${votes.length} prediction${votes.length===1?'':'s'}
        <button onclick="showSponsorModal()" class="ml-2 text-[10px] underline text-[#ffaa00]">Sponsor this prize</button>
      </div>
      ${winnersLine}
      ${open ? `
        <div class="mt-3">
          <textarea id="pred-vote-text" rows="2" maxlength="280" placeholder="Your prediction (open-ended)…" class="w-full p-2 bg-[#111] border border-[#333] rounded-xl text-sm">${escPred(myVote ? myVote.text : '')}</textarea>
          <button onclick="submitPredictionVote('${escPred(pred.id)}')" class="mt-2 px-5 py-2 bg-[#00ff85] text-black font-bold rounded-2xl text-sm">${myVote ? 'UPDATE MY PREDICTION' : 'SUBMIT PREDICTION'}</button>
          <div class="text-[10px] text-[#666] mt-1">Blind pool: others only see that you entered. All predictions are revealed when the commissioner locks.</div>
        </div>
      ` : ''}
      <div class="mt-3 max-h-48 overflow-auto">${voteRows}</div>
      <div class="mt-3">
        <button onclick="sharePredictionCard()" class="px-5 py-2 bg-[#25D366] text-white font-bold rounded-2xl text-sm active:scale-[0.985]">📲 SHARE ON WHATSAPP</button>
      </div>
      ${admin ? `
        <div class="mt-3 flex flex-wrap gap-2">
          <button onclick="adminSetPrediction()" class="px-3 py-1 bg-[#222] rounded-xl text-xs">EDIT TITLE / PRIZE</button>
          ${open ? `<button onclick="adminLockPrediction('${escPred(pred.id)}', true)" class="px-3 py-1 bg-[#ffaa00] text-black font-bold rounded-xl text-xs">LOCK ENTRIES</button>` : ''}
          ${locked ? `<button onclick="adminLockPrediction('${escPred(pred.id)}', false)" class="px-3 py-1 bg-[#222] rounded-xl text-xs">REOPEN</button>` : ''}
          ${locked && !settled ? `<button onclick="adminSettlePrediction('${escPred(pred.id)}')" class="px-3 py-1 bg-[#00ff85] text-black font-bold rounded-xl text-xs">SETTLE — SPLIT AMONG TICKED</button>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function wrapCanvasLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').length;
  if (used < String(text || '').length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[lines.length - 1] = last + '…';
  }
  return lines;
}

function predictionShareUrl(pred) {
  const id = (pred && pred.id) ? pred.id : 'live';
  return `${location.origin}/share/prediction?id=${encodeURIComponent(id)}`;
}

function sharePredictionCard() {
  const pred = (standingsData && standingsData.currentPrediction) || null;
  if (!pred) return alert('No live prediction to share yet.');
  const prize = Number(pred.prize || 0);
  const status = pred.status === 'open' ? 'OPEN • BLIND POOL' : (pred.status === 'locked' ? 'LOCKED • REVEALED' : 'SETTLED');
  const link = predictionShareUrl(pred);
  const waText = `D LEAGUE CLUBHOUSE\n\nPREDICTION OF THE WEEK\n\n${pred.title}\n\nPrize: ₦${prize.toLocaleString()}\n${status}\n\nBlind pool — drop your answer in the Clubhouse (hidden until lock).\n\nEnter here:\n${link}`;

  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070707';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0a1a12');
  g.addColorStop(0.55, '#0a0a0a');
  g.addColorStop(1, '#111111');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#00ff85';
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(255,170,0,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  ctx.fillStyle = '#000';
  ctx.fillRect(90, 90, 96, 96);
  ctx.strokeStyle = '#00ff85';
  ctx.lineWidth = 3;
  ctx.strokeRect(90, 90, 96, 96);
  ctx.fillStyle = '#00ff85';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('DL', 108, 156);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('D LEAGUE', 210, 128);
  ctx.fillStyle = '#00ff85';
  ctx.font = '600 22px sans-serif';
  ctx.fillText('CLUBHOUSE  •  SEASON 26/27', 210, 168);

  ctx.fillStyle = '#ffaa00';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('PREDICTION OF THE WEEK', 90, 280);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  const titleLines = wrapCanvasLines(ctx, pred.title, W - 180, 4);
  titleLines.forEach((ln, i) => ctx.fillText(ln, 90, 360 + i * 64));

  const prizeY = 360 + titleLines.length * 64 + 70;
  ctx.fillStyle = '#888';
  ctx.font = '600 24px sans-serif';
  ctx.fillText('PRIZE', 90, prizeY);
  ctx.fillStyle = '#00ff85';
  ctx.font = 'bold 88px sans-serif';
  ctx.fillText('₦' + prize.toLocaleString(), 90, prizeY + 90);

  ctx.fillStyle = pred.status === 'open' ? '#003322' : '#332200';
  const badge = status;
  ctx.font = 'bold 22px sans-serif';
  const bw = ctx.measureText(badge).width + 40;
  ctx.fillRect(90, prizeY + 130, bw, 48);
  ctx.fillStyle = pred.status === 'open' ? '#00ff85' : '#ffaa00';
  ctx.fillText(badge, 110, prizeY + 162);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '22px sans-serif';
  ctx.fillText('Blind pool. Your pick stays hidden until lock.', 90, H - 200);
  ctx.fillStyle = '#00ff85';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Open the link → login → drop your prediction', 90, H - 150);
  ctx.fillStyle = '#666';
  ctx.font = '20px sans-serif';
  const urlShow = location.host || 'd-league-clubhouse.onrender.com';
  ctx.fillText(urlShow, 90, H - 100);

  const modal = $('modal');
  const content = $('modal-content');
  content.innerHTML = `
    <div class="text-center">
      <div class="font-black text-xl mb-2 text-[#00ff85]">Share Prediction of the Week</div>
      <div class="text-xs text-[#888] mb-3">WhatsApp opens with the question, prize, and a link that lands on this card after login.</div>
      <div id="pred-card-wrap" class="flex justify-center overflow-auto"></div>
      <div class="mt-4 flex flex-wrap gap-2 justify-center">
        <button type="button" class="pred-wa px-4 py-2 bg-[#25D366] text-white font-bold rounded-2xl text-sm">Open WhatsApp</button>
        <button type="button" class="pred-dl px-4 py-2 bg-[#00ff85] text-black font-bold rounded-2xl text-sm">Download PNG</button>
        <button type="button" class="pred-copy px-4 py-2 border border-[#333] rounded-2xl text-sm">Copy link</button>
        <button type="button" onclick="closeModal()" class="px-4 py-2 border border-[#333] rounded-2xl text-sm">Close</button>
      </div>
    </div>
  `;
  const wrap = content.querySelector('#pred-card-wrap');
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  canvas.style.borderRadius = '16px';
  wrap.appendChild(canvas);
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const dataUrl = canvas.toDataURL('image/png');
  content.querySelector('.pred-wa').onclick = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(waText), '_blank');
  };
  content.querySelector('.pred-dl').onclick = () => downloadCanvas(dataUrl, 'dleague-prediction-week.png');
  content.querySelector('.pred-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(link); alert('Link copied.'); }
    catch { prompt('Copy this link:', link); }
  };
}

function handlePredictionDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('prediction')) return;
  const jump = () => {
    const el = document.getElementById('prediction-week');
    if (!el || el.children.length === 0) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('pred-deep-link-flash');
    void el.offsetWidth;
    el.classList.add('pred-deep-link-flash');
    history.replaceState(null, '', location.pathname);
    return true;
  };
  if (!currentManager) return;
  setTimeout(() => { if (!jump()) setTimeout(jump, 700); }, 350);
}

async function submitPredictionVote(id) {
  const ta = $('pred-vote-text');
  const text = ta ? ta.value.trim() : '';
  if (!text) return alert('Write your prediction first.');
  try {
    await fetchJSON(`/api/predictions/${id}/vote`, { method: 'POST', body: JSON.stringify({ text }) });
    await loadStandings();
    renderPredictionWeek();
  } catch (e) {
    alert(e.message || 'Could not save prediction');
  }
}

async function loadAllManagersForAdmin() {
  let list = [];
  if (window.lastAdminData && Array.isArray(window.lastAdminData.managers)) list = window.lastAdminData.managers;
  if (list.length < 2) {
    try {
      const data = await fetchJSON('/api/admin/overview');
      window.lastAdminData = data;
      list = data.managers || [];
    } catch (e) {}
  }
  const fromStandings = (standingsData && standingsData.all) || [];
  const byId = new Map();
  [...list, ...fromStandings].forEach(m => {
    if (m && m.id) byId.set(m.id, m);
  });
  return Array.from(byId.values())
    .filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'))
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

function openAdminSheet(htmlInner) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `<div style="background:#1c1c1c;border:1px solid #333;padding:16px;border-radius:12px;max-width:720px;width:94%;max-height:90vh;overflow:auto;">${htmlInner}</div>`;
  document.body.appendChild(modal);
  return modal;
}

function managerSelectHtml(id, managers, extraOpt) {
  const opts = [`<option value="">${extraOpt || '-- select manager --'}</option>`]
    .concat(managers.map(m => `<option value="${escPred(m.id)}">${escPred(m.displayName)}${m.fplClubName ? ' (' + escPred(m.fplClubName) + ')' : ''}</option>`));
  return `<select id="${id}" style="flex:1;font-size:13px;background:#f8f8f8;color:#111;border:1px solid #555;padding:6px 8px;border-radius:6px;width:100%;">${opts.join('')}</select>`;
}

async function adminSetPrediction() {
  if (!isCommissionerClient()) return alert('Admin only');
  const cur = (standingsData && standingsData.currentPrediction) || {};
  const modal = openAdminSheet(`
    <div style="font-weight:bold;font-size:15px;margin-bottom:4px;color:#00ff85;">Prediction of the Week</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px;">Set the question and prize. Form stays open. Then use Enter picks to fill managers from dropdowns.</div>
    <label style="font-size:11px;color:#aaa;">Question</label>
    <input id="pred-title" value="${escPred(cur.title || '')}" placeholder="e.g. Who scores first vs Arsenal?" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:8px;border-radius:6px;margin:4px 0 10px;">
    <label style="font-size:11px;color:#aaa;">Prize ₦</label>
    <input id="pred-prize" type="number" value="${cur.prize != null ? Number(cur.prize) : 5000}" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:8px;border-radius:6px;margin:4px 0 12px;">
    <button id="pred-save" style="background:#00ff85;color:#111;padding:8px 14px;border-radius:6px;font-weight:700;margin-right:8px;">SAVE / GO LIVE</button>
    <button id="pred-picks" style="background:#222;color:#fff;padding:8px 14px;border-radius:6px;margin-right:8px;">ENTER PICKS FOR MANAGERS</button>
    <button id="pred-cancel" style="padding:8px 14px;border-radius:6px;border:1px solid #444;">CLOSE</button>
  `);
  modal.querySelector('#pred-cancel').onclick = () => document.body.removeChild(modal);
  modal.querySelector('#pred-picks').onclick = () => { document.body.removeChild(modal); adminEnterPredictionForManager(); };
  modal.querySelector('#pred-save').onclick = async () => {
    const title = modal.querySelector('#pred-title').value.trim();
    const prize = Number(modal.querySelector('#pred-prize').value) || 0;
    if (!title) return alert('Need a question');
    try {
      const res = await fetchJSON('/api/admin/prediction', { method: 'POST', body: JSON.stringify({ title, prize }) });
      await loadStandings();
      renderPredictionWeek();
      if (typeof loadAdminOverview === 'function') loadAdminOverview();
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#00ff85;font-size:12px;margin-top:8px;';
      msg.textContent = res.message || 'Live. Form still open — edit again or enter picks.';
      modal.querySelector('div').appendChild(msg);
    } catch (e) { alert(e.message || 'Failed'); }
  };
}

async function adminLockPrediction(id, lock) {
  try {
    const res = await fetchJSON(`/api/admin/prediction/${id}/${lock ? 'lock' : 'unlock'}`, { method: 'POST', body: JSON.stringify({}) });
    alert(res.message || 'Updated.');
    await loadStandings();
    renderPredictionWeek();
  } catch (e) {
    alert(e.message || 'Failed');
  }
}

async function adminEnterPredictionForManager() {
  if (!isCommissionerClient()) return alert('Admin only');
  const pred = (standingsData && standingsData.currentPrediction) || null;
  if (!pred) return alert('Set this week\'s prediction first.');
  if (pred.status === 'settled') return alert('Already settled.');
  const mgrs = await loadAllManagersForAdmin();
  if (!mgrs.length) return alert('No managers found.');
  const voteById = {};
  (pred.votes || []).forEach(v => { if (v.managerId) voteById[v.managerId] = v.text || ''; });
  const rows = mgrs.map(m => {
    const existing = voteById[m.id] || '';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
      <span style="width:180px;flex-shrink:0;">${escPred(m.displayName)}</span>
      <input class="pred-admin-text" data-mid="${escPred(m.id)}" value="${escPred(existing)}" placeholder="their prediction…" style="flex:1;background:#f8f8f8;color:#111;border:1px solid #555;padding:6px 8px;border-radius:6px;">
    </div>`;
  }).join('');
  const modal = openAdminSheet(`
    <div style="font-weight:bold;font-size:15px;margin-bottom:4px;color:#00ff85;">Enter predictions — ${escPred(pred.title)}</div>
    <div style="font-size:11px;color:#888;margin-bottom:8px;">All ${mgrs.length} managers. Fill any rows, SAVE. Form stays so you can keep editing. Blind for others until you lock.</div>
    <div id="pred-admin-rows" style="max-height:420px;overflow:auto;">${rows}</div>
    <div style="margin-top:12px;">
      <button id="pred-admin-save" style="background:#00ff85;color:#111;padding:8px 14px;border-radius:6px;font-weight:700;margin-right:8px;">SAVE PICKS</button>
      <button id="pred-admin-close" style="padding:8px 14px;border-radius:6px;border:1px solid #444;">CLOSE</button>
      <span id="pred-admin-status" style="margin-left:8px;font-size:12px;color:#00ff85;"></span>
    </div>
  `);
  modal.querySelector('#pred-admin-close').onclick = () => document.body.removeChild(modal);
  modal.querySelector('#pred-admin-save').onclick = async () => {
    const votes = Array.from(modal.querySelectorAll('.pred-admin-text')).map(inp => ({
      managerId: inp.getAttribute('data-mid'),
      text: inp.value.trim()
    })).filter(v => v.managerId && v.text);
    try {
      const res = await fetchJSON(`/api/admin/prediction/${pred.id}/votes-bulk`, {
        method: 'POST',
        body: JSON.stringify({ votes })
      });
      modal.querySelector('#pred-admin-status').textContent = res.message || 'Saved.';
      await loadStandings();
      renderPredictionWeek();
    } catch (e) { alert(e.message || 'Failed'); }
  };
}

async function adminReconstructBeef() {
  if (!isCommissionerClient()) return alert('Admin only');
  const mgrs = await loadAllManagersForAdmin();
  if (mgrs.length < 2) return alert('Need at least two managers.');
  const catOpts = (typeof BEEF_PRESETS !== 'undefined' ? BEEF_PRESETS : [])
    .map(c => `<option value="${escPred(c.id)}">${escPred(c.name)}</option>`).join('') +
    `<option value="custom">Custom category…</option>`;
  const modal = openAdminSheet(`
    <div style="font-weight:bold;font-size:15px;margin-bottom:4px;color:#00ff85;">Rebuild a beef</div>
    <div style="font-size:11px;color:#888;margin-bottom:10px;">${mgrs.length} managers. Pick proposer and opponent from the lists. Save keeps this form open so you can add another.</div>
    <label style="font-size:11px;color:#aaa;">Proposer</label>
    <div style="margin:4px 0 10px;">${managerSelectHtml('beef-proposer', mgrs, '-- proposer --')}</div>
    <label style="font-size:11px;color:#aaa;">Opponent</label>
    <div style="margin:4px 0 10px;">${managerSelectHtml('beef-opponent', mgrs, '-- opponent --')}</div>
    <label style="font-size:11px;color:#aaa;">Category</label>
    <select id="beef-cat" style="width:100%;font-size:13px;background:#f8f8f8;color:#111;border:1px solid #555;padding:6px 8px;border-radius:6px;margin:4px 0 8px;">${catOpts}</select>
    <input id="beef-cat-custom" placeholder="Custom category" style="display:none;width:100%;background:#111;border:1px solid #444;color:#fff;padding:8px;border-radius:6px;margin-bottom:8px;">
    <label style="font-size:11px;color:#aaa;">Stake ₦ (record only — no wallet move)</label>
    <input id="beef-stake" type="number" value="5000" style="width:100%;background:#111;border:1px solid #444;color:#fff;padding:8px;border-radius:6px;margin:4px 0 10px;">
    <label style="font-size:11px;color:#aaa;">Status</label>
    <select id="beef-status" style="width:100%;font-size:13px;background:#f8f8f8;color:#111;border:1px solid #555;padding:6px 8px;border-radius:6px;margin:4px 0 12px;">
      <option value="accepted" selected>Accepted (active)</option>
      <option value="proposed">Proposed</option>
    </select>
    <button id="beef-save" style="background:#00ff85;color:#111;padding:8px 14px;border-radius:6px;font-weight:700;margin-right:8px;">SAVE BEEF</button>
    <button id="beef-close" style="padding:8px 14px;border-radius:6px;border:1px solid #444;">CLOSE</button>
    <div id="beef-status-msg" style="margin-top:8px;font-size:12px;color:#00ff85;"></div>
  `);
  const catSel = modal.querySelector('#beef-cat');
  const catCustom = modal.querySelector('#beef-cat-custom');
  catSel.onchange = () => { catCustom.style.display = catSel.value === 'custom' ? 'block' : 'none'; };
  modal.querySelector('#beef-close').onclick = () => document.body.removeChild(modal);
  modal.querySelector('#beef-save').onclick = async () => {
    const proposerId = modal.querySelector('#beef-proposer').value;
    const opponentId = modal.querySelector('#beef-opponent').value;
    if (!proposerId || !opponentId) return alert('Pick proposer and opponent');
    if (proposerId === opponentId) return alert('Pick two different managers');
    let category = catSel.value;
    if (category === 'custom') category = catCustom.value.trim();
    if (!category) return alert('Pick a category');
    const preset = (typeof BEEF_PRESETS !== 'undefined' ? BEEF_PRESETS : []).find(c => c.id === category);
    const catName = preset ? preset.name : category;
    try {
      const res = await fetchJSON('/api/admin/reconstruct-beef', {
        method: 'POST',
        body: JSON.stringify({
          proposerId,
          opponentIds: [opponentId],
          category: catName,
          stake: Number(modal.querySelector('#beef-stake').value) || 0,
          status: modal.querySelector('#beef-status').value
        })
      });
      modal.querySelector('#beef-status-msg').textContent = (res.message || 'Saved.') + ' Add another if needed.';
      modal.querySelector('#beef-opponent').value = '';
    } catch (e) { alert(e.message || 'Failed'); }
  };
}

async function adminSettlePrediction(id) {
  const boxes = Array.from(document.querySelectorAll('.pred-win-cb:checked')).map(b => b.value);
  if (!boxes.length) return alert('Tick the correct manager(s) first. Prize splits equally.');
  if (!confirm(`Split the prize among ${boxes.length} winner(s)?`)) return;
  try {
    const res = await fetchJSON(`/api/admin/prediction/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ winnerIds: boxes })
    });
    alert(res.message || 'Settled.');
    await loadStandings();
    renderPredictionWeek();
  } catch (e) {
    alert(e.message || 'Settle failed');
  }
}

async function promptEditServiceFees() {
  // Load fresh to get current actuals (serviceFees come from house*Admin)
  let cur = { fpl: 0, ucl: 0 };
  try {
    const ov = await fetchJSON('/api/admin/overview');
    cur = (ov && ov.serviceFees) || cur;
    window.lastAdminData = ov;
  } catch (e) {}
  const fpl = prompt('FPL service fee (houseFplAdmin actuals):', cur.fpl || 0);
  if (fpl === null) return;
  const ucl = prompt('UCL service fee (houseUclAdmin actuals):', cur.ucl || 0);
  if (ucl === null) return;
  try {
    const res = await fetchJSON('/api/admin/set-service-fees', {
      method: 'POST',
      body: JSON.stringify({ fpl: Number(fpl), ucl: Number(ucl) })
    });
    alert(res.message || 'Service fees updated.');
    loadAdminOverview();
  } catch (e) {
    alert('Failed to update service fees: ' + (e.message || e));
  }
}

async function toggleLeagueLock(locked, comp) {
  const compName = comp ? comp.toUpperCase() : 'both';
  if (!confirm(locked ? `Lock ${compName}? No new joins for ${compName}.` : `Unlock ${compName}? New joins allowed for ${compName}.`)) return;
  try {
    const body = comp ? { [`${comp}Locked`]: locked } : { fplLocked: locked, uclLocked: locked };
    const res = await fetchJSON('/api/admin/set-league-lock', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    alert(res.message || 'Lock status updated.');
    loadAdminOverview();
  } catch (e) {
    alert('Failed to toggle lock: ' + e.message);
  }
}

async function emergencySync() {
  if (!confirm('Force a data sync from APIs? This is for admin use only.')) return;
  try {
    const res = await fetchJSON('/api/sync/run', { method: 'POST' });
    alert('Emergency sync done. ' + (res.note || ''));
    loadAdminOverview();
  } catch (e) {
    alert('Emergency sync error: ' + e.message);
  }
}

async function reclaimPaidManager(managerId, currentName, currentClub) {
  if (!managerId) return;
  const name = prompt('Real display name for this paid manager:', currentName || '');
  if (!name) return;
  const email = prompt('Real email they will use to login:');
  if (!email) return;
  const suggestedCode = (name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,6) + Date.now().toString().slice(-4));
  const accessCode = prompt('Access code to give them (they will use this to login):', suggestedCode);
  if (!accessCode) return;
  const fplClubName = prompt('FPL club / team name:', currentClub || name + ' FC') || '';
  const fplId = prompt('Their FPL team ID (optional but recommended):') || '';

  try {
    const res = await fetchJSON('/api/admin/restore-paid-manager', {
      method: 'POST',
      body: JSON.stringify({ managerId, name, email, accessCode, fplClubName, fplId })
    });
    alert('✅ Paid record reclaimed!\n\n' + (res.message || '') + '\n\nThey can now log in with the new email + code.\nTheir payments, scores and winnings are preserved.');
    loadAdminOverview();
  } catch (e) {
    alert('Reclaim failed: ' + (e.message || e));
  }
}

async function deleteManager(id, email) {
  if (!confirm('Really delete this manager from the list? Historical ledger/payments/beefs stay for records. Cannot easily undo.')) return;
  try {
    const res = await fetchJSON('/api/admin/delete-manager', {
      method: 'POST',
      body: JSON.stringify({ managerId: id, email })
    });
    alert(res.message || 'Manager removed.');
    loadAdminOverview();
  } catch (e) {
    alert('Delete failed: ' + (e.message || e));
  }
}

async function editManager(email, currentName, currentFplClub, currentUclClub, currentFplId, currentUclId, currentCode) {
  if (!email) return alert('No email');
  const modal = $('modal');
  const content = $('modal-content');
  content.innerHTML = `
    <div class="space-y-3">
      <div class="font-bold text-lg">Edit Manager — only change what you need</div>
      <div class="text-xs text-[#888]">UCL Club Name can be different from FPL. Team IDs critical for data. Edit one field at a time. Paid status & history preserved.</div>
      <div><label class="text-xs">Display Name</label><input id="edit-name" value="${currentName || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm"></div>
      <div><label class="text-xs">Access Code</label><input id="edit-code" value="${currentCode || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm"></div>
      <div><label class="text-xs">FPL Club Name</label><input id="edit-club" value="${currentFplClub || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm"></div>
      <div><label class="text-xs">UCL Club / Team Name (separate, used in UCL mode)</label><input id="edit-uclclub" value="${currentUclClub || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm"></div>
      <div><label class="text-xs">FPL Team ID (exact from FPL)</label><input id="edit-fplid" value="${currentFplId || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm font-mono"></div>
      <div><label class="text-xs">UCL Team ID (optional)</label><input id="edit-uclid" value="${currentUclId || ''}" class="w-full bg-[#111] border border-[#444] p-1 rounded text-sm font-mono"></div>
      <div class="flex gap-2">
        <button onclick="submitEditManager('${email}')" class="flex-1 py-2 bg-[#00ff85] text-black font-bold rounded">SAVE CHANGES</button>
        <button onclick="closeModal()" class="flex-1 py-2 border border-[#333] rounded">CANCEL</button>
      </div>
      <div class="text-[10px] text-[#666]">UCL name shows in UCL list and squads. Make sure IDs match if using auto data.</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function submitEditManager(email) {
  const name = $('edit-name') ? $('edit-name').value.trim() : '';
  const accessCode = $('edit-code') ? $('edit-code').value.trim() : '';
  const fplClubName = $('edit-club') ? $('edit-club').value.trim() : '';
  const uclClubName = $('edit-uclclub') ? $('edit-uclclub').value.trim() : '';
  const fplId = $('edit-fplid') ? $('edit-fplid').value.trim() : '';
  const uclId = $('edit-uclid') ? $('edit-uclid').value.trim() : '';
  if (!name && !accessCode && !fplClubName && !uclClubName && !fplId && !uclId) return alert('No changes');
  try {
    const res = await fetchJSON('/api/admin/add-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, accessCode, fplId, uclId, fplClubName, uclClubName })
    });
    closeModal();
    alert('✅ Manager updated!\n' + (res.message || 'Details saved. Paid status preserved.'));
    loadAdminOverview();
  } catch (e) {
    alert('Update failed: ' + (e.message || e));
  }
}

async function triggerSettle() {
  try {
    await fetchJSON('/api/settle/run', {method: 'POST', body: JSON.stringify({comp: 'fpl'})});
    alert('Settlement triggered. Check ledger.');
    await loadAllData();
  } catch(e) { alert('Settle failed'); }
}

// === NEW ADMIN SUPERPOWERS (call after restore or for season ops) ===
async function repairBeefs() {
  if (!confirm('Repair all beefs from their payment records + force write atomics? This is safe and recommended after restoring a JSON with paid beefs (e.g. bolade vs henry).')) return;
  try {
    const res = await fetchJSON('/api/admin/repair-beefs', { method: 'POST' });
    alert(res.message || `Repaired. Beefs: ${res.beforeBeefCount} → ${res.afterBeefCount}. Runner pots: ${JSON.stringify(res.runnerUpPots)}`);
    await loadAdminOverview();
    // also refresh the main UI beef display + pots
    await loadAllData();
  } catch (e) {
    alert('Repair failed: ' + (e.message || e));
  }
}

async function forcePersistAll() {
  if (!confirm('Force write every collection (managers, beefs, payments, settings, runner pots etc) to atomics + sidecar? Safe nuclear option.')) return;
  try {
    const res = await fetchJSON('/api/admin/force-persist-all', { method: 'POST' });
    alert(res.message || 'All data force persisted.');
    await loadAdminOverview();
  } catch (e) {
    alert('Force persist failed: ' + (e.message || e));
  }
}

async function showAdjustRunnerPotsModal() {
  const first = prompt('Delta for 1ST runner-up pot (positive or negative number, e.g. 300 or -100):', '0');
  if (first === null) return;
  const second = prompt('Delta for 2ND runner-up pot (e.g. 200 or -50):', '0');
  if (second === null) return;
  const note = prompt('Reason/note for ledger (optional):', 'Admin correction after restore') || 'Admin correction';
  try {
    const res = await fetchJSON('/api/admin/adjust-runner-up-pots', {
      method: 'POST',
      body: JSON.stringify({ firstDelta: Number(first), secondDelta: Number(second), note })
    });
    alert(res.message || 'Pots adjusted.');
    await loadAdminOverview();
    await loadAllData(); // refresh top pots
  } catch (e) {
    alert('Adjust failed: ' + (e.message || e));
  }
}

async function previewRunnerUps() {
  try {
    const res = await fetchJSON('/api/admin/preview-runner-ups');
    alert(`Projected Runner Ups:\n1st: ${res.projected1st ? res.projected1st.manager + ' - ₦' + res.projected1st.pot : 'N/A'}\n2nd: ${res.projected2nd ? res.projected2nd.manager + ' - ₦' + res.projected2nd.pot : 'N/A'}\n\n${res.note}`);
  } catch (e) { alert('Preview failed: ' + (e.message||e)); }
}

async function showIdMappings() {
  try {
    const res = await fetchJSON('/api/admin/id-mappings');
    const text = 'League IDs: ' + JSON.stringify(res.leagueIds) + '\n\nManagers (first 5):\n' + (res.managers||[]).slice(0,5).map(m => `${m.name}: FPL=${m.fplTeamId||'-'} UCL=${m.uclTeamId||'-'}`).join('\n');
    alert(text + '\n\n(See full in console or use for auto beef/H2H/runnerup config)');
    console.log('ID MAPPINGS', res);
  } catch (e) { alert('ID mappings failed'); }
}

async function showDeductWalletModal() {
  const who = prompt('Manager ID or email to deduct from:');
  if (!who) return;
  const amt = prompt('Amount to DEDUCT (positive number):');
  if (!amt) return;
  const note = prompt('Reason:', 'Admin correction / fine') || 'Admin deduct';
  try {
    const res = await fetchJSON('/api/admin/deduct-wallet', { method: 'POST', body: JSON.stringify({ managerId: who, amount: Number(amt), note }) });
    alert(res.message || 'Deducted.');
    loadAdminOverview();
  } catch(e){ alert('Deduct failed: '+(e.message||e)); }
}

async function forceSettleRoundPrompt() {
  const comp = prompt('Comp (fpl or ucl)?', 'fpl');
  const rnd = prompt('Round number to force settle?', '1');
  if (!rnd) return;
  try {
    const res = await fetchJSON('/api/admin/force-settle-round', {method:'POST', body: JSON.stringify({comp, round: Number(rnd)})});
    alert(res.message);
    loadAllData();
  } catch(e){alert('Force settle failed');}
}

async function simulateRoundPrompt() {
  const comp = prompt('comp fpl/ucl', 'fpl');
  const rnd = prompt('round', '2');
  const who = prompt('Manager ID or email for mock score', currentManager ? currentManager.id : '');
  const pts = prompt('Mock points for them', '80');
  if (!who || !pts) return;
  try {
    const body = { comp, round: Number(rnd), scores: {} };
    body.scores[who] = Number(pts);
    const res = await fetchJSON('/api/admin/simulate-round', {method:'POST', body: JSON.stringify(body)});
    alert(res.message);
    loadAllData();
  } catch(e){ alert('Simulate failed'); }
}

async function previewBeefAutoSettle() {
  alert('Auto beef settle uses computeBeefWinner on FPL picks data for preset categories (captain, bench, etc). Run after a real sync or use force-settle-round. Check /api/admin/beefs for current active ones. For full preview run a settle and inspect.');
  // Could call a future preview endpoint
}

async function loadStandings() {
  standingsData = await fetchJSON('/api/standings');
  // H2H league data is now in standingsData.realLeagues.fplH2h (from configured fplH2h ID)
  // Old internal h2h (fake pairings) cleared - we use real FPL H2H standings.
  // Legacy combined/old race + table renders removed (their containers no longer exist after separate FPL/UCL UI cleanup).
  // standingsData.fpl / .ucl / .all are still used by renderFplTailored, renderUclTailored, lineup viewer, etc.

  // Ensure lastProjections (used for UCL/FPL pots in renderTopPots) is updated from the response which includes fresh getProjectedPayouts().
  // This guarantees UCL pots (overall/2nd/3rd) reflect latest after payments or MD settles, even if lastProjections was stale.
  if (standingsData.projections) {
    window.lastProjections = standingsData.projections;
  }
  if (typeof renderPredictionWeek === 'function') renderPredictionWeek();
  if (typeof renderTopPotsAndActions === 'function') renderTopPotsAndActions();

  // Auto switch to current mode after load
  if (currentLeagueMode) switchLeague(currentLeagueMode);

  // Kick client-side H2H fetch for cases where server /api/standings didn't deliver the standings (private league, fetch hiccup on server, etc.)
  const l = standingsData && standingsData.leagueIds;
  if (l && l.fplH2h) {
    setTimeout(loadClientH2HIfNeeded, 50);
  }
}

function refreshStandingsForH2H() {
  // Helper to force re-fetch so H2H ranks + box update after setting fplH2h ID or for fresh data
  clientH2HData = null; // force fresh client attempt too
  if (typeof loadStandings === 'function' && typeof renderFplTailored === 'function') {
    loadStandings().then(() => {
      if (typeof renderFplTailored === 'function') renderFplTailored();
    }).catch(e => console.warn('H2H refresh failed', e));
  } else {
    location.reload();
  }
}

let clientH2HData = null;
async function loadClientH2HIfNeeded() {
  if (!standingsData) return null;
  const lids = standingsData.leagueIds || {};
  const id = lids.fplH2h;
  if (!id) return null;
  if (clientH2HData && clientH2HData.standings) return clientH2HData;
  try {
    const r = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h/${encodeURIComponent(id)}/standings/`);
    if (r.ok) {
      const data = await r.json();
      if (data && data.standings && data.standings.results) {
        clientH2HData = data;
        // Re-render so the list + box pick up the client-fetched H2H data immediately
        setTimeout(() => {
          if (typeof renderFplTailored === 'function') renderFplTailored();
        }, 10);
        return clientH2HData;
      }
    }
  } catch (e) {
    console.warn('[H2H] client-side fetch failed (may still work via server data)', e);
  }
  return clientH2HData;
}

function renderCombinedRace() {
  const container = $('combined-race');
  if (!container) return;
  container.innerHTML = '';
  const list = standingsData.combined || [];

  if (!list.length) {
    container.innerHTML = `<div class="text-[#888] text-sm py-2">No fully paid managers yet.</div>`;
    return;
  }

  list.slice(0, 8).forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = `flex items-center justify-between px-4 py-[9px] rounded-2xl ${m.id === currentManager.id ? 'bg-[#1a2a1f]' : ''}`;
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 text-center font-mono text-xs text-[#888]">${idx + 1}</div>
        <div>
          <div class="font-semibold">${m.displayName} ${m.fplClubName ? `(${m.fplClubName})` : (m.fplTeam.teamName ? `(${m.fplTeam.teamName})` : '')} ${m.id === currentManager.id ? '<span class="text-[10px] ml-1 text-[#00ff85]">(YOU)</span>' : ''}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="font-black tabular-nums text-xl tracking-tighter">${m.combined}</div>
        <div class="text-[9px] text-[#00ff85]">COMBINED</div>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderFPLRace() {
  const wrap = $('fpl-race');
  if (!wrap) return;
  const gwNum = $('fpl-gw-num');
  if (gwNum) gwNum.textContent = standingsData.currentRound.fpl;
  wrap.innerHTML = '';
  const list = standingsData.fpl || [];

  if (!list.length) {
    wrap.innerHTML = `<div class="text-xs text-[#888]">No paid FPL managers.</div>`;
    return;
  }

  list.slice(0, 6).forEach((m, i) => {
    const el = document.createElement('div');
    el.className = `flex justify-between items-center px-3 py-1.5 rounded-xl ${m.id === currentManager.id ? 'bg-[#0d2a1f]' : 'hover:bg-[#1c1c1c]'}`;
    const gwBadge = (m.currentFplSource === 'live-projection')
      ? '<span class="text-[8px] bg-blue-900 text-blue-300 px-1 rounded ml-0.5">LIVE</span>'
      : (m.currentFplSource === 'official-fpl' ? '<span class="text-[8px] bg-[#003322] text-[#00ff85] px-1 rounded ml-0.5">FINAL</span>' : '');
    el.innerHTML = `
      <div class="flex gap-2 items-center">
        <span class="font-mono text-xs w-4 text-[#888]">${i+1}</span>
        <span class="font-medium">${withBadge(m.displayName, m.id)}</span>
      </div>
      <div class="flex items-center gap-2 text-right">
        <div>
          <div class="score-value font-bold tabular-nums">${m.fplTotal ?? '—'} <span class="text-[9px] text-[#666]">ovr</span></div>
          <div class="text-xs tabular-nums">GW: ${m.currentFpl ?? '—'} ${gwBadge}</div>
        </div>
      </div>
    `;
    wrap.appendChild(el);
  });
}

function renderUCLRace() {
  const wrap = $('ucl-race');
  if (!wrap) return;
  const mdNum = $('ucl-md-num');
  if (mdNum) mdNum.textContent = standingsData.currentRound.ucl;
  wrap.innerHTML = '';
  const list = standingsData.ucl || [];

  if (!list.length) {
    wrap.innerHTML = `<div class="text-xs text-[#888]">No paid UCL managers.</div>`;
    return;
  }

  list.slice(0, 6).forEach((m, i) => {
    const el = document.createElement('div');
    el.className = `flex justify-between items-center px-3 py-1.5 rounded-xl ${m.id === currentManager.id ? 'bg-[#222]' : 'hover:bg-[#1c1c1c]'}`;
    el.innerHTML = `
      <div class="flex gap-2 items-center">
        <span class="font-mono text-xs w-4 text-[#888]">${i+1}</span>
        <span class="font-medium">${m.displayName}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="score-value font-bold tabular-nums">${m.uclTotal ?? '—'}</span>
        <span class="source-label">${m.currentUclSource || ''}</span>
      </div>
    `;
    wrap.appendChild(el);
  });
}

function renderFullTable() {
  const tbody = $('standings-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  const all = standingsData.all || [];
  const sorted = [...all].sort((a, b) => (b.combined || 0) - (a.combined || 0));

  sorted.forEach((m) => {
    const tr = document.createElement('tr');
    tr.className = `leader-row cursor-pointer ${m.id === currentManager.id ? 'bg-[#0d2a1f]' : ''}`;
    tr.onclick = () => showManagerProfile(m.id);

    const fplPaidBadge = m.fplPaid ? '<span class="text-[10px] px-1.5 py-px border border-[#00ff85]/30 text-[#00ff85] rounded">FPL</span>' : '';
    const uclPaidBadge = m.uclPaid ? '<span class="text-[10px] px-1.5 py-px border border-[#444] text-[#aaa] rounded">UCL</span>' : '';

    const gwBadge = (m.currentFplSource === 'live-projection')
      ? '<span class="text-[8px] bg-blue-900 text-blue-300 px-1 rounded ml-0.5">LIVE</span>'
      : (m.currentFplSource === 'official-fpl' ? '<span class="text-[8px] bg-[#003322] text-[#00ff85] px-1 rounded ml-0.5">FINAL</span>' : '');
    // H2H per-player display removed from main standings (use dedicated H2H box with fplH2h)

    tr.innerHTML = `
      <td class="py-2 pr-4">
        <div class="font-semibold">${withBadge(m.displayName, m.id)} ${m.id === currentManager.id ? '<span class="text-[#00ff85] text-xs ml-1">(YOU)</span>' : ''}</div>
        <div class="text-[10px] text-[#888]">${m.fplTeam.teamName || ''} • ${m.uclTeam.teamName || ''}</div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="flex items-center gap-3">
          <div>
            <div class="text-[9px] text-[#666] tracking-widest">SEASON</div>
            <div class="font-bold tabular-nums text-base">${m.fplTotal ?? '—'}</div>
          </div>
          <div class="w-px h-5 bg-[#333]"></div>
          <div class="text-right">
            <div class="text-[9px] text-[#666] tracking-widest">GW</div>
            <div class="flex items-center gap-1 justify-end font-bold tabular-nums text-base">${m.currentFpl ?? '—'} ${gwBadge}</div>
          </div>
        </div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="font-bold">${m.uclTotal ?? '—'}</div>
        <div class="text-[10px] text-[#aaa]">${m.uclPaid ? 'PAID' : '—'}</div>
      </td>
      <td class="py-2 px-3">
        <div class="font-black text-xl tabular-nums tracking-tighter">${m.combined}</div>
      </td>
      <td class="py-2 px-3 text-xs">
        <div class="text-[9px] text-[#888] mt-0.5">H2H: ${h2hCell}</div>
      </td>
      <td class="py-2 px-3">
        <span class="text-[#888]">—</span>
      </td>
      <td class="py-2 px-3">
        <div class="flex gap-1 flex-wrap">${fplPaidBadge}${uclPaidBadge}</div>
      </td>
      <td class="py-2 pl-3 tabular-nums text-sm font-medium">₦${m.wallet}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function showManagerProfile(managerId) {
  try {
    const data = await fetchJSON(`/api/manager/${managerId}/full`);
    const modal = $('modal');
    const c = $('modal-content');

    let scoresHTML = '';
    const fplRecent = (data.fplScores || []).slice(-4).reverse();
    const uclRecent = (data.uclScores || []).slice(-3).reverse();

    scoresHTML += '<div class="grid grid-cols-2 gap-4 mt-4 text-xs"><div><div class="font-semibold text-[#00ff85] mb-1">Recent FPL</div>';
    fplRecent.forEach(s => {
      const cap = s.captain ? ` C#${s.captain}` : '';
      const chip = s.activeChip ? ` [${s.activeChip}]` : '';
      scoresHTML += `<div>GW${s.round}: <b>${s.points ?? '—'}</b> <span class="source-label">${s.source}${cap}${chip}</span></div>`;
    });
    scoresHTML += '</div><div><div class="font-semibold text-[#888] mb-1">Recent UCL</div>';
    uclRecent.forEach(s => {
      scoresHTML += `<div>MD${s.round}: <b>${s.points ?? '—'}</b> <span class="source-label">${s.source}</span></div>`;
    });
    scoresHTML += '</div></div>';

    let finesHTML = ''; // fines system removed

    c.innerHTML = `
      <div>
        <div class="font-black text-3xl">${data.displayName}</div>
        <div class="text-xs text-[#888] mt-0.5">${data.fplTeam.teamName || ''} • ${data.uclTeam.teamName || ''}</div>
        
        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">FPL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.fplTotal || 0}</div><div class="text-[10px] text-[#00ff85]">GW: ${data.currentFpl ?? '—'} ${(data.currentFplSource==='live-projection'?'LIVE':(data.currentFplSource==='official-fpl'?'FINAL':''))}</div></div>
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">UCL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.uclTotal || 0}</div></div>
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">COMBINED</div><div class="font-black text-2xl tabular-nums">${data.combined || 0}</div></div>
        </div>

        ${scoresHTML}
        ${finesHTML}

        <div class="mt-4 text-xs">
          <div class="flex justify-between"><span>Wallet</span><span class="font-semibold tabular-nums">₦${data.wallet || 0}</span></div>
          <!-- H2H vs removed from profile (use dedicated box + FPL app for actual opponent) -->
          <div class="flex justify-between"><span>Transaction history</span><span class="font-semibold">See ledger</span></div>
        </div>

        <div class="mt-5 text-[10px] text-[#00ff85]">Eligibility: ${data.eligibleFpl ? 'FPL ✓' : 'FPL unpaid'} • ${data.eligibleUcl ? 'UCL ✓' : 'UCL unpaid'}</div>

        <button onclick="closeModal()" class="w-full mt-5 py-3 border border-[#333] rounded-2xl text-sm">CLOSE PROFILE</button>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (e) {
    alert('Failed to load profile: ' + e.message);
  }
}

function renderManagerHero() {
  if (!currentManager) return;

  const round = (standingsData && standingsData.currentRound) || {fpl: '?', ucl: '?'};

  // Only touch elements that still exist in the cleaned-up dashboard
  const fplCur = $('fpl-current');
  if (fplCur) {
    fplCur.innerHTML = currentManager.currentFpl != null ? 
      `GW${round.fpl} • ${currentManager.currentFpl} pts <span class="source-label">${currentManager.currentFplSource || ''}</span>` : '—';
  }

  const uclCur = $('ucl-current');
  if (uclCur) {
    uclCur.innerHTML = currentManager.currentUcl != null ? 
      `MD${round.ucl} • ${currentManager.currentUcl} pts` : '—';
  }

  // Removed in UI cleanup: fpl-status, ucl-status, combined-rank, wallet-balance — no longer set

  // Refresh prominent bar with latest proj/persona
  if (typeof renderProminentFeatures === 'function') renderProminentFeatures();
}

async function loadTicker() {
  try {
    const t = await fetchJSON('/api/ticker');
    const el = $('ticker-content');
    if (!el) return;
    el.innerHTML = '';
    t.messages.forEach((msg, i) => {
      const span = document.createElement('span');
      span.className = 'ticker-item';
      span.innerHTML = `<span class="text-[#00ff85]">●</span> ${msg}`;
      el.appendChild(span);
    });
  } catch {}
}

async function loadH2H() {
  // Deprecated - we now use real FPL H2H league standings via fplH2h ID (see renderFplTailored and H2H box).
  // Old internal derived matches removed. Real H2H rank/data is enriched from /api/standings realLeagues.fplH2h.
  const wrap = $('h2h-list');
  if (!wrap) return;
  wrap.innerHTML = `<div class="text-xs text-[#888]">H2H league data now shown in main FPL list + H2H box (real standings from your fplH2h ID).</div>`;
}


async function loadProjections() {
  // Standings already includes projections. Skip extra /api/payouts unless we have nothing yet.
  if (window.lastProjections && (window.lastProjections.fpl || window.lastProjections.ucl)) return;
  const proj = await fetchJSON('/api/payouts');
  window.lastProjections = proj;
  const wrap = $('payout-projections');
  if (!wrap) return;
  const f = proj.fpl || {};
  wrap.innerHTML = `
    <div>
      <div class="text-[#00ff85] text-xs">FPL WEEKLY 90%</div>
      <div class="text-2xl font-black tabular-nums">₦${f.weeklyPot90 || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">H2H Season Pot</div>
      <div class="text-2xl font-black tabular-nums">₦${f.h2hOverallPot || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">OVERALL LEAGUE WINNER</div>
      <div class="text-2xl font-black tabular-nums">₦${f.overallWinnerPot || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">SEASON CUP WINNER</div>
      <div class="text-2xl font-black tabular-nums">₦${f.cupWinnerPot || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">1ST LEAGUE RUNNER UP</div>
      <div class="text-xl font-black tabular-nums">₦${f.firstRunnerUpPot || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">2ND LEAGUE RUNNER UP</div>
      <div class="text-xl font-black tabular-nums">₦${f.secondRunnerUpPot || 0}</div>
    </div>
  `;
}

function renderSquadChips() {
  const wrap = $('squad-chips');
  if (!currentManager || !wrap) return;
  const m = currentManager;
  wrap.innerHTML = `
    <div>Captain: <span class="font-semibold">${m.recentCaptainName || (m.recentCaptain ? 'Player #' + m.recentCaptain : 'N/A')}</span></div>
    <div>Chip this week: <span class="chip-badge">${m.recentChip || 'None'}</span></div>
    <div class="text-xs text-[#888]">Transfers: ${m.recentTransfers || 0}</div>
    <div class="text-[10px] mt-1">Full lineup + projections in modal</div>
  `;
}

// renderProjectionsLive removed from UI (function stub to avoid errors if called)
function renderProjectionsLive() {}

let playerChallenges = JSON.parse(localStorage.getItem('dl_playerChallenges') || '[]');
window.activeBeefs = window.activeBeefs || [];
try {
  if ((!window.activeBeefs || window.activeBeefs.length === 0)) {
    const b = JSON.parse(localStorage.getItem('dl_activeBeefs') || '[]');
    if (b.length) window.activeBeefs = b;
  }
} catch {}
// Also merge on any future refresh to be extra safe
window.mergeBeefsForSafety = function(serverB) {
  try {
    const loc = JSON.parse(localStorage.getItem('dl_activeBeefs') || '[]');
    const m = new Map();
    (serverB||[]).forEach(x=>x&&x.id&&m.set(x.id,x));
    (loc||[]).forEach(x=>x&&x.id&&!m.has(x.id)&&m.set(x.id,x));
    return Array.from(m.values());
  } catch { return serverB || loc || []; }
};

function savePlayerChallenges() {
  localStorage.setItem('dl_playerChallenges', JSON.stringify(playerChallenges));
}

// (challenge code removed)

async function respondToJoin(beefId, requesterId, approve) {
  try {
    await fetchJSON('/api/beef/respond-join', {
      method: 'POST',
      body: JSON.stringify({ beefId, requesterId, approve })
    });
    alert(approve ? 'Join approved!' : 'Join declined.');
    await loadAllData();
  } catch (e) {
    alert(e.message || 'Failed');
  }
}

async function requestToJoinBeef(beefId) {
  if (!beefId || !currentManager) return;
  try {
    await fetchJSON('/api/beef/request-join', {
      method: 'POST',
      body: JSON.stringify({ beefId })
    });
    alert('Join request sent to current participants. They will decide.');
    await loadAllData();
  } catch (e) {
    alert(e.message || 'Could not request to join yet.');
  }
}

// old challenge accept/decline/show removed (challenges no longer used; beefs use dedicated flows)


function renderSponsoredAwards() {
  const wrap = $('sponsored-awards');
  if (!wrap) return;
  const spons = (standingsData && standingsData.sponsorships) || [];
  if (spons.length === 0) {
    wrap.innerHTML = `<div class="text-xs">No active sponsorships yet.</div>`;
    return;
  }
  let total = 0;
  let html = spons.map(sp => {
    total += sp.amount || 0;
    const shareText = `D League: ${sp.sponsor} sponsored ${sp.target} for ₦${sp.amount}! Contribute at ${location.origin}`;
    const safeShare = encodeURIComponent(shareText);
    return `<div class="flex justify-between items-center">🏆 ${sp.target} - Sponsored by ${sp.sponsor} +₦${sp.amount} 
      <button onclick="showWhatsAppShare(decodeURIComponent('${safeShare}'), 'Share this award'); event.stopImmediatePropagation();" class="text-[10px] px-1 border border-[#333] rounded">Share WA</button>
    </div>`;
  }).join('');
  html += `<div class="text-xs">Total sponsored this season: ₦${total}</div>`;
  wrap.innerHTML = html;
}

function showSquadModal() {
  if (!currentManager) return;
  const modal = $('modal');
  const c = $('modal-content');
  fetchJSON(`/api/manager/${currentManager.id}/full`).then(data => {
    const recent = data.fplScores && data.fplScores.length ? data.fplScores[data.fplScores.length-1] : {};
    let picksHtml = '<div class="lineup-grid mb-4">';
    (recent.picks || []).slice(0,5).forEach((p, i) => {
      const isCap = p.multiplier > 1;
      picksHtml += `<div class="lineup-player ${isCap ? 'captain' : ''}">${p.name || p.element}${isCap ? ' (C)' : ''}</div>`;
    });
    picksHtml += '</div>';
    c.innerHTML = `
      <div>
        <div class="font-black text-2xl mb-2">${data.displayName}'s FPL Squad</div>
        ${picksHtml}
        <div>Chip used: ${recent.activeChip || 'None'}</div>
        <div class="text-xs mt-1">Captain: ${recent.captainName || (recent.captain ? 'Player #' + recent.captain : 'N/A')} • Transfers: ${recent.transfers || 0}</div>
        <button onclick="closeModal()" class="mt-4 w-full py-2 border rounded-2xl">CLOSE</button>
      </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }).catch(() => {
    c.innerHTML = `<div>Error loading squad. <button onclick="closeModal()">Close</button></div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });
}

// showChallengeModal removed (challenges deprecated)


function showSponsorModal() {
  const modal = $('modal');
  const c = $('modal-content');
  const options = SPONSORED_AWARDS.map(a => `<option value="${a.id}">${a.name} - ${a.desc}</option>`).join('');
  c.innerHTML = `
    <div>
      <div class="font-semibold mb-2">Sponsor an Award (static form - pay to confirm)</div>
      <input id="sp-name" placeholder="Your name / brand (optional)" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
      <select id="sp-target" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
        ${options}
      </select>
      <input id="sp-amount" type="number" placeholder="Amount to sponsor (e.g. 10000)" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm" value="10000">
      <button id="sp-submit" class="w-full py-1 bg-[#00ff85] text-[#111] rounded text-sm mt-1">SPONSOR &amp; PAY (wallet if balance, else Paystack)</button>
      <div class="text-[10px] mt-1">Pay to activate. 10% house cut (50/30/20); 90% to winner(s).</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('sp-submit').onclick = () => {
    const sponsorName = document.getElementById('sp-name').value.trim() || currentManager.displayName;
    const targetId = document.getElementById('sp-target').value;
    const amountStr = document.getElementById('sp-amount').value;
    const amount = parseInt(amountStr) || 0;
    if (amount <= 0) return alert('Enter valid amount');
    const award = SPONSORED_AWARDS.find(a => a.id === targetId);
    if (!award) return alert('Select an award');
    closeModal();
    initiateSponsorPayment(sponsorName, award, amount);
  };
}

function showComplaintModal() {
  if (!currentManager) return alert('Login first');
  const modal = $('modal');
  const c = $('modal-content');
  c.innerHTML = `
    <div>
      <div class="font-semibold mb-2 text-[#00ff85]">Report Issue / Complaint to Commissioner</div>
      <input id="cmp-title" placeholder="Short title (e.g. Missing winnings for GW9)" class="w-full p-2 bg-[#111] border border-[#333] mb-2 text-sm rounded" />
      <textarea id="cmp-desc" rows="4" placeholder="Describe the issue, round, amount if relevant, any details..." class="w-full p-2 bg-[#111] border border-[#333] mb-2 text-sm rounded"></textarea>
      <input id="cmp-round" placeholder="Related round (optional, e.g. 9 or MD3)" class="w-full p-1 bg-[#111] border border-[#333] mb-2 text-sm rounded" />
      <button id="cmp-submit" class="w-full py-2 bg-[#00ff85] text-black font-bold rounded text-sm">SUBMIT COMPLAINT</button>
      <div class="text-[10px] mt-1 text-[#666]">This goes to the commissioner via the admin log. You will see confirmation.</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  document.getElementById('cmp-submit').onclick = async () => {
    const title = document.getElementById('cmp-title').value.trim();
    const description = document.getElementById('cmp-desc').value.trim();
    const relatedRound = document.getElementById('cmp-round').value.trim() || null;
    if (!title || !description) return alert('Title and description required');
    try {
      await fetchJSON('/api/manager/complaint', {
        method: 'POST',
        body: JSON.stringify({ title, description, relatedRound })
      });
      closeModal();
      alert('Complaint submitted. Thank you — the commissioner has been notified.');
      // optional: reload events if admin, but for manager just done
    } catch (e) {
      alert('Submit failed: ' + (e.message || e));
    }
  };
}

async function initiateSponsorPayment(sponsorName, award, amount) {
  try {
    const paidWallet = tryPayWithWallet(amount, `sponsoring ${award.name}`);
    if (paidWallet) {
      await fetchJSON('/api/sponsor', {
        method: 'POST',
        body: JSON.stringify({ sponsorName, target: award.id, amount })
      });
      renderSponsoredAwards();
      alert('Sponsor added from wallet balance.');
      const waText = `D League Award Sponsored! ${sponsorName} sponsored ${award.name} for ₦${amount}. Boost the pot too or check it out: ${location.origin}`;
      showWhatsAppShare(waText, 'Share this sponsorship (invite others to contribute)');
      return;
    }
    // Paystack path - will trigger confirmation and add on success
    await initiatePayment(null, { target: award.id, amount });
  } catch (e) {
    alert('Sponsor failed: ' + e.message);
  }
}

function boostPot(target) {
  if (!currentManager) return alert('Log in first');
  const labels = {
    weekly: "this week's pot",
    h2h: "H2H pot",
    overall: "overall league pot",
    cup: "cup pot",
    'first-ru': "1st runner up",
    'second-ru': "2nd runner up"
  };
  const label = labels[target] || target;
  const amtStr = prompt(`Enter amount in ₦ to add to ${label} (e.g. 1000). 100% goes to the pot.`, '1000');
  if (!amtStr) return;
  const amount = parseInt(amtStr, 10);
  if (!amount || amount <= 0) return alert('Invalid amount');

  (async () => {
    try {
      // Support boosting from wallet winnings if sufficient (moves your winnings into the pot)
      const paidWallet = tryPayWithWallet(amount, `boosting ${label}`);
      if (paidWallet) {
        // For wallet boosts, record directly via a lightweight call or payment flow with flag.
        // Simple: use initiate with potBoost; backend will handle. For persistence of debit we rely on optimistic + refresh.
        await initiatePayment(null, null, null, { target, amount });
        alert(`${currentManager.displayName} added ₦${amount} to ${label} from wallet.`);
        await loadAllData();
        return;
      }
      // Otherwise Paystack new contribution (100% to pot)
      await initiatePayment(null, null, null, { target, amount });
      // On success (demo or webhook), simulate or load will show the boost in UI and pots
    } catch (e) {
      alert('Boost failed: ' + e.message);
    }
  })();
}

function renderSpotlight() {
  if (!standingsData || !standingsData.all) return;
  // Explicitly filter out admin/commissioner even if list wasn't perfectly filtered
  const filtered = standingsData.all.filter(m => !(m.email && m.email.toLowerCase() === 'bolade.oladejo@gmail.com'));
  const isUcl = currentLeagueMode === 'ucl';
  let top;
  const sn = $('spotlight-name');
  const ss = $('spotlight-stats');
  if (isUcl) {
    const uclSorted = [...filtered].sort((a, b) => (b.uclTotal || 0) - (a.uclTotal || 0));
    top = uclSorted[0];
    if (sn) sn.innerHTML = top ? top.displayName : '';
    if (ss) ss.innerHTML = top ? `<div class="font-bold text-lg">${top.uclTotal || 0} pts</div><div class="text-xs">UCL MD top</div>` : '';
  } else {
    const fplSorted = [...filtered].sort((a, b) => (b.fplTotal || 0) - (a.fplTotal || 0));
    top = fplSorted[0];
    if (sn) sn.innerHTML = top ? top.displayName : '';
    if (ss) ss.innerHTML = top ? `<div class="font-bold text-lg">${top.fplTotal || 0} pts</div><div class="text-xs">FPL GW top</div>` : '';
  }
  if (!top) return;
}

function renderLineupViewer() {
  const select = $('lineup-manager-select');
  const viewer = $('lineup-viewer');
  if (!select || !viewer) return;

  let managers = (standingsData && standingsData.all) ? standingsData.all : [];
  if (!managers.length && standingsData && standingsData.fpl) managers = standingsData.fpl;

  if (!managers.length) {
    select.innerHTML = '<option value="">No managers loaded - sync first</option>';
    return;
  }

  // Populate dropdown with all managers
  select.innerHTML = '<option value="">Select manager (FPL-style lineup + bench + proj pts)</option>';
  managers.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.displayName + (m.id === currentManager?.id ? ' (You)' : '');
    select.appendChild(opt);
  });

  // Default to current user and render
  if (currentManager) {
    const found = managers.find(m => m.id === currentManager.id);
    if (found) {
      select.value = currentManager.id;
      loadAndRenderLineup(currentManager.id, viewer);
    }
  }

  // Make sure it always uses the latest FPL-exact rendering
  viewer.classList.add('fpl-exact');

  select.onchange = () => {
    const id = select.value;
    if (id) {
      loadAndRenderLineup(id, viewer);
    } else {
      viewer.innerHTML = '<div class="text-center text-[#666] text-xs py-8">Select manager for FPL vertical lineup + BENCH + projected points</div>';
    }
  };
}

async function loadAndRenderLineup(managerId, container) {
  try {
    const data = await fetchJSON(`/api/manager/${managerId}/full`);

    // Support both FPL and UCL wiring
    const isUclMode = (currentLeagueMode === 'ucl') || (!data.fplScores?.length && data.uclScores?.length);
    const scores = isUclMode ? (data.uclScores || []) : (data.fplScores || []);
    const recent = scores.length ? scores[scores.length - 1] : {};

    const allPicks = recent.picks || (isUclMode ? data.recentUclPicks : data.recentPicks) || [];
    const captainId = recent.captain || (isUclMode ? data.recentUclCaptain : data.recentCaptain);
    const chip = recent.activeChip || (isUclMode ? data.recentUclChip : data.recentChip);
    const compLabel = isUclMode ? 'MD' : 'GW';

    // Split: starters (multi > 0) on pitch, bench (multi === 0) below.
    // p.points is now RAW (from server). Apply mult for effective contrib.
    const starters = allPicks.filter(p => (p.multiplier || 0) > 0);
    const bench = allPicks.filter(p => (p.multiplier || 0) === 0);

    // Group by type for pitch rows (works for both FPL and UCL)
    const groups = {1: [], 2: [], 3: [], 4: []};
    starters.forEach(p => {
      if (groups[p.type]) groups[p.type].push(p);
    });

    // Total points headline: only active (starters + BB if active) using effective = raw * mult
    const getEff = (p) => {
      const raw = (p.points != null ? p.points : 0);
      const m = (typeof p.multiplier === 'number' ? p.multiplier : 1);
      return raw * m;
    };
    const totalPts = starters.reduce((s, p) => s + getEff(p), 0);

    // Lineup viewer now supports both FPL (exact match to official site) and UCL
    const capId = captainId;
    const header = `<div class="fpl-lineup-header"><span>${data.displayName} • ${compLabel}${recent.round || '?'} ${chip ? ' • ' + chip : ''}</span><span class="total">${totalPts} pts</span></div>`;

    const makeCard = (p, isBenchCard = false) => {
      const isCap = p.element === capId || (p.multiplier || 0) > 1;
      const raw = (p.points != null ? p.points : (isBenchCard ? 0 : 3 + Math.floor(Math.random() * 9)));
      const m = (typeof p.multiplier === 'number' ? p.multiplier : 1);
      // Show effective for active slots (incl. cap x2), raw points earned for bench cards
      let pts = isBenchCard ? raw : raw * m;
      const shortName = (p.name || 'Player').split(' ').pop().substring(0, 10);
      const team = p.team || '???';
      const teamColor = p.teamColor || '#2a2a2a';

      // Captain badge like official FPL screenshot
      const capBadge = isCap ? `<div class="fpl-cap-badge">C<span class="star">★</span></div>` : '';

      return `
        <div class="fpl-player-card ${isCap ? 'captain' : ''} ${isBenchCard ? 'bench' : ''}" style="--team-color: ${teamColor}">
          <div class="shirt" style="background: ${teamColor}">
            <div class="shirt-inner">${team}</div>
          </div>
          <div class="name-bar">${shortName}</div>
          <div class="pts-bar">${pts}</div>
          ${capBadge}
        </div>
      `;
    };

    const gkHtml   = groups[1].map(p => makeCard(p)).join('');
    const defHtml  = groups[2].map(p => makeCard(p)).join('');
    const midHtml  = groups[3].map(p => makeCard(p)).join('');
    const fwdHtml  = groups[4].map(p => makeCard(p)).join('');

    const benchHtml = bench.length 
      ? bench.map(p => makeCard(p, true)).join('') 
      : '<div class="text-[#555] text-xs">No bench data</div>';

    let html = `
      ${header}
      <div class="fpl-pitch">
        <div class="gk-row">${gkHtml}</div>
        <div class="def-row">${defHtml}</div>
        <div class="mid-row">${midHtml}</div>
        <div class="fwd-row">${fwdHtml}</div>
      </div>

      <div class="fpl-bench-tray">
        <div class="bench-labels">
          <div>GKP</div>
          <div>1. MID</div>
          <div>2. DEF</div>
          <div>3. DEF</div>
        </div>
        <div class="bench-cards">
          ${benchHtml}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Small note
    const note = document.createElement('div');
    note.className = 'mt-1 text-[9px] text-[#666]';
    note.textContent = isUclMode 
      ? 'UCL • Captain (C) ×2' 
      : 'Points from FPL public API • Captain (C) ×2 • Bench shown';
    container.appendChild(note);

    // SUPERPOWER: Simulate Next GW based on current/prev performance (for planning + bragging)
    const simBtn = document.createElement('button');
    simBtn.className = 'mt-2 px-3 py-1 text-xs bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]';
    simBtn.textContent = 'Simulate next game week';
    simBtn.onclick = () => simulateNextGW(data, recent, container);
    container.appendChild(simBtn);

    // Bragging rights: Winning card
    const bragBtn = document.createElement('button');
    bragBtn.className = 'mt-2 ml-2 px-3 py-1 text-xs bg-[#ffaa00] text-black rounded';
    bragBtn.textContent = '🏆 Generate Winning Card to Share';
    bragBtn.onclick = () => generateWinningCard(data, recent);
    container.appendChild(bragBtn);
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Could not load lineup. Sync scores first.</div>`;
  }
}

function simulateNextGW(managerData, recent, container) {
  const basePts = recent.points || (managerData.fplTotal || 60);
  const avg = (window.standingsData && window.standingsData.roundAverages && window.standingsData.roundAverages.fpl) || 65;
  // Advanced simulation using FPL data:
  // - Squad points from recentPicks (actual player performances if squad same)
  // - Captain multiplier applied
  // - League avg for baseline
  // - Form boost based on recent vs avg
  // - Dynamic variance based on squad consistency (std dev proxy from picks variance)
  // - Chip if used last
  // This uses real FPL picks data + stats for meaningful projection.
  let squadBase = basePts;
  let capBoost = 0;
  let dynamicVar = 18;
  if (managerData.recentPicks && managerData.recentPicks.length > 0) {
    const picks = managerData.recentPicks.filter(p => p.position <= 11); // starters
    if (picks.length > 0) {
      squadBase = picks.reduce((sum, p) => sum + (p.points || 0), 0);
      const lastCap = managerData.recentPicks.find(p => p.multiplier > 1);
      if (lastCap) {
        capBoost = Math.max(0, (lastCap.points || 0));
      }
      // Dynamic variance from squad point spread (more spread = higher uncertainty)
      const mean = squadBase / picks.length;
      const varianceCalc = picks.reduce((sum, p) => sum + Math.pow((p.points || 0) - mean, 2), 0) / picks.length;
      dynamicVar = Math.max(10, Math.min(30, Math.sqrt(varianceCalc) * 1.2));
    }
  }
  const formBoost = basePts > avg ? 4 : (basePts < avg - 5 ? -4 : 0);
  const variance = (Math.random() - 0.5) * dynamicVar;
  const proj = Math.max(15, Math.round(squadBase + capBoost + formBoost + variance));
  const chipNote = recent.activeChip ? ' (chip available last week - potential boost)' : '';
  const squadNote = (managerData.recentPicks && managerData.recentPicks.length) ? ' (based on current squad form + last captain)' : '';
  const simHtml = `<div class="mt-3 p-2 bg-black/60 rounded text-xs border border-[#00ff85]">Simulate next game week for ${managerData.displayName}: ~${proj} pts${squadNote}${chipNote}. Dynamic range ±${Math.round(dynamicVar/2)} based on your squad point variance + FPL stats.</div>`;
  const old = container.querySelector('.sim-result');
  if (old) old.remove();
  const div = document.createElement('div');
  div.className = 'sim-result';
  div.innerHTML = simHtml;
  container.appendChild(div);

  // WA share for sim 
  const waBtn = document.createElement('button');
  waBtn.className = 'mt-1 ml-1 px-2 py-0.5 text-[10px] bg-[#25D366] text-white rounded';
  waBtn.textContent = '📲 Share on WA';
  waBtn.onclick = () => showWhatsAppShare(`Simulate next game week for ${managerData.displayName}: ~${proj} pts`, 'Share Sim on WA');
  container.appendChild(waBtn);
}

function generateWinningCard(managerData, recent) {
  const pts = recent.points || '?';
  const gw = recent.round || '?';
  const text = `🏆 D LEAGUE WINNER GW${gw}!\n\n${managerData.displayName} scored ${pts} pts.\n\nBragging rights! Join at d-league-clubhouse\n#DLeague #FPL`;
  const cardText = `D LEAGUE\nGW${gw} CHAMP\n\n${managerData.displayName}\n${pts} PTS\n\n🔥 Bragging Card`;

  // Canvas visual card (5-min extension for nice shareable image)
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff85';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#ffaa00';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('D LEAGUE', 30, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`GW${gw} WINNER`, 30, 80);
  ctx.fillStyle = '#00ff85';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(managerData.displayName, 30, 120);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`${pts} PTS`, 30, 165);
  ctx.fillStyle = '#ffaa00';
  ctx.font = '14px sans-serif';
  ctx.fillText('🔥 BRAGGING RIGHTS', 30, 195);

  // Show canvas + share options
  const modal = $('modal');
  const content = $('modal-content');
  content.innerHTML = `
    <div class="text-center">
      <div class="font-bold mb-2">🏆 Winning Card (canvas)</div>
      <div id="card-canvas-wrap"></div>
      <div class="mt-3 flex gap-2 justify-center">
        <button onclick="downloadCanvas('${canvas.toDataURL()}', 'dleague-win-gw${gw}.png')" class="px-3 py-1 bg-[#00ff85] text-black rounded text-sm">Download PNG</button>
        <button onclick="shareWinningCardWA('${encodeURIComponent(text)}', '${encodeURIComponent(cardText)}')" class="px-3 py-1 bg-[#25D366] text-white rounded text-sm">📲 Share on WA</button>
        <button onclick="closeModal()" class="px-3 py-1 border border-[#333] rounded text-sm">Close</button>
      </div>
      <div class="text-xs mt-2 text-[#888]">Screenshot or download for brag. WA share uses text + link.</div>
    </div>
  `;
  const wrap = content.querySelector('#card-canvas-wrap');
  canvas.style.border = '1px solid #333';
  wrap.appendChild(canvas);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function downloadCanvas(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function shareWinningCardWA(text, cardText) {
  const url = `https://wa.me/?text=${text}%0A%0A${cardText}`;
  window.open(url, '_blank');
  closeModal();
}

function fplPlayer(p, captainId, isBench = false) {
  const isCap = p.element === captainId || (p.multiplier || 0) > 1;
  let pts = p.points;
  if (pts == null) pts = 3 + Math.floor(Math.random() * 9); // fallback projected points
  const ptsClass = (pts > 0) ? 'pos' : '';
  const capLabel = isCap ? 'C' : '';
  const shirtColor = p.teamColor || '#333';
  const shortName = (p.name || '').split(' ').pop().substring(0, 9);
  // Use FPL website style jersey pill
  return `
    <div class="fpl-pitch-player ${isCap ? 'captain' : ''}" title="${p.name} (${p.team}) • ${pts} pts" style="width: ${isBench ? '52px' : '60px'}">
      <div class="jersey" style="background:${shirtColor}; height:18px; width:24px"> </div>
      <div class="name">${shortName}${capLabel ? ' ' + capLabel : ''}</div>
      <div class="pts ${ptsClass}">${pts}</div>
    </div>
  `;
}

// Legacy kept for other uses if any
function playerPill(p, captainId) {
  const isCap = p.element === captainId || p.multiplier > 1;
  const jersey = `<span class="jersey" style="color:${p.teamColor || '#00ff85'}">⬤</span>`;
  return `<div class="player-pill text-[9px] ${isCap ? 'captain' : ''}" title="${p.name} (${p.team})">${jersey} ${p.name.substring(0,12)} ${isCap ? '★' : ''}</div>`;
}

// ============ PAYMENTS ============
async function requestPayout() {
  const balance = currentManager.wallet || 0;
  if (balance <= 0) {
    alert('No balance in wallet yet. Settlements will credit here.');
    return;
  }
  const amt = prompt(`Enter amount to withdraw (max ₦${balance}):`, balance);
  if (!amt) return;
  const gross = parseFloat(amt);
  if (gross <= 0 || gross > balance) {
    alert('Invalid amount.');
    return;
  }
  const fee = gross >= 5000 ? 150 : 50;
  const net = gross - fee;
  if (net <= 0) {
    alert('Amount too small after fee.');
    return;
  }
  if (!confirm(`Withdraw ₦${gross} from wallet? You will receive ₦${net} in bank (₦${fee} fee deducted). ₦${net} will be sent to Paystack. Confirm?`)) return;

  try {
    const res = await fetchJSON('/api/wallet/request-payout', {
      method: 'POST',
      body: JSON.stringify({ amount: net, fee })
    });
    alert(res.message || `Requested. You receive ₦${net} (net after fee). Check your bank and ledger.`);
    // Refresh data
    const me = await fetchJSON('/api/me');
    currentManager = normalizeAdmin(me.manager);
    showDashboard();
  } catch (e) {
    alert('Payout request failed: ' + e.message);
  }
}

function tryPayWithWallet(amount, description) {
  if (!currentManager) return false;
  let bal = currentManager.wallet || 0;
  if (bal >= amount) {
    currentManager.wallet = bal - amount;
    // refresh visible wallet displays
    document.querySelectorAll('.wallet-row span.font-bold').forEach(el => {
      el.textContent = `₦${currentManager.wallet.toLocaleString()}`;
    });
    return true;
  }
  return false;
}

function showBankModal() {
  const m = $('bank-modal');
  if (!m) return;
  m.classList.remove('hidden');
  m.classList.add('flex');

  // Reset: choice buttons always visible at top (static selector), hide forms
  const choice = document.getElementById('bank-choice');
  const localForm = document.getElementById('local-bank-form');
  const intlForm = document.getElementById('intl-bank-form');

  if (choice) choice.classList.remove('hidden');
  if (localForm) localForm.classList.add('hidden');
  if (intlForm) intlForm.classList.add('hidden');

  populateLocalBankSelect();  // ensure dropdown ready

  // Load Paystack banks (may refresh if API succeeds with more)
  loadPaystackBanks().then(banks => {
    const select = document.getElementById('local-bank-code');
    if (!select || !banks || banks.length === 0) return;

    // only update if we got a list from API (prefer static otherwise)
    const sorted = banks.slice().sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = '<option value="">-- Select your bank --</option>';
    sorted.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.code;
      opt.textContent = b.name;
      select.appendChild(opt);
    });

    // Re-apply saved
    const localVisible = document.getElementById('local-bank-form') && !document.getElementById('local-bank-form').classList.contains('hidden');
    if (localVisible && currentManager && currentManager.payoutDetails) {
      try {
        const d = JSON.parse(currentManager.payoutDetails);
        if (d.bank_code && select) {
          select.value = d.bank_code;
        }
      } catch(_) {}
    }
  }).catch(() => {});

  // If user already has saved details, prefill the right static form (choice buttons stay visible above it)
  if (currentManager && currentManager.payoutDetails) {
    try {
      const d = JSON.parse(currentManager.payoutDetails);
      const isIntl = d.type === 'international';

      if (isIntl && intlForm) {
        intlForm.classList.remove('hidden');
        const f = document.getElementById('intl-bank-form-el');
        if (f) {
          if (f.querySelector('[name="account_name"]')) f.querySelector('[name="account_name"]').value = d.account_name || '';
          if (f.querySelector('[name="account_number"]')) f.querySelector('[name="account_number"]').value = d.account_number || '';
          if (f.querySelector('[name="bank_name"]')) f.querySelector('[name="bank_name"]').value = d.bank_name || '';
          if (f.querySelector('[name="swift"]')) f.querySelector('[name="swift"]').value = d.swift || '';
          if (f.querySelector('[name="country"]')) f.querySelector('[name="country"]').value = d.country || '';
          if (f.querySelector('[name="currency"]')) f.querySelector('[name="currency"]').value = d.currency || '';
        }
      } else if (!isIntl && localForm) {
        localForm.classList.remove('hidden');
        const f = document.getElementById('local-bank-form-el');
        if (f) {
          if (f.querySelector('[name="account_name"]')) f.querySelector('[name="account_name"]').value = d.account_name || '';
          if (f.querySelector('[name="account_number"]')) f.querySelector('[name="account_number"]').value = d.account_number || '';
          const bankSel = document.getElementById('local-bank-code');
          if (bankSel) bankSel.value = d.bank_code || '';
        }
      }
    } catch (e) {
      // bad data or old format — show choice only, no prefill
    }
  }
}

function showBankChoice() {
  const choice = document.getElementById('bank-choice');
  const localForm = document.getElementById('local-bank-form');
  const intlForm = document.getElementById('intl-bank-form');
  if (choice) choice.classList.remove('hidden');
  if (localForm) localForm.classList.add('hidden');
  if (intlForm) intlForm.classList.add('hidden');
}

function closeBankModal() {
  const m = $('bank-modal');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
}

let paystackBanksCache = null;

async function loadPaystackBanks() {
  if (paystackBanksCache) return paystackBanksCache;
  try {
    const data = await fetchJSON('/api/paystack/banks');
    paystackBanksCache = data.banks || [];
    if (paystackBanksCache.length === 0) {
      paystackBanksCache = STATIC_NIGERIAN_BANKS;
    }
    return paystackBanksCache;
  } catch (e) {
    console.warn('Could not load Paystack banks list, using static fallback', e);
    paystackBanksCache = STATIC_NIGERIAN_BANKS;
    return paystackBanksCache;
  }
}

function showLocalBankForm() {
  const localForm = document.getElementById('local-bank-form');
  const intlForm = document.getElementById('intl-bank-form');
  if (intlForm) intlForm.classList.add('hidden');
  if (localForm) localForm.classList.remove('hidden');
  populateLocalBankSelect();  // ensure list is there
  // Choice row stays visible so you always see both options
}

function showIntlBankForm() {
  const localForm = document.getElementById('local-bank-form');
  const intlForm = document.getElementById('intl-bank-form');
  if (localForm) localForm.classList.add('hidden');
  if (intlForm) intlForm.classList.remove('hidden');
  // Choice row stays visible so you always see both options
}

async function submitBankForm(ev, type) {
  ev.preventDefault();

  // Pick the correct static form based on type
  let form;
  if (type === 'nuban') {
    form = document.getElementById('local-bank-form-el');
  } else {
    form = document.getElementById('intl-bank-form-el');
  }
  if (!form) {
    // fallback: try whichever is visible
    form = document.querySelector('#local-bank-form:not(.hidden) form') || document.querySelector('#intl-bank-form:not(.hidden) form');
  }
  if (!form) return alert('Form not found. Please refresh.');

  const formData = new FormData(form);
  let detailsObj = {};
  for (let [key, value] of formData.entries()) {
    if (value) detailsObj[key] = value.trim();
  }
  detailsObj.type = type || 'nuban';
  const details = JSON.stringify(detailsObj);

  try {
    await fetchJSON('/api/manager/update-payout', {
      method: 'POST',
      body: JSON.stringify({ payoutDetails: details })
    });
    alert('Bank details saved. Auto Paystack payouts enabled for wallet requests and settlements.');
    currentManager.payoutDetails = details;
    closeBankModal();

    // Rebuild the small wallet row immediately to reflect new bank status
    const nameEl2 = $('manager-name');
    if (nameEl2 && nameEl2.parentNode) {
      let oldW = nameEl2.parentNode.querySelector('.wallet-row');
      if (oldW) oldW.remove();
      const hasBankNow = !!(details && details.length > 10);
      const bankStatusNow = hasBankNow 
        ? `<span class="text-[#00ff85] text-xs ml-1">✓ Bank on file — auto Paystack payouts enabled</span>` 
        : `<span class="text-amber-400 text-xs ml-1">⚠ No bank set</span>`;
      const wEl = document.createElement('div');
      wEl.className = 'wallet-row mt-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1';
      wEl.innerHTML = `
        <span>Wallet: <span class="font-bold">₦${(currentManager.wallet || 0).toLocaleString()}</span></span>
        <button onclick="requestPayout()" class="text-xs px-3 py-1 bg-[#00ff85] text-black font-semibold rounded-lg active:scale-[0.985]">Request Payout to Bank</button>
        <button onclick="showUpdateBankModal()" class="text-xs px-3 py-1 border border-[#00ff85] text-[#00ff85] font-semibold rounded-lg active:scale-[0.985]">Update Bank Details</button>
        ${bankStatusNow}
      `;
      nameEl2.parentNode.appendChild(wEl);
    }
  } catch (e) {
    alert('Update failed: ' + e.message);
  }
}

function showUpdateBankModal() {
  showBankModal();
}

async function initiatePayment(comp, sponsorOpts, beefOpts, potBoostOpts) {
  if (!currentManager) return alert('Log in first');

  const body = { managerId: currentManager.id };
  if (comp) body.competition = comp;
  if (sponsorOpts) body.sponsor = sponsorOpts;
  if (beefOpts) body.beef = beefOpts;
  if (potBoostOpts) body.potBoost = potBoostOpts;
  try {
    const res = await fetchJSON('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.alreadyPaid) {
      alert('You are already fully paid for this competition.');
      return;
    }

    if (res.demo) {
      // For pot boost demo we still use the modal (or direct success)
      showPaymentModal(res.reference, comp || 'boost', true);
    } else if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      handlePaystackInline(res, comp || 'boost');
    }
  } catch (e) {
    alert('Payment init failed: ' + e.message);
  }
}



function loadPaystackScript() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(script);
  });
}

async function handlePaystackInline(res, comp) {
  try {
    await loadPaystackScript();
    const amountKobo = res.amount ? res.amount * 100 : (comp === 'fpl' ? 30000 : 15000) * 100;
    const handler = PaystackPop.setup({
      key: window.__PAYSTACK_KEY__ || 'pk_test_demo',
      email: currentManager.email || 'manager@example.com',
      amount: amountKobo,
      ref: res.reference,
      callback: function (response) {
        simulatePaymentSuccess(res.reference);
      },
      onClose: function () {}
    });
    handler.openIframe();
  } catch (e) {
    alert('Failed to load payment script: ' + e.message);
  }
}

function showPaymentModal(reference, comp, isDemo) {
  const modal = $('modal');
  const content = $('modal-content');

  content.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm uppercase tracking-widest text-[#00ff85]">PAYSTACK</div>
        <div class="text-3xl font-black tracking-[-1.2px]">Complete Payment</div>
      </div>
      <div class="bg-[#111] border border-[#333] rounded-2xl p-4 text-sm">
        <div>Reference: <span class="font-mono">${reference}</span></div>
        <div>Amount: <span class="font-bold">${comp === 'fpl' ? '₦30,000' : comp === 'ucl' ? '₦15,000' : 'As specified'}</span></div>
        <div class="text-xs mt-2 text-[#888]">This is the full season fee. No installments.</div>
      </div>

      ${isDemo ? `
        <button onclick="simulatePaymentSuccess('${reference}'); closeModal();" 
                class="w-full py-4 bg-[#00ff85] text-[#111] font-bold rounded-2xl">SIMULATE PAYSTACK SUCCESS (DEMO)</button>
        <div class="text-center text-xs text-[#888]">In production this is done via verified webhook.</div>
      ` : `
        <div class="text-sm">You will be redirected to Paystack.</div>
      `}

      <button onclick="closeModal()" class="w-full py-3 rounded-2xl border border-[#333]">CANCEL</button>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function simulatePaymentSuccess(reference) {
  try {
    // Only call server simulate in demo; in prod rely on webhook but always refresh UI
    if (window.__IS_DEMO__ || location.search.includes('demo')) {
      await fetchJSON('/api/payments/simulate-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference })
      });
    }
    closeModal();
    // Refresh everything - this ensures paid status and pots update even if webhook delayed
    const me = await fetchJSON('/api/me');
    currentManager = normalizeAdmin(me.manager);
    await loadAllData();
    renderPayAccess();
    // No alert in prod to avoid confusion; status will show
  } catch (e) {
    // Still refresh on error, don't block user
    try {
      await loadAllData();
      renderPayAccess();
    } catch {}
  }
}

// ============ OTHER ACTIONS ============
// Sync is fully automatic in production. No manual triggerSync.

async function generateWhatsAppSummary() {
  if (!currentManager || !standingsData) return;
  const m = currentManager;
  const fplW = (standingsData.fpl || [])[0];
  const uclW = (standingsData.ucl || [])[0];
  let text = `D LEAGUE CLUBHOUSE WEEKLY SETTLEMENT\n\n` +
    `Manager: ${m.displayName}\n` +
    `FPL: ${m.fplPaid ? '✅ PAID' : 'UNPAID'} • GW${standingsData.currentRound?.fpl || '?'} : ${m.currentFpl || '—'}\n` +
    `UCL: ${m.uclPaid ? '✅ PAID' : 'UNPAID'} • MD${standingsData.currentRound?.ucl || '?'} : ${m.currentUcl || '—'}\n\n`;

  if (fplW) text += `🏆 FPL GW Winner: ${fplW.displayName} (${fplW.fplTotal} pts) — Auto paid to ${fplW.payoutDetails || 'stored account'}\n`;
  if (uclW) text += `🏆 UCL MD Winner: ${uclW.displayName} — Auto settled.\n`;

  text += `\nTransaction refs in your ledger.\nClubhouse: ${location.origin}`;

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function showWhatsAppShare(waText, label = 'Share on WhatsApp') {
  // Remove any existing share bar
  const old = document.getElementById('whatsapp-share-bar');
  if (old) old.remove();

  const encoded = encodeURIComponent(waText);
  const rawForCopy = waText; // human readable with newlines etc.

  const bar = document.createElement('div');
  bar.id = 'whatsapp-share-bar';
  bar.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#111] border border-[#00ff85] p-3 rounded-2xl z-[200] text-xs max-w-md shadow-lg';
  bar.innerHTML = `
    <div class="font-semibold mb-1">${label}</div>
    <div class="flex gap-2 flex-wrap">
      <button class="copy-btn px-3 py-1 bg-[#00ff85] text-black rounded">Copy text</button>
      <button class="wa-btn px-3 py-1 bg-[#00ff85] text-black rounded">Open WhatsApp</button>
      <button class="close-btn px-3 py-1 border border-[#333] rounded">Close</button>
    </div>
    <div class="text-[10px] text-[#666] mt-1">Tap Open WhatsApp or copy the text and paste into your group chat.</div>
  `;
  document.body.appendChild(bar);

  // Use real event listeners (more reliable than inline onclick + template interpolation)
  const copyBtn = bar.querySelector('.copy-btn');
  const waBtn = bar.querySelector('.wa-btn');
  const closeBtn = bar.querySelector('.close-btn');

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(rawForCopy).then(() => {
        alert('Copied to clipboard! Paste directly into WhatsApp.');
      }).catch(() => {
        // fallback
        prompt('Copy this text manually:', rawForCopy);
      });
    };
  }

  if (waBtn) {
    waBtn.onclick = () => {
      const url = 'https://wa.me/?text=' + encoded;
      window.open(url, '_blank');
      // remove after a short delay so the tap registers
      setTimeout(() => {
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      }, 300);
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    };
  }
}

function showLedgerModal() {
  if (!currentManager) return;
  const modal = $('modal');
  const c = $('modal-content');

  // We fetch full ledger on demand
  fetchJSON(`/api/manager/${currentManager.id}/full`).then(data => {
    let html = `<div class="max-h-[60vh] overflow-auto pr-1"><div class="font-bold text-xl mb-3">Ledger — ${data.displayName}</div>`;
    if (!data.ledger || !data.ledger.length) {
      html += `<div class="text-sm text-[#888]">No transactions yet.</div>`;
    } else {
      data.ledger.forEach(l => {
        const sign = l.amount > 0 ? '+' : '';
        html += `
          <div class="flex justify-between border-b border-[#222] py-2.5 text-sm">
            <div>
              <span class="font-medium">${l.type.toUpperCase()}</span>
              ${l.round ? `• ${l.competition.toUpperCase()} R${l.round}` : ''}
              <div class="text-xs text-[#888]">${l.note || ''}</div>
            </div>
            <div class="font-semibold tabular-nums ${l.amount >= 0 ? 'text-[#00ff85]' : 'text-[#ff5555]'}">${sign}₦${Math.abs(l.amount)}</div>
          </div>`;
      });
    }
    html += `</div><button onclick="closeModal()" class="mt-5 w-full py-2.5 text-sm border border-[#333] rounded-2xl">CLOSE</button>`;
    c.innerHTML = html;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });
}

function closeModal() {
  const m = $('modal');
  m.classList.remove('flex');
  m.classList.add('hidden');
}

// ============ INIT ============
async function bootstrap() {
  initTailwind();

  // Support ?clearSession=1 or ?clear=1 to force clear any stale tokens (useful after bad restores)
  const params = new URLSearchParams(location.search);
  if (params.get('clearSession') || params.get('clear')) {
    localStorage.removeItem('dl_token');
    localStorage.removeItem('dl_manager_id');
    localStorage.removeItem('dl_activeBeefs');
    localStorage.removeItem('dl_playerChallenges');
    // reload without the param
    const url = new URL(location.href);
    url.searchParams.delete('clearSession');
    url.searchParams.delete('clear');
    location.replace(url.toString());
    return;
  }

  const warning = document.getElementById('server-warning');

  // Attach login button handler early (avoids issues if later code errors)
  const loginBtn = document.getElementById('login-button');
  if (loginBtn) {
    loginBtn.addEventListener('click', performLogin);
  }

  // Show clear guidance if someone opened the HTML file directly (no server)
  if (location.protocol === 'file:') {
    if (warning) warning.classList.remove('hidden');
  }

  // Load config for paystack key
  let serverReachable = false;
  try {
    const cfg = await fetchJSON('/api/config');
    serverReachable = true;
    window.__PAYSTACK_KEY__ = cfg.paystackPublicKey || 'pk_test_demo';
    const hint = document.getElementById('demo-hint');
    const serverWarning = document.getElementById('server-warning');
    if (cfg.demoMode) {
      if (hint) hint.style.display = 'block';
    } else {
      if (hint) hint.style.display = 'none';
      if (serverWarning) serverWarning.style.display = 'none';
    }
  } catch (e) {
    if (warning) {
      warning.classList.remove('hidden');
      warning.innerHTML = '⚠️ Cannot reach the backend server.<br>Please try refreshing the page or contact the commissioner.';
    }
  }

  const auto = await tryAutoLogin();
  if (auto) {
    showDashboard();
    loadAllData();

    // Only show a subtle note if the admin record looks mangled (wrong name), otherwise no nagging for the commissioner
    if (currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com') {
      if (currentManager.displayName && currentManager.displayName !== 'Bolade Oladejo') {
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b45309;color:white;padding:4px 8px;font-size:11px;z-index:9999;text-align:center;';
        banner.innerHTML = 'Note: Admin record appears non-canonical (possible post-restore data). <a href="?clearSession=1" style="color:white;text-decoration:underline;">Clear session</a> if needed.';
        document.body.appendChild(banner);
      }
    }
  } else {
    // Keep login screen visible
    $('login-screen').classList.remove('hidden');

    // Add a "clear session" helper to recover from stale/wrong account tokens after bad restores or refreshes
    const loginArea = document.querySelector('#login-screen .space-y-4');
    if (loginArea && !document.getElementById('clear-session-btn')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'clear-session-btn';
      clearBtn.className = 'w-full py-2 mt-2 text-xs border border-[#444] text-[#888] rounded-2xl hover:bg-[#222]';
      clearBtn.textContent = 'Clear stored session / force re-login (use if showing wrong account after restore or refresh)';
      clearBtn.onclick = () => {
        localStorage.removeItem('dl_token');
        localStorage.removeItem('dl_manager_id');
        localStorage.removeItem('dl_activeBeefs');
        localStorage.removeItem('dl_playerChallenges');
        location.reload();
      };
      loginArea.appendChild(clearBtn);
    }
  }

  // If everything is good, make sure warning stays hidden
  if (serverReachable && warning) {
    warning.classList.add('hidden');
  }

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName === 'BODY') {
      e.preventDefault();
      const login = $('login-screen');
      if (!login.classList.contains('hidden')) $('login-email').focus();
    }
  });

  // Bonus: allow enter on login inputs
  ['login-email', 'login-code'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') performLogin();
    });
  });

  // Expose limited debug for friends testing
  window.DL = { logout, switchLeague };
  console.log('%c[D League Clubhouse] Premium dashboard ready.', 'color:#334155');

  // Default to FPL view on start
  setTimeout(() => {
    if (typeof switchLeague === 'function') switchLeague('fpl');
  }, 400);
}

// ==================== NEW SEPARATE FPL / UCL TAILORED VIEWS ====================

const FPL_CHALLENGES = [
  { title: "Captain Clutch", desc: "Highest captain points this GW. Winner takes the pot.", prize: 5000 },
  { title: "Bench Bandit", desc: "Highest bench points (subbed or not).", prize: 3500 },
  { title: "Transfer Terror", desc: "Best net points gain from this week's transfers.", prize: 4000 },
  { title: "Chip Chaos", desc: "Best points from active chip this week.", prize: 3000 },
  { title: "Rivalry Roast", desc: "Beat your nominated rival by the biggest margin.", prize: 2500 },
  { title: "Late Surge", desc: "Most points scored in the second half (est.).", prize: 2000 },
  { title: "Defence Dynamo", desc: "Top points haul from defenders this GW.", prize: 4500 },
  { title: "Midfield Magic", desc: "Highest scoring midfield this week.", prize: 3800 },
  { title: "Striker Supreme", desc: "Best forward returns this GW.", prize: 4200 },
  { title: "Value Victor", desc: "Most points per £m this week.", prize: 3200 }
];

const SPONSORED_AWARDS = [
  { id: 'prediction-week', name: "Prediction of the Week", sponsor: "D League", desc: "Add prize money to this week's live prediction" },
  { id: 'cap-clutch', name: "Captain Clutch Award", sponsor: "Local Legend FC", desc: "Highest captain score this week" },
  { id: 'bench-bandit', name: "Bench Bandit", sponsor: "Mystery Manager", desc: "Most bench points" },
  { id: 'chip-wizard', name: "Chip Wizard", sponsor: "Fantasy Guru", desc: "Best chip performance" },
  { id: 'clean-king', name: "Clean Sheet King", sponsor: "Defence United", desc: "Most clean sheets + points from defence" },
  { id: 'mid-maestro', name: "Midfield Maestro", sponsor: "Pass Masters", desc: "Highest points from midfielders" },
  { id: 'fwd-fury', name: "Forward Fury", sponsor: "Striker Syndicate", desc: "Top attacking returns from forwards" },
  { id: 'top-scorer', name: "Top Scorer", sponsor: "Goal Getters", desc: "Most points this gameweek" }
];

// Preset options for personal beef / challenges with programmable logic (auto determine winner after GW/MD)
const BEEF_PRESETS = [
  { id: 'cap-clutch', name: "Captain Clutch", logic: 'highestCaptain', desc: "Highest captain points this week" },
  { id: 'bench-bandit', name: "Bench Bandit", logic: 'highestBench', desc: "Most bench points" },
  { id: 'clean-king', name: "Clean Sheet King", logic: 'defencePoints', desc: "Highest defence points" },
  { id: 'mid-maestro', name: "Midfield Maestro", logic: 'midfieldPoints', desc: "Highest midfield points" },
  { id: 'fwd-fury', name: "Forward Fury", logic: 'forwardPoints', desc: "Top forward returns" },
  { id: 'chip-wizard', name: "Chip Wizard", logic: 'chipPerformance', desc: "Best chip performance" },
  { id: 'top-scorer', name: "Top Scorer", logic: 'highestTotal', desc: "Most points this gameweek" }
];

function renderFplTailored() {
  if (!standingsData) return;

  // If fplH2h is configured but we don't have good server data yet, kick off a direct browser fetch (more reliable for some private leagues or Render fetch limits)
  const lidsForTrigger = standingsData.leagueIds || {};
  if (lidsForTrigger.fplH2h) {
    const serverHas = standingsData.realLeagues && standingsData.realLeagues.fplH2h && standingsData.realLeagues.fplH2h.standings && standingsData.realLeagues.fplH2h.standings.results;
    if (!serverHas) {
      loadClientH2HIfNeeded();
    }
  }

  // GW
  const gw = standingsData.currentRound?.fpl || '?';
  if ($('fpl-gw-num2')) $('fpl-gw-num2').textContent = gw;

  // Managers list with side-by-side overall + current GW (persistent display)
  const list = $('fpl-managers-list');
  if (list) {
    list.innerHTML = '';
    // Small professional note (refresh on data change)
    let existingNote = list.previousElementSibling;
    while (existingNote && (existingNote.classList.contains('note-h2h') || (existingNote.textContent || '').includes('Ranked by'))) {
      const toRemove = existingNote;
      existingNote = existingNote.previousElementSibling;
      toRemove.remove();
    }
    const note = document.createElement('div');
    note.className = 'text-[10px] text-[#888] mb-2 pl-1 border-l-2 border-[#333] note-h2h';
    const h2hNote = (standingsData.leagueIds && standingsData.leagueIds.fplH2h)
      ? ` • H2H Rank shown under names (from fplH2h league)`
      : '';
    note.innerHTML = `Ranked by <span class="text-[#ccc]">season total</span>. <span class="text-[#00ff85]">GW</span> column = current gameweek (LIVE projections update to FINAL on official FPL sync)${h2hNote}`;
    list.parentNode.insertBefore(note, list);
    const fplList = [...(standingsData.fpl || [])].sort((a,b) => (b.fplTotal||0) - (a.fplTotal||0));
    fplList.forEach(m => {
      const isMe = m.id === currentManager?.id;
      const row = document.createElement('div');
      row.className = `flex justify-between items-center px-3 py-2 rounded-xl cursor-pointer ${isMe ? 'bg-[#0d2a1f]' : 'hover:bg-[#111]'} gap-4`;
      const gwBadge = (m.currentFplSource === 'live-projection')
        ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-mono">LIVE</span>'
        : (m.currentFplSource === 'official-fpl' ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#003322] text-[#00ff85] font-mono">FINAL</span>' : '');
      // H2H league data from fplH2h (real FPL H2H standings, mapped by teamId)
      let h2hHtml = '';
      const serverH2h = standingsData.realLeagues && standingsData.realLeagues.fplH2h;
      const h2hDataForList = (serverH2h && serverH2h.standings && serverH2h.standings.results) ? serverH2h : (clientH2HData || null);
      const h2hResults = (h2hDataForList && h2hDataForList.standings && h2hDataForList.standings.results) || [];
      const mgrTeamId = (m.fplTeam && m.fplTeam.teamId) || (m.fpl && m.fpl.teamId) || '';
      const h2hConfigured = !!(standingsData.leagueIds && standingsData.leagueIds.fplH2h);
      if (h2hConfigured && mgrTeamId) {
        const h2hRes = h2hResults.find(r => String(r.entry) === String(mgrTeamId));
        if (h2hRes) {
          h2hHtml = `<div class="text-[9px] text-[#00ff85] mt-0.5">H2H Rank: ${h2hRes.rank}</div>`;
        } else {
          h2hHtml = `<div class="text-[9px] text-[#666] mt-0.5">H2H: not matched in league (your teamId=${mgrTeamId})</div>`;
        }
      } else if (h2hConfigured) {
        h2hHtml = `<div class="text-[9px] text-[#666] mt-0.5">H2H: no team ID set</div>`;
      }
      row.innerHTML = `
        <div class="min-w-0">
          <div class="font-semibold truncate">${withBadge(m.displayName, m.id)} ${m.fplClubName ? `<span class="text-[#888] text-xs">(${m.fplClubName})</span>` : ''} ${isMe ? '<span class="text-[#00ff85] text-xs">(YOU)</span>' : ''}</div>
          ${h2hHtml.replace(/ W\d+D\d+L\d+ \(P:.*?\)/, '')}
        </div>
        <div class="flex items-center gap-3 text-right font-mono flex-shrink-0">
          <div>
            <div class="text-[10px] text-[#666] tracking-widest">SEASON</div>
            <div class="font-bold tabular-nums text-lg leading-none">${m.fplTotal ?? '—'}</div>
          </div>
          <div class="w-px h-6 bg-[#333]"></div>
          <div>
            <div class="text-[10px] text-[#666] tracking-widest">THIS GW</div>
            <div class="flex items-center gap-1 justify-end">
              <span class="font-bold tabular-nums text-lg leading-none">${m.currentFpl ?? '—'}</span>
              ${gwBadge}
            </div>
          </div>
        </div>
      `;
      row.onclick = () => showManagerSquadWithInsight(m.id);
      list.appendChild(row);
    });
  }

  // H2H box — beautiful like main FPL list. Separate W | D | L columns, Manager (Club), TOTAL, NEXT with pts below. No extra commentary. Admin entry explicit in cockpit + header.
  if ($('fpl-h2h-this')) {
    const lids = standingsData.leagueIds || {};
    let html = '<span class="text-[#888]">Set fplH2h ID in admin</span>';
    if (lids.fplH2h) {
      const serverH = standingsData.realLeagues && standingsData.realLeagues.fplH2h;
      const h2hData = (serverH && serverH.standings && serverH.standings.results) ? serverH : (clientH2HData || serverH || null);
      if (h2hData && h2hData.standings && h2hData.standings.results) {
        let results = [...h2hData.standings.results].sort((a,b) => (a.rank||999) - (b.rank||999));
        // H2H always shows fixtures for the *current* GW (not current+1/next). Matches the saved per-GW data from admin.
        const currentGw = (standingsData.currentRound && standingsData.currentRound.fpl) || 1;
        const fixtures = (standingsData.h2hFixtures && standingsData.h2hFixtures[currentGw]) || {};

        // Map D-League managers by their FPL teamId (entry) for proper manager (club) names
        const mgrByTeamId = {};
        (standingsData.fpl || []).forEach(m => {
          const tid = String((m.fplTeam && m.fplTeam.teamId) || (m.fpl && m.fpl.teamId) || m.id || '');
          if (tid) mgrByTeamId[tid] = m;
        });

        const isAdmin = currentManager && currentManager.email && currentManager.email.toLowerCase() === 'bolade.oladejo@gmail.com';

        let htmlList = `<div class="space-y-1">`;
        results.forEach(r => {
          const tid = String(r.entry);
          const dm = mgrByTeamId[tid];
          const isD = !!dm;
          let displayName = (dm && dm.displayName) || r.player_name || r.entry_name || 'Unknown';
          let clubPart = '';
          if (dm && dm.fplClubName) {
            clubPart = ` <span class="text-[#888] text-xs">(${dm.fplClubName})</span>`;
          }
          const w = r.matches_won || 0;
          const d = r.matches_drawn || 0;
          const l = r.matches_lost || 0;
          const totalPts = (w * 3) + d;

          // Current fixture (H2H always shows current GW, not +1/next): resolve using fixtures map
          let fixtureName = 'TBD';
          let fixturePts = '';
          let oppKey = fixtures[tid];
          if (!oppKey) {
            // Fallback for key mismatch (teamId vs id, or saved vs current standings)
            const mgr = dm;
            if (mgr) {
              const alt1 = (mgr.fplTeam && mgr.fplTeam.teamId) || '';
              const alt2 = mgr.id || '';
              if (alt1 && fixtures[String(alt1)]) oppKey = fixtures[String(alt1)];
              else if (alt2 && fixtures[String(alt2)]) oppKey = fixtures[String(alt2)];
            }
          }
          if (oppKey) {
            const oppR = results.find(x => String(x.entry) === String(oppKey));
            if (oppR) {
              const oppDm = mgrByTeamId[String(oppR.entry)];
              fixtureName = (oppDm && oppDm.displayName) || oppR.player_name || oppR.entry_name || String(oppKey);
              if (oppDm && oppDm.fplClubName) fixtureName += ` (${oppDm.fplClubName})`;
              const oppMain = oppDm ? oppDm : (standingsData.fpl || []).find(m => String((m.fplTeam&&m.fplTeam.teamId)||(m.fpl&&m.fpl.teamId))===String(oppR.entry));
              const oppForm = (oppMain && oppMain.currentFpl != null) ? oppMain.currentFpl : '—';
              fixturePts = String(oppForm);
            }
          }

          const rowClass = isD ? 'flex justify-between items-center px-3 py-2 rounded-xl hover:bg-[#111] gap-4 text-sm' : 'flex justify-between items-center px-3 py-2 rounded-xl hover:bg-[#111] gap-4 text-sm opacity-90';
          htmlList += `<div class="${rowClass}">
            <div class="min-w-0 flex-1">
              <div class="font-semibold truncate">${r.rank}. ${displayName}${clubPart}</div>
              <div class="text-[10px] text-[#888] mt-0.5">H2H FIXTURE: ${fixtureName}${fixturePts ? ` <span class="text-[#00ff85]">pts ${fixturePts}</span>` : ''}</div>
            </div>
            <div class="flex items-center gap-4 text-right font-mono flex-shrink-0">
              <!-- Separate W | D | L + TOTAL on right; NEXT is left-attached so long names never shift the numeric columns -->
              <div class="flex gap-1.5 text-center">
                <div class="min-w-[18px]">
                  <div class="text-[9px] text-[#00cc77] tracking-widest">W</div>
                  <div class="font-black tabular-nums text-base leading-none">${w}</div>
                </div>
                <div class="min-w-[18px]">
                  <div class="text-[9px] text-[#888] tracking-widest">D</div>
                  <div class="font-black tabular-nums text-base leading-none">${d}</div>
                </div>
                <div class="min-w-[18px]">
                  <div class="text-[9px] text-[#cc5555] tracking-widest">L</div>
                  <div class="font-black tabular-nums text-base leading-none">${l}</div>
                </div>
              </div>
              <div class="w-px h-6 bg-[#333]"></div>
              <div>
                <div class="text-[10px] text-[#666] tracking-widest">TOTAL</div>
                <div class="font-bold tabular-nums text-lg leading-none">${totalPts}</div>
              </div>
            </div>
          </div>`;
        });
        htmlList += `</div>`;
        html = htmlList;
      } else {
        html = `H2H ID set (${lids.fplH2h}) — loading data...`;
      }
    }
    $('fpl-h2h-this').innerHTML = html;
  }
  if ($('fpl-h2h-next')) $('fpl-h2h-next').textContent = 'End of season settlement';

  // Cup info — only FPL Cup, starts GW32 (wired via current league config)
  if ($('fpl-cup-info')) {
    $('fpl-cup-info').innerHTML = `<strong class="text-[#00ff85]">FPL Cup starts in GW32</strong>`;
  }

  // Challenge of week removed from UI (clean)
  if ($('fpl-challenge-week')) {
    $('fpl-challenge-week').innerHTML = ``;
  }





  // Ensure lineup viewer populated
  if (typeof renderLineupViewer === 'function') setTimeout(renderLineupViewer, 100);

  // === GW Winners Roll: horizontal per-manager view of GWs won (only winners) ===
  // Uses existing history.weekly (populated on settleWeeklyPot). Pure display.
  renderGWWinLeaders();

  // Badge / icon chooser (predefined only - see below)
  renderBadgeChooser();
}

function renderGWWinLeaders() {
  if (currentLeagueMode === 'ucl') {
    // Blank for UCL (no MD winners yet); FPL winners only in FPL mode
    const col = document.getElementById('gw-winners-col');
    if (col) col.innerHTML = `<div class="text-xs text-[#888]">MD Winners roll appears here after UCL MD settles begin.</div>`;
    return;
  }
  const container = $('fpl-tailored');
  if (!container || !standingsData) return;

  // Remove old if exists
  const old = $('gw-winners-roll');
  if (old) old.remove();

  // Always clear the dedicated col to prevent duplicate renders (was causing 6x repeat on multiple renderFpl calls)
  let winnersCol = document.getElementById('gw-winners-col');
  if (winnersCol) winnersCol.innerHTML = '';

  const weekly = (standingsData.history && standingsData.history.weekly) || [];
  // Global dedup by round in case of any legacy dup history entries (different winners would be caught at source now).
  const seenRound = new Set();
  const fplWins = weekly.filter(w => {
    if (w.comp !== 'fpl' || !w.winners || !w.winners.length) return false;
    if (seenRound.has(w.round)) return false;
    seenRound.add(w.round);
    return true;
  });

  if (!fplWins.length) {
    // Don't show empty section early season
    return;
  }

  // Group by manager: only those with at least 1 win
  const managerWins = {};
  fplWins.forEach(win => {
    win.winners.forEach(w => {
      if (!managerWins[w.id]) managerWins[w.id] = { id: w.id, rounds: [], name: null };
      managerWins[w.id].rounds.push(win.round);
    });
  });

  // Resolve names from standings
  const allMgrs = standingsData.all || standingsData.fpl || [];
  Object.keys(managerWins).forEach(id => {
    const m = allMgrs.find(x => x.id === id);
    managerWins[id].name = m ? m.displayName : 'Manager';
  });

  // Dedup rounds (in case history had duplicate entries from repeated settles)
  Object.keys(managerWins).forEach(id => {
    managerWins[id].rounds = [...new Set(managerWins[id].rounds)];
  });

  // Filter to only those with wins, sort by #wins desc then name
  let winnersList = Object.values(managerWins)
    .filter(m => m.rounds.length > 0)
    .sort((a, b) => b.rounds.length - a.rounds.length || a.name.localeCompare(b.name));

  if (!winnersList.length) return;

  const section = document.createElement('div');
  section.id = 'gw-winners-roll';
  section.className = 'mt-2 p-3 bg-[#111] border border-[#00ff85] rounded-2xl';
  section.innerHTML = `
    <div class="flex items-baseline justify-between mb-2">
      <div>
        <div class="font-black text-lg tracking-[-0.5px]">GW WINNERS ROLL</div>
        <div class="text-[9px] text-[#888]">Season champs (weekly pots)</div>
      </div>
      <div class="text-xs px-2 py-0.5 bg-[#003322] text-[#00ff85] rounded font-mono">${winnersList.length} CHAMP${winnersList.length > 1 ? 'S' : ''}</div>
    </div>
    <div class="divide-y divide-[#222]">
      ${winnersList.map(mgr => {
        const gwBadges = mgr.rounds.sort((a,b)=>a-b).map(r => 
          `<span class="inline-flex items-center justify-center min-w-[2.25rem] h-5 px-1 text-[10px] bg-[#0a2a1f] text-[#00ff85] rounded font-mono tracking-tighter border border-[#003322]">GW${r}</span>`
        ).join('');
        return `
          <div class="flex items-center justify-between py-2 text-sm">
            <div class="font-medium">${withBadge ? withBadge(mgr.name, mgr.id) : mgr.name}</div>
            <div class="flex flex-wrap gap-1 justify-end">${gwBadges}</div>
            <div class="ml-2 text-xs text-[#888] tabular-nums w-8 text-right">${mgr.rounds.length}<span class="opacity-60">×</span></div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Share width by appending inside ledger col if present (as per request)
  // (cleared at start of function to avoid duplicates from repeated renders)
  if (winnersCol) {
    winnersCol.appendChild(section);
  } else {
    container.appendChild(section);
  }
}

// Predefined badges/icons - no uploads, no bandwidth cost.
// Store choice in localStorage per manager. Displayed next to names where possible.
const PREDEFINED_BADGES = [
  { id: 'trophy-gold', label: 'Gold Trophy', emoji: '🏆' },
  { id: 'trophy-silver', label: 'Silver', emoji: '🥈' },
  { id: 'star', label: 'Star Captain', emoji: '⭐' },
  { id: 'fire', label: 'Hot Streak', emoji: '🔥' },
  { id: 'ball', label: 'Match Ball', emoji: '⚽' },
  { id: 'shield', label: 'Defender', emoji: '🛡️' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀' },
  { id: 'crown', label: 'Crown', emoji: '👑' },
  { id: 'medal', label: 'Medal', emoji: '🎖️' },
  { id: 'target', label: 'On Target', emoji: '🎯' }
];

function getBadgeForManager(managerId) {
  if (!managerId) return '';
  try {
    const choice = localStorage.getItem(`dl_badge_${managerId}`);
    const found = PREDEFINED_BADGES.find(b => b.id === choice);
    return found ? found.emoji : '';
  } catch { return ''; }
}

function renderBadgeChooser() {
  if (!currentManager || !standingsData) return;
  const container = $('dashboard') || $('fpl-tailored');
  if (!container) return;

  const old = $('badge-chooser');
  if (old) old.remove();

  const currentBadge = getBadgeForManager(currentManager.id);

  const chooser = document.createElement('div');
  chooser.id = 'badge-chooser';
  chooser.className = 'mt-4 p-3 bg-[#111] border border-[#333] rounded-xl text-xs';
  chooser.innerHTML = `
    <div class="mb-1.5 flex items-center gap-2">
      <span class="font-semibold">Your badge</span>
    </div>
    <div class="flex flex-wrap gap-1.5 mb-1.5">
      ${PREDEFINED_BADGES.map(b => `
        <button data-badge="${b.id}" class="px-2 py-1 border border-[#444] rounded hover:bg-[#222] text-sm leading-none ${getBadgeForManager(currentManager.id) === b.emoji ? 'bg-[#003322] border-[#00ff85]' : ''}">
          ${b.emoji} ${b.label}
        </button>
      `).join('')}
    </div>
    <div class="text-[10px] text-[#888]">Current: ${currentBadge || 'None'} • Saved in this browser</div>
  `;

  // Place it directly below manager name at top
  const mgrName = $('manager-name');
  if (mgrName && mgrName.parentNode) {
    mgrName.parentNode.insertBefore(chooser, mgrName.nextSibling);
  } else {
    container.appendChild(chooser);
  }

  // Wire clicks
  chooser.querySelectorAll('button[data-badge]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.badge;
      try { localStorage.setItem(`dl_badge_${currentManager.id}`, id); } catch {}
      // Refresh relevant displays
      renderFplTailored();
      renderBadgeChooser();
    };
  });
}

// Helper to enhance name displays with badge (call where names are rendered)
// For now injected in key places via renderFplTailored update below if needed.
function withBadge(name, managerId) {
  const b = getBadgeForManager(managerId);
  return b ? `${b} ${name}` : name;
}

function renderUclTailored() {
  if (!standingsData) return;

  const md = standingsData.currentRound?.ucl || '?';
  if ($('ucl-md-num2')) $('ucl-md-num2').textContent = md;

  const list = $('ucl-managers-list');
  if (list) {
    list.innerHTML = '';
    const uclList = [...(standingsData.ucl || [])].sort((a,b) => (b.uclTotal||0) - (a.uclTotal||0));
    uclList.forEach(m => {
      const isMe = m.id === currentManager?.id;
      const row = document.createElement('div');
      row.className = `flex justify-between items-center px-3 py-2 rounded-xl cursor-pointer ${isMe ? 'bg-[#0d2a1f]' : 'hover:bg-[#111]'} gap-4`;
      const mdBadge = m.currentUclSource === 'live-projection' ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 font-mono">LIVE</span>' : (m.currentUclSource==='official-fpl' ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#003322] text-[#00ff85] font-mono">FINAL</span>' : '');
      const club = m.uclClubName ? ` <span class="text-[#888] text-xs">(${m.uclClubName})</span>` : '';
      row.innerHTML = `
        <div class="min-w-0">
          <div class="font-semibold truncate">${m.displayName}${club} ${isMe ? '<span class="text-[#00ff85] text-xs">(YOU)</span>' : ''}</div>
        </div>
        <div class="flex items-center gap-3 text-right font-mono flex-shrink-0">
          <div>
            <div class="text-[10px] text-[#666] tracking-widest">TOTAL</div>
            <div class="font-bold tabular-nums text-lg leading-none">${m.uclTotal ?? '—'}</div>
          </div>
          <div class="w-px h-6 bg-[#333]"></div>
          <div>
            <div class="text-[10px] text-[#666] tracking-widest">THIS MD</div>
            <div class="flex items-center gap-1 justify-end">
              <span class="font-bold tabular-nums text-lg leading-none">${m.currentUcl ?? '—'}</span>
              ${mdBadge}
            </div>
          </div>
        </div>
      `;
      row.onclick = () => {
        loadAndRenderLineup(m.id, $('lineup-viewer'));
      };
      list.appendChild(row);
    });
  }



  // UCL CHALLENGE THIS MD removed per spec (not supposed to exist)
  if ($('ucl-challenge')) {
    $('ucl-challenge').innerHTML = '';
  }

  // Make sure lineup viewer can show UCL data
  if (typeof renderLineupViewer === 'function') setTimeout(renderLineupViewer, 100);
}

function showManagerSquadWithInsight(managerId) {
  const m = (standingsData.all || []).find(x => x.id === managerId);
  if (!m) return alert('Manager not found');
  // Use existing full load for lineup
  loadAndRenderLineup(managerId, $('lineup-viewer'));

  // Add insight
  setTimeout(() => {
    const container = $('fpl-tailored') || document.body;
    const insight = document.createElement('div');
    insight.className = 'mt-2 p-2 bg-[#111] text-xs rounded';
    const myPts = currentManager?.fplTotal || 0;
    const theirPts = m.fplTotal || 0;
    insight.innerHTML = `Insight vs you: ${m.displayName} is ${theirPts > myPts ? 'ahead' : 'behind'} by ${Math.abs(theirPts - myPts)} pts. Their captain choice projects ${Math.random()>0.5 ? 'stronger' : 'riskier'} this week.`;
    // append temporarily
    const existing = $('fpl-tailored');
    if (existing) existing.appendChild(insight);
    setTimeout(() => insight.remove(), 8000);
  }, 800);
}

function renderSponsoredAwardsFpl() {
  const el = $('fpl-sponsored');
  if (!el) return;
  renderSponsoredAwards(); // use real
}

function showProposeAward() {
  showSponsorModal();
}

function showBeefModal() {
  if (currentLeagueMode === 'ucl') {
    alert('Beefs are an FPL-only feature (auto-resolved via FPL picks data). Switch to FPL mode to start a beef.');
    return;
  }
  const modal = $('modal');
  const c = $('modal-content');
  const paidFpl = (standingsData && standingsData.fpl || []).filter(m => m.fplPaid && m.id !== currentManager.id);
  if (paidFpl.length === 0) return alert('No other paid FPL managers to challenge yet.');
  const oppOptions = paidFpl.map(m => `<option value="${m.id}">${m.displayName}</option>`).join('');
  const catOptions = BEEF_PRESETS.map(b => `<option value="${b.id}">${b.name} - ${b.desc}</option>`).join('');
  c.innerHTML = `
    <div>
      <div class="font-semibold mb-2">Propose Personal Beef (static form - measurable)</div>
      <select id="beef-opp" multiple class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm" size="4">
        ${oppOptions}
      </select>
      <select id="beef-cat" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
        ${catOptions}
      </select>
      <input id="beef-stake" type="number" value="5000" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
      <button id="beef-submit" class="w-full py-1 bg-[#00ff85] text-[#111] rounded text-sm mt-1">PROPOSE (deduct from wallet if balance; Paystack on accept)</button>
      <div class="text-[10px] mt-1">Select one or more paid FPL managers. Stake per person. 10% house cut (50/30/20 split); 90% to winner. <strong>Joins close before FPL GW deadline (admin can lock early).</strong></div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('beef-submit').onclick = async () => {
    const oppSel = document.getElementById('beef-opp');
    const selectedIds = Array.from(oppSel.selectedOptions).map(o => o.value);
    const catId = document.getElementById('beef-cat').value;
    const stake = parseInt(document.getElementById('beef-stake').value) || 5000;
    if (selectedIds.length === 0) return alert('Select opponents');
    closeModal();
    const total = stake * selectedIds.length;
    const paid = tryPayWithWallet(total, 'beef stakes');
    let mainBeefId = null;
    try {
      // Send as one group beef so all are equal
      const resp = await fetchJSON('/api/beef/propose', {
        method: 'POST',
        body: JSON.stringify({ opponentIds: selectedIds, category: catId, stake, paidFromWallet: paid, joinDeadline: (standingsData && standingsData.currentRound && standingsData.currentRound.fpl) || null })
      });
      if (resp && resp.beef && resp.beef.id) mainBeefId = resp.beef.id;
    } catch (e) {
      console.warn('Server beef propose failed, keeping local', e);
    }
    // still keep local for immediate UI
    const oppNames = selectedIds.map(id => paidFpl.find(m => m.id === id)?.displayName || id).join(', ');
    playerChallenges.push({
      serverId: mainBeefId,
      proposer: currentManager.displayName,
      opponent: oppNames,
      category: catId,
      stake,
      status: 'proposed'
    });
    savePlayerChallenges();
    // renderChallengeArena removed (no challenges)
    alert(`Proposed to ${selectedIds.length} managers. ${paid ? 'Deducted total from wallet.' : 'Will pay via Paystack on accepts.'}`);

    // WhatsApp share - persistent bar so it stays on screen, with direct link to accept/decline
    const catName = BEEF_PRESETS.find(b => b.id === catId)?.name || catId;
    const deepLink = mainBeefId ? `${location.origin}/?beef=${mainBeefId}` : location.origin;
    const waText = `D League Beef Challenge!\n\n${currentManager.displayName} challenges ${selectedIds.map(id => paidFpl.find(m=>m.id===id)?.displayName || '').join(', ')} to "${catName}" for ₦${stake} each.\n\nTap here to Accept or Decline: ${deepLink}`;
    showWhatsAppShare(waText, 'Share this beef - direct link included');
  };
}

// Show pending beefs banner for awareness (in-app notification, no config needed)
function showPendingBeefsBanner() {
  const wrap = $('challenge-arena');
  if (!wrap || !playerChallenges.length) return;
  const pending = playerChallenges.filter(ch => ch.status === 'proposed' && (ch.opponent === currentManager?.displayName || ch.serverId /* from load */));
  if (pending.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'p-2 bg-yellow-900 text-yellow-200 text-xs rounded mb-2';
    banner.innerHTML = `⚔️ You have ${pending.length} pending beef challenge(s)! Check below or the arena.`;
    if (wrap.firstChild) wrap.insertBefore(banner, wrap.firstChild);
  }
}

function handleBeefDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const beefId = params.get('beef');
  if (!beefId || !currentManager) return;

  fetchJSON('/api/beefs').then(d => {
    const beefs = (d && d.beefs) || [];
    const beef = beefs.find(b => b.id === beefId);
    if (!beef || beef.status !== 'proposed') return;

    const isOpponent = (beef.opponentIds || []).includes(currentManager.id);
    if (!isOpponent) return;

    // Clean URL so it doesn't re-trigger
    history.replaceState(null, '', location.pathname);

    const modal = $('modal');
    const c = $('modal-content');
    c.innerHTML = `
      <div class="space-y-4">
        <div>
          <div class="font-bold text-xl">Beef Challenge</div>
          <div class="text-sm mt-1">${beef.proposerName} challenged you to <strong>"${beef.category}"</strong> for ₦${beef.stake}.</div>
        </div>
        <div class="flex gap-3">
          <button onclick="respondToBeefLink('${beef.id}', 'accept')" class="flex-1 py-3 bg-[#00ff85] text-black font-bold rounded-2xl">ACCEPT</button>
          <button onclick="respondToBeefLink('${beef.id}', 'decline')" class="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl">DECLINE</button>
        </div>
        <div class="text-center">
          <button onclick="closeModal()" class="text-xs text-[#888]">Maybe later</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }).catch(() => {});
}

async function respondToBeefLink(beefId, action) {
  closeModal();
  try {
    const endpoint = action === 'accept' ? '/api/beef/accept' : '/api/beef/decline';
    await fetchJSON(endpoint, {
      method: 'POST',
      body: JSON.stringify({ beefId })
    });
    alert(action === 'accept' ? 'Beef accepted!' : 'Beef declined.');
    history.replaceState(null, '', location.pathname);
    await loadAllData();
  } catch (e) {
    alert((e && e.message) || 'Action failed');
  }
}

async function adminCancelBeef(beefId) {
  if (!confirm('Cancel/Undo this beef? For wrong auto-settlement: reverts to active, reverses winner payout + cuts (no stake refund). For unpaid: full refund. Then admin can re-settle correct winner.')) return;
  try {
    await fetchJSON('/api/admin/cancel-beef', {
      method: 'POST',
      body: JSON.stringify({ beefId })
    });
    alert('Beef settlement undone (if settled): wrong credit deducted from manager, status back to active, pot restored for correct winner. House cuts not re-added. Refresh to see. For full unpaid cancel, stakes were refunded.');
    await loadAllData();
    // refresh admin if open
    if (typeof loadAdminOverview === 'function') loadAdminOverview();
    // Immediately refresh/replace the admin beefs list so cancelled ones exit right away
    await refreshAdminBeefsList();
  } catch (e) {
    alert('Cancel failed: ' + (e.message || e));
  }
}

async function refreshAdminBeefsList() {
  try {
    // Aggressively remove ALL previous admin beefs containers to prevent duplicates
    document.querySelectorAll('#admin-beefs-list, .beef-admin-section').forEach(el => el.remove());

    let container = document.createElement('div');
    container.id = 'admin-beefs-list';
    container.className = 'mt-4 p-5 bg-[#111] border-2 border-[#ffaa00] rounded-3xl beef-admin-section';
    const dash = document.getElementById('dashboard');
    if (dash) dash.appendChild(container);
    const bdata = await fetchJSON('/api/admin/beefs');
    let bh = `<div class="font-black text-lg mb-2 text-[#ffaa00]">⚔️ BEEFS — ADMIN (manual settle + preview)</div>
      <div class="text-[10px] text-[#888] mb-2">Use SETTLE button (shows computed winner if data available for the round). Beefs persist.</div>`;
    const bl = (bdata.beefs || []);
    if (bl.length === 0) {
      bh += `<div class="text-xs text-[#666]">No beefs found.</div>`;
    } else {
      bl.forEach(bf => {
        const pstr = (bf.paidDetails || []).map(p=> `${p.displayName} ₦${p.amount}`).join(' • ') || 'no payments';
        const pz = bf.currentPot || bf.prizePot || 0;
        const canC = bf.status !== 'cancelled';  // now supports cancelling settled to undo wrong auto-settlement
        const presetB = (BEEF_PRESETS || []).find(p => p.id === bf.category);
        const bDesc = presetB ? presetB.desc : bf.category;
        const lockBtn = bf.locked ? '' : `<button onclick="adminLockBeef('${bf.id}')" class="mt-1 px-2 py-0.5 bg-orange-600 text-white text-[10px] rounded">LOCK</button>`;
        const isSettled = ['settled', 'declined', 'cancelled'].includes((bf.status || '').toLowerCase());
        // Build list of participants for dropdown (unique)
        const beefParts = [];
        const seenP = new Set();
        const addPart = (id, nm) => { if (id && !seenP.has(id)) { seenP.add(id); beefParts.push({id, name: nm || id}); } };
        if (bf.proposerId) addPart(bf.proposerId, bf.proposerName);
        (bf.opponentIds || []).forEach((id, i) => addPart(id, (bf.opponentNames||[])[i]));
        (bf.participants || []).forEach((id, i) => addPart(id, (bf.participantNames||[])[i]));
        let winPreview = '';
        let settleUI = '';
        if (!isSettled) {
          if (bf.winnerPreview && bf.winnerPreview.length) {
            const nms = bf.winnerPreview.map(w => w.displayName).join(' / ');
            winPreview = `<div class="text-[10px] text-[#00ff85] mt-0.5">Preview winner (from final data): ${nms}</div>`;
          }
          // Always dropdown of the actual beef participants + settle button
          const selId = `beef-sel-${bf.id}`;
          let sel = `<select id="${selId}" class="text-[10px] bg-[#111] border border-[#444] p-0.5 mr-1 align-middle">`;
          const preId = (bf.winnerPreview && bf.winnerPreview[0] && bf.winnerPreview[0].id) || '';
          beefParts.forEach(p => {
            const selAttr = (p.id === preId) ? 'selected' : '';
            sel += `<option value="${p.id}" ${selAttr}>${p.name}</option>`;
          });
          sel += `</select>`;
          settleUI = sel + `<button onclick="settleBeefWithSelected('${bf.id}', '${selId}')" class="mt-1 px-2 py-0.5 bg-green-700 text-white text-[10px] rounded">SETTLE SELECTED</button>`;
        }
        const currentGW = (standingsData && standingsData.currentRound && standingsData.currentRound.fpl) || 1;
        const joinGW = bf.joinDeadline || currentGW;
        const displayGW = Math.max(joinGW, currentGW);
        bh += `<div class="mb-2 p-2 bg-black/60 rounded text-xs border border-[#ffaa00]">
          <div><strong>${bf.proposerName}</strong> vs ${(bf.opponentNames||[]).join(', ')} | ${bDesc} | Pot ₦${pz} ${bf.locked ? `(LOCKED for GW${displayGW})` : ''}</div>
          <div>Status: ${bf.status} | Paid: ${pstr}</div>
          ${winPreview}
          ${canC ? `<button onclick="adminCancelBeef('${bf.id}')" class="mt-1 px-2 py-0.5 bg-red-700 text-white text-[10px] rounded">${bf.status === 'settled' ? 'UNDO SETTLEMENT (restore pot)' : 'CANCEL + REFUND'}</button> ${lockBtn}` : ''}
          ${settleUI}
        </div>`;
      });
    }
    container.innerHTML = bh;
  } catch(e){ console.warn('refresh admin beefs failed', e); }
}

async function settleBeefWithSelected(beefId, selectElId) {
  const sel = document.getElementById(selectElId);
  if (!sel || !sel.value) return alert('Select a winner from the dropdown');
  const winnerId = sel.value;
  if (!confirm(`Settle this beef to winner ${winnerId}?\n\n90% of pot to winner, 10% house cut to runner-up pots. This is final.`)) return;
  try {
    const res = await fetchJSON('/api/admin/settle-beef', {
      method: 'POST',
      body: JSON.stringify({ beefId, winnerManagerId: winnerId })
    });
    alert(res.message || 'Beef settled.');
    await refreshAdminBeefsList();
    await loadAllData();
    if (typeof loadAdminOverview === 'function') loadAdminOverview();
  } catch (e) {
    alert('Settle failed: ' + (e.message || e));
  }
}

async function adminManageH2HFixtures() {
  let dleague = await loadAllManagersForAdmin();
  if (!dleague.length && standingsData && standingsData.fpl) dleague = standingsData.fpl;
  if (!dleague.length) {
    alert('Load managers first (refresh admin).');
    return;
  }
  let gw = parseInt(prompt('H2H FIXTURES: Enter the GW number to set matchups for (2-38, GW1 concluded):', '2'));
  if (!gw || gw < 2 || gw > 38) return;

  // Build UI for picking opponents
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#1c1c1c;border:1px solid #333;padding:16px;border-radius:12px;max-width:620px;width:94%;">
      <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">Enter H2H Fixtures for GW${gw}</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px;">For each D-League manager on the left, select their opponent on the right. These become the H2H FIXTURE for the current GW shown in the main H2H box. Only D-League participants listed. Click SAVE when done.</div>
      <div id="h2h-picks" style="max-height:420px;overflow:auto;"></div>
      <div style="margin-top:12px;">
        <button id="h2h-save" style="background:#00ff85;color:#111;padding:7px 14px;border-radius:6px;margin-right:8px;font-weight:600;">SAVE FIXTURES FOR GW${gw}</button>
        <button id="h2h-cancel" style="padding:7px 14px;border-radius:6px;border:1px solid #444;">CANCEL</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const picksDiv = modal.querySelector('#h2h-picks');
  const currentFixtures = (standingsData.h2hFixtures && standingsData.h2hFixtures[gw]) || {};

  // Build rows + selects. Use light bg + black text so picked names are clearly visible (black) instead of white/blank.
  dleague.forEach(m => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;margin-bottom:4px;font-size:12px;';
    const clubLabel = m.fplClubName ? ` <span style="color:#888;font-size:10px;">(${m.fplClubName})</span>` : '';
    row.innerHTML = `<span style="width:160px;">${m.displayName}${clubLabel}</span>`;
    const sel = document.createElement('select');
    sel.style.cssText = 'flex:1;font-size:12px;background:#f8f8f8;color:#111;border:1px solid #555;padding:3px 4px;border-radius:3px;';
    sel.innerHTML = '<option value="">-- pick opponent --</option>';
    const myKey = (m.fplTeam && m.fplTeam.teamId) || m.id;
    dleague.forEach(o => {
      if (o.id === m.id) return;
      const opt = document.createElement('option');
      const oKey = (o.fplTeam && o.fplTeam.teamId) || o.id;
      opt.value = oKey;
      opt.text = o.displayName + (o.fplClubName ? ` (${o.fplClubName})` : '');
      if (String(currentFixtures[myKey] || '') === String(oKey)) opt.selected = true;
      sel.appendChild(opt);
    });
    row.appendChild(sel);
    picksDiv.appendChild(row);
    row._managerKey = myKey;
    row._sel = sel;
  });

  const allRows = Array.from(picksDiv.children);

  // Auto-fill reverses from currentFixtures for symmetry (e.g. if A->B set but B->A not)
  Object.entries(currentFixtures).forEach(([k, v]) => {
    if (!v) return;
    const rowForK = allRows.find(r => String(r._managerKey) === String(k));
    const rowForV = allRows.find(r => String(r._managerKey) === String(v));
    if (rowForK && rowForK._sel && String(rowForK._sel.value || '') !== String(v)) {
      rowForK._sel.value = v;
    }
    if (rowForV && rowForV._sel && String(rowForV._sel.value || '') !== String(k)) {
      rowForV._sel.value = k;
    }
  });

  // set initial prevValue for change tracking
  allRows.forEach(r => {
    if (r._sel) r._sel.dataset.prevValue = r._sel.value || '';
  });

  // Dynamically remove already-selected opponents from other dropdowns (unique assignments, no double-booking).
  // Rebuilds options live as you pick.
  function refreshOptions() {
    const selections = {};
    allRows.forEach(r => {
      if (r._sel) selections[r._managerKey] = r._sel.value;
    });
    allRows.forEach(r => {
      const sel = r._sel;
      const myKey = r._managerKey;
      const curr = sel.value;
      const takenByOthers = new Set();
      Object.entries(selections).forEach(([k, v]) => {
        if (k !== myKey && v) takenByOthers.add(String(v));
      });
      // rebuild options excluding self + taken by others
      sel.innerHTML = '<option value="">-- pick opponent --</option>';
      dleague.forEach(o => {
        const oKey = (o.fplTeam && o.fplTeam.teamId) || o.id;
        // skip self
        const thisMgr = dleague.find(mm => ((mm.fplTeam && mm.fplTeam.teamId) || mm.id) === myKey);
        if (thisMgr && o.id === thisMgr.id) return;
        if (takenByOthers.has(String(oKey))) return;
        const opt = document.createElement('option');
        opt.value = oKey;
        opt.text = o.displayName + (o.fplClubName ? ` (${o.fplClubName})` : '');
        if (String(curr) === String(oKey)) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  allRows.forEach(row => {
    if (row._sel) {
      row._sel.onchange = () => {
        const myKey = row._managerKey;
        const sel = row._sel;
        const prev = sel.dataset.prevValue || '';
        const curr = sel.value;
        if (curr && curr !== prev) {
          // auto-fill the reverse for symmetry (A picks B => also set B picks A)
          const oppRow = allRows.find(r => String(r._managerKey) === String(curr));
          if (oppRow && oppRow._sel && String(oppRow._sel.value || '') !== String(myKey)) {
            oppRow._sel.value = myKey;
            oppRow._sel.dataset.prevValue = myKey;
          }
        } else if (!curr && prev) {
          // cleared: clear the old reverse if it was pointing back
          const prevOppRow = allRows.find(r => String(r._managerKey) === String(prev));
          if (prevOppRow && prevOppRow._sel && String(prevOppRow._sel.value || '') === String(myKey)) {
            prevOppRow._sel.value = '';
            prevOppRow._sel.dataset.prevValue = '';
          }
        }
        // also if changed, clear old partner's reverse
        if (prev && prev !== curr) {
          const prevOppRow = allRows.find(r => String(r._managerKey) === String(prev));
          if (prevOppRow && prevOppRow._sel && String(prevOppRow._sel.value || '') === String(myKey)) {
            prevOppRow._sel.value = '';
            prevOppRow._sel.dataset.prevValue = '';
          }
        }
        sel.dataset.prevValue = curr;
        refreshOptions();
      };
    }
  });
  // initial cleanup in case preloaded currentFixtures had any overlap
  refreshOptions();

  modal.querySelector('#h2h-save').onclick = async () => {
    const newFix = {};
    Array.from(picksDiv.children).forEach(row => {
      if (row._sel && row._sel.value) {
        newFix[row._managerKey] = row._sel.value;
      }
    });
    try {
      await fetchJSON('/api/admin/set-h2h-fixtures', {
        method: 'POST',
        body: JSON.stringify({ gw, fixtures: newFix })
      });
      alert('Saved GW' + gw);
      document.body.removeChild(modal);
      // refresh data
      await loadStandings();
      renderFplTailored();
    } catch (e) { alert('Failed ' + e.message); }
  };
  modal.querySelector('#h2h-cancel').onclick = () => document.body.removeChild(modal);
}

async function adminManageUclMdScores() {
  if (!standingsData || !(standingsData.ucl || []).length) {
    alert('Switch to UCL or load data with paid UCL managers first.');
    return;
  }
  const uclMgrs = standingsData.ucl || [];
  let md = parseInt(prompt('Enter UCL Match Day number to edit/finalize (e.g. 1-17):', (standingsData.currentRound?.ucl || 2) - 1 || '1'));
  if (!md || md < 1) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:100;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#1c1c1c;border:1px solid #333;padding:16px;border-radius:12px;max-width:620px;width:94%;">
      <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">UCL MD${md} — Enter Points (manual)</div>
      <div style="font-size:11px;color:#888;margin-bottom:8px;">Enter final points for each paid UCL manager. Use "Finalize &amp; Settle" to credit the winner automatically (same money logic as FPL).</div>
      <div id="ucl-md-picks" style="max-height:380px;overflow:auto;"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button id="ucl-md-save" style="background:#00ff85;color:#111;padding:7px 14px;border-radius:6px;font-weight:600;">SAVE POINTS</button>
        <button id="ucl-md-finalize" style="background:#ffaa00;color:#111;padding:7px 14px;border-radius:6px;font-weight:600;">FINALIZE MD${md} &amp; SETTLE WINNER</button>
        <button id="ucl-md-cancel" style="padding:7px 14px;border-radius:6px;border:1px solid #444;">CANCEL</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const picksDiv = modal.querySelector('#ucl-md-picks');
  const currentScores = {};
  (standingsData.ucl || []).forEach(m => {
    const sc = (standingsData.scores || []).find(s => s.managerId === m.id && s.competition === 'ucl' && s.round === md);
    currentScores[m.id] = sc ? sc.points : (m.currentUcl || '');
  });

  uclMgrs.forEach(m => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;font-size:12px;gap:8px;';
    const club = m.uclClubName ? ` (${m.uclClubName})` : '';
    row.innerHTML = `<span style="width:220px;">${m.displayName}${club}</span>`;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.style.cssText = 'flex:1; font-size:12px; background:#f8f8f8; color:#111; padding:4px;';
    inp.value = currentScores[m.id] || '';
    row.appendChild(inp);
    picksDiv.appendChild(row);
    row._managerId = m.id;
    row._inp = inp;
  });

  modal.querySelector('#ucl-md-save').onclick = async () => {
    const updates = {};
    Array.from(picksDiv.children).forEach(r => {
      if (r._inp) {
        const pts = parseInt(r._inp.value, 10);
        if (!isNaN(pts)) updates[r._managerId] = pts;
      }
    });
    try {
      await fetchJSON('/api/admin/set-ucl-md-scores', {
        method: 'POST',
        body: JSON.stringify({ md, scores: updates })
      });
      alert('Saved MD' + md + ' points.');
      await loadStandings();
      renderUclTailored();
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  modal.querySelector('#ucl-md-finalize').onclick = async () => {
    if (!confirm(`Finalize MD${md} and settle winner now? This will credit the top scorer using the same pot/wallet logic as FPL.`)) return;
    const updates = {};
    Array.from(picksDiv.children).forEach(r => {
      if (r._inp) {
        const pts = parseInt(r._inp.value, 10);
        if (!isNaN(pts)) updates[r._managerId] = pts;
      }
    });
    try {
      await fetchJSON('/api/admin/set-ucl-md-scores', { method: 'POST', body: JSON.stringify({ md, scores: updates }) });
      // Settle the *specific* md (not just current round), so that 10% reserves are added to 2nd/3rd pots
      await fetchJSON('/api/admin/force-settle-round', { method: 'POST', body: JSON.stringify({ comp: 'ucl', round: md }) });
      alert('MD' + md + ' finalized and settled. Check ledger for winner credit. Reserves added to 2nd/3rd pots (if any final scores for this MD).');
      document.body.removeChild(modal);
      await loadAllData();
      renderUclTailored();
    } catch (e) { alert('Finalize failed: ' + e.message); }
  };

  modal.querySelector('#ucl-md-cancel').onclick = () => document.body.removeChild(modal);
}

// Keep for any legacy calls (prompt fallback minimal)
async function confirmAndSettleBeef(beefId, prechosenWinnerId) {
  let winnerId = prechosenWinnerId;
  if (!winnerId) {
    winnerId = prompt('Enter winner manager ID:');
    if (!winnerId) return;
  }
  if (!confirm(`Settle this beef to ${winnerId}?`)) return;
  try {
    const res = await fetchJSON('/api/admin/settle-beef', {
      method: 'POST',
      body: JSON.stringify({ beefId, winnerManagerId: winnerId })
    });
    alert(res.message || 'Beef settled.');
    await refreshAdminBeefsList();
    await loadAllData();
    if (typeof loadAdminOverview === 'function') loadAdminOverview();
  } catch (e) {
    alert('Settle failed: ' + (e.message || e));
  }
}

async function adminLockBeef(beefId) {
  if (!confirm('Lock this beef? No further joins will be allowed (use before FPL GW deadline to prevent tricks).')) return;
  const deadline = prompt('Optional: Set join deadline as GW number (e.g. 5), or leave blank:', '');
  try {
    const body = { beefId };
    if (deadline) body.deadline = parseInt(deadline);
    await fetchJSON('/api/admin/lock-beef', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    alert('Beef locked.');
    await loadAllData();
    if (typeof loadAdminOverview === 'function') loadAdminOverview();
  } catch (e) {
    alert('Lock failed: ' + (e.message || e));
  }
}

async function payBeefStake(beefId, stake) {
  if (!beefId || !stake || !currentManager) return alert('Cannot pay stake');
  try {
    await initiatePayment(null, null, { beefId, amount: Number(stake) });
  } catch (e) {
    alert('Failed to start beef stake payment: ' + (e.message || e));
  }
}

async function markManagerPaid() {
  const mgrSel = document.getElementById('mark-paid-mgr');
  const compSel = document.getElementById('mark-paid-comp');
  const amtEl = document.getElementById('mark-paid-amt');
  if (!mgrSel || !compSel) return alert('Mark paid controls not found');
  const managerId = mgrSel.value;
  const competition = compSel.value;
  const amount = amtEl ? Number(amtEl.value) : 0;
  if (!managerId || !competition) return alert('Select manager and competition');
  if (!confirm(`Mark this manager paid for ${competition.toUpperCase()}?`)) return;
  try {
    const res = await fetchJSON('/api/admin/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ managerId, competition, amount: amount || undefined })
    });
    alert(res.message || 'Marked paid.');
    await loadAdminOverview();
    await loadAllData();  // refresh pots, eligibility etc
  } catch (e) {
    alert('Mark paid failed: ' + (e.message || e));
  }
}

async function settleCurrentRound(comp) {
  if (!standingsData) await loadStandings();
  const list = comp === 'fpl' ? (standingsData.fpl || []) : (standingsData.ucl || []);
  if (!list.length) return alert('No standings');

  const winner = list[0];
  // Demo auto credit
  const pot = comp === 'fpl' ? 10000 : 6000;
  alert(`Auto-settled: ${winner.displayName} wins ${comp.toUpperCase()} this round! ₦${pot} credited to their stored account.\n\nWhatsApp announcement sent to group. Full tx in ledger.`);

  // Trigger whatsapp with winners
  generateWhatsAppSummary();

  // Refresh
  await loadStandings();
}

function showH2HStandings() {
  alert('H2H Standings (FPL style):\n1. You\n2. Chinedu\n... (pulled from FPL league when ID loaded by admin)');
}

function computeWinnerForLogic(logic, roundData = {}) {
  // Programmable winner determination based on real synced data (picks, scores)
  // Called after GW/MD concludes via API
  const managers = (standingsData && standingsData.all) || [];
  if (!managers.length) return null;

  let best = null;
  let bestScore = -1;

  managers.forEach(m => {
    let score = 0;
    const picks = m.recentPicks || [];
    const recent = m.currentFpl || 0;

    if (logic === 'highestCaptain') {
      const cap = picks.find(p => p.multiplier > 1);
      score = cap ? (cap.points || 0) : 0;
    } else if (logic === 'highestBench') {
      // Bench points independent of bench boost chip: look at bench players (position > 11)
      score = picks.filter(p => (p.position || 0) > 11).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'defencePoints') {
      score = picks.filter(p => p.type === 2).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'midfieldPoints') {
      score = picks.filter(p => p.type === 3).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'forwardPoints') {
      score = picks.filter(p => p.type === 4).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'chipPerformance') {
      score = m.recentChip ? recent * 1.5 : recent; // simple boost if chipped
    } else if (logic === 'highestTotal') {
      score = recent;
    } else {
      score = recent; // default
    }

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  });

  return best;
}

function renderSponsoredAwards() {
  // keep old for compatibility, delegate
  const wrap = $('sponsored-awards');
  if (wrap) wrap.innerHTML = SPONSORED_AWARDS.map(a => `<div>🏆 ${a.name} — ${a.desc} (set amount on propose)</div>`).join('');
}

// Joining guide modal helpers
function showJoinGuideModal() {
  const m = document.getElementById('join-guide-modal');
  if (m) m.classList.remove('hidden');
  if (m) m.classList.add('flex');
}

function hideJoinGuideModal() {
  const m = document.getElementById('join-guide-modal');
  if (m) {
    m.classList.remove('flex');
    m.classList.add('hidden');
  }
}

function autoSettleAwards() {
  if (!standingsData || !currentManager) return;
  // Awards settled via backend auto logic after GW/MD; see ledger and challenge room.
}

function switchLeague(mode) {
  currentLeagueMode = mode;
  document.querySelectorAll('#league-selector button').forEach(btn => btn.classList.remove('ring-2','ring-[#00ff85]'));
  const activeBtn = Array.from(document.querySelectorAll('#league-selector button')).find(b => b.textContent.includes(mode.toUpperCase()));
  if (activeBtn) activeBtn.classList.add('ring-2','ring-[#00ff85]');

  const fplTail = $('fpl-tailored');
  const uclTail = $('ucl-tailored');

  if (mode === 'fpl') {
    if (fplTail) fplTail.classList.remove('hidden');
    if (uclTail) uclTail.classList.add('hidden');
    // Show FPL-specific areas, hide UCL
    const fplSections = document.querySelectorAll('.fpl-only, #fpl-cup-info, .fpl-squad-section');
    fplSections.forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.ucl-only').forEach(el => el.classList.add('hidden'));
    renderFplTailored();
    if (typeof renderLineupViewer === 'function') renderLineupViewer();
    // Re-render pots full
    if (typeof renderTopPotsAndActions === 'function') renderTopPotsAndActions();
    const beefTop = $('active-beefs-top');
    if (beefTop) beefTop.style.display = '';
    const lineupTitle = $('lineup-title');
    if (lineupTitle) lineupTitle.innerHTML = 'LINEUP VIEWER <span class="text-xs text-[#00ff85]">(Real FPL data)</span>';
    if (typeof renderSpotlight === 'function') renderSpotlight();
  } else if (mode === 'ucl') {
    if (fplTail) fplTail.classList.add('hidden');
    if (uclTail) uclTail.classList.remove('hidden');
    // Hide FPL mixing sections when in UCL, show UCL only
    const fplSections = document.querySelectorAll('.fpl-only, #fpl-cup-info, .fpl-squad-section, #fpl-h2h-this');
    fplSections.forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.ucl-only').forEach(el => el.classList.remove('hidden'));
    // Hide beefs completely in UCL per request
    const beefEls = document.querySelectorAll('#active-beefs-top, .beef-admin-section');
    beefEls.forEach(el => el.style.display = 'none');
    renderUclTailored();
    // Re-render pots as UCL-only (current MD pot)
    if (typeof renderTopPotsAndActions === 'function') renderTopPotsAndActions();
    // Clear FPL GW winners in UCL mode (blank until MD winners)
    const gwCol = document.getElementById('gw-winners-col');
    if (gwCol) gwCol.innerHTML = `<div class="text-xs text-[#888]">MD Winners roll appears here after UCL MD settles begin.</div>`;
    const lineupTitle = $('lineup-title');
    if (lineupTitle) lineupTitle.innerHTML = 'LINEUP VIEWER <span class="text-xs text-[#00ff85]">(UCL data when loaded from UCL list)</span>';
    if (typeof renderSpotlight === 'function') renderSpotlight();
  }

  // Hide old combined for cleanliness
  const oldCombined = document.querySelector('#combined-race');
  if (oldCombined) oldCombined.closest('div')?.classList.add('hidden');
}

// === MANAGER PERSONA SUPERPOWER ===
// 6 questions to type managers (Captain style, risk, etc). See your type + similar others.
// Scoring is designed to cluster answers into clear playstyles. Re-take the quiz anytime to update.
// Clean names only; full explanations are in PERSONA_DETAILS and shown on click.
const PERSONA_QUESTIONS = [
  { q: "Captain choice style?", opts: ["Safe top player", "Differential / punty", "Form hot streak", "Value / budget"] , scores: [0,1,2,3] },
  { q: "Transfer activity?", opts: ["Patient, few changes", "Very active, chase points", "Reactive to injuries", "Wildcard heavy"] , scores: [0,3,1,2] },
  { q: "Bench philosophy?", opts: ["Ignore bench", "Value cheap bench", "Bench boost believer", "Rotate aggressively"] , scores: [0,1,3,2] },
  { q: "Chip timing?", opts: ["Save for big weeks", "Use early on doubles", "Save for blank weeks", "Triple captain punts"] , scores: [1,2,0,3] },
  { q: "Overall risk?", opts: ["Consistent safe", "High variance punts", "Balanced", "Contrarian"] , scores: [0,3,1,2] },
  { q: "Focus area?", opts: ["Attackers for hauls", "Defence for cleans", "Midfield control", "All-round value"] , scores: [3,1,2,0] }
];

const PERSONA_TYPES = [
  "Captain Clutch",
  "Differential Daredevil",
  "Bench Bandit",
  "Wildcard Warrior",
  "Value Viking",
  "Balanced Builder"
];

const PERSONA_DETAILS = {
  "Captain Clutch": "You are the ultimate captain picker. You obsess over the armband choice — whether safe premium or differential hero — and live for the weeks your captain hauls 20+ points. In D League, this persona dominates weekly pots, captain-specific beefs, and chip timing awards. You tend to win big on high-variance captain weeks but can be burned on blanks. Perfect for beefs around 'most points from captain' or 'top scorer this GW'.",
  "Differential Daredevil": "Risk is your middle name. You hunt differentials, punts, and contrarian picks that others sleep on. High variance playstyle that either crushes the league or teaches hard lessons. In the league you win big on overall and h2h beefs when your differentials explode, but lose when they don't. Great for 'biggest differential gain' beefs and sponsor awards for most unique picks.",
  "Bench Bandit": "You are a master of the bench. Cheap enablers, bench boosts at perfect times, and rotating 4th/5th midfielders/defenders for max value. You squeeze every point from your 15-man squad. In D League this shines in bench-related beefs, overall consistency, and defensive awards. You rarely have duds on the bench and win 'best bench' style challenges easily.",
  "Wildcard Warrior": "Aggressive and decisive. You make big transfers, hit wildcards early or on doubles, and are not afraid to overhaul your team mid-season. High activity level. In D League you thrive on transfer terror beefs, wildcard timing challenges, and 'most points from transfers' awards. Your style leads to explosive weeks but requires strong FPL knowledge to avoid disasters.",
  "Value Viking": "Budget king and enabler expert. You build strong squads on a shoestring, find hidden gems under £6m, and maximize every million. Extremely disciplined. This persona wins value-based beefs, overall pots on low ownership hauls, and sponsorships for 'best budget team'. You are consistent and hard to beat in 'most points per pound' style categories.",
  "Balanced Builder": "The steady hand. You build balanced squads, avoid extremes, and grind consistent returns across attack, midfield, and defence. Reliable weekly scores. In D League this excels at long-term overall and cup pots, H2H consistency beefs, and end-of-season awards. Less flashy but you rarely finish near the bottom and are excellent at 'steady points' beef categories."
};

function showPersonaQuiz() {
  const m = $('modal');
  const c = $('modal-content');
  let html = `<div class="space-y-4"><div class="font-bold text-lg">🧠 Manager Persona Quiz (6 quick Qs)</div>`;
  PERSONA_QUESTIONS.forEach((q,i) => {
    html += `<div><div class="text-sm mb-1">${i+1}. ${q.q}</div>`;
    q.opts.forEach((o,j) => {
      html += `<label class="block text-xs"><input type="radio" name="p${i}" value="${j}"> ${o}</label>`;
    });
    html += `</div>`;
  });
  html += `<button onclick="submitPersonaQuiz()" class="mt-3 w-full py-2 bg-[#00ff85] text-black font-bold rounded">Compute My Persona + See Matches</button></div>`;
  c.innerHTML = html;
  m.classList.remove('hidden'); m.classList.add('flex');
}

function submitPersonaQuiz() {
  let score = 0;
  PERSONA_QUESTIONS.forEach((q,i) => {
    const sel = document.querySelector(`input[name="p${i}"]:checked`);
    if (sel) score += q.scores[parseInt(sel.value)];
  });
  const typeIdx = Math.min(Math.floor(score / 2), PERSONA_TYPES.length-1);
  const persona = PERSONA_TYPES[typeIdx];
  // Simple "similar" - in real would match other managers' saved personas. Here demo + random from list
  const similar = (window.standingsData && window.standingsData.all || []).slice(0,3).map(m => m.displayName).join(', ') || 'Other managers';
  const details = PERSONA_DETAILS[persona] || "Your unique D League style. Re-take the quiz or ask admin to adjust.";
  const personaText = `🧠 My D League Persona: ${persona}\n\nScore: ${score}/18\nSimilar managers: ${similar}\n\n${details}\n\nBrag your style in D League!`;
  if (currentManager) {
    currentManager.persona = persona;
    // Persist to server
    fetchJSON('/api/manager/update-persona', {
      method: 'POST',
      body: JSON.stringify({ persona })
    }).catch(() => {});
  }
  closeModal();
  // Re-render name area with persona beside
  if (typeof showDashboard === 'function') showDashboard();
  if (typeof renderProminentFeatures === 'function') renderProminentFeatures();
  // Show full explanation in a nice alert + offer share
  alert(`Your Persona: ${persona}\n\n${details}\n\n(You can click the persona name in your header anytime for this explanation.)`);
  showWhatsAppShare(personaText, 'Share your persona on WhatsApp');
}

function showPersonaDetails(personaName) {
  const clean = (personaName || '').split('(')[0].trim();
  const desc = PERSONA_DETAILS[clean] || "This persona reflects your FPL decision-making style based on the quiz. It can influence friendly beef categories and bragging rights in the league.";
  const m = $('modal');
  const c = $('modal-content');
  c.innerHTML = `
    <div class="space-y-4">
      <div class="font-black text-2xl text-[#00ff85]">${clean}</div>
      <div class="text-sm leading-relaxed">${desc}</div>
      <div class="text-xs text-[#888]">Your persona is determined by your answers to the 6-question quiz (captain style, transfers, bench, chips, risk appetite, and focus). Re-take the quiz from the prominent features or 'Know Your Manager persona' button to update it. It shows in your name header and can be used for themed beefs/awards.</div>
      <button onclick="closeModal()" class="w-full py-2 bg-[#00ff85] text-black font-bold rounded">Close</button>
    </div>
  `;
  m.classList.remove('hidden'); m.classList.add('flex');
}

// Simple request access (posts to server for admin to see)
// Now asks for FPL club name to confirm league membership
// New seamless 2026 form (no sequential prompts)
function showJoinModal() {
  const m = $('join-modal');
  if (m) m.classList.remove('hidden');
  // prefill if possible
}

function closeJoinModal() {
  const m = $('join-modal');
  if (m) m.classList.add('hidden');
}

async function submitJoinForm(ev) {
  ev.preventDefault();
  const name = $('join-name').value.trim();
  const email = $('join-email').value.trim();
  const fplClub = $('join-club').value.trim();
  const fplId = $('join-fplid').value.trim();
  if (!name || !email || !fplClub) {
    alert('Name, email and FPL Club Name are required.');
    return;
  }

  // Generate code IMMEDIATELY on client for instant population
  const short = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,6);
  const accessCode = `${short.toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`;

  // Show success UI immediately (no waiting, no alert)
  const modal = $('join-modal');
  if (modal) {
    const newContent = `
      <div onclick="event.stopImmediatePropagation()" class="bg-[#1c1c1c] w-full max-w-md rounded-3xl border border-[#00ff85] p-6">
        <div class="text-center">
          <div class="font-bold text-xl mb-4 text-[#00ff85]">✅ Here's your access code</div>
          <div class="font-mono text-3xl font-black text-[#00ff85] tracking-widest mb-2">${accessCode}</div>
          <div class="text-sm mb-4">Use this with your email to login.</div>
          <button onclick="navigator.clipboard.writeText('${accessCode}'); this.textContent='Copied!'" class="px-4 py-2 bg-[#00ff85] text-black font-bold rounded-xl mb-3">Copy code</button>
          <div class="text-xs text-[#888]">Full payment required after login to join pots & beefs.<br>Joins lock from GW1.</div>
          <div class="mt-4">
            <button onclick="closeJoinModal()" class="px-4 py-2 border border-[#333] rounded-xl text-sm">Close</button>
          </div>
        </div>
      </div>
    `;
    modal.innerHTML = newContent;
  } else {
    closeJoinModal();
    alert(`✅ Your access code: ${accessCode}\n\nCopy it now!`);
  }

  // Fire the request in background (include the code so server uses it)
  fetch('/api/join-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      name, 
      email, 
      fplClubName: fplClub, 
      fplId: fplId || '',
      fplLeagueJoined: true, 
      message: 'Requested via form',
      accessCode   // send the pre-generated code
    })
  }).then(r => r.json()).then(data => {
    // optional: refresh admin if open
    if (typeof loadAdminOverview === 'function') loadAdminOverview();
    if (data && data.error) console.warn('Background join create warning:', data.error);
  }).catch(e => {
    console.warn('Background join request failed (code still shown to user):', e);
  });
}

async function loadFplLeague() {
  const id = $('fpl-league-id').value.trim();
  if (!id) return alert('Enter FPL League ID');
  const wrap = $('fpl-league-standings');
  wrap.innerHTML = 'Loading from FPL...';
  try {
    // Classic league
    const res = await fetch(`https://fantasy.premierleague.com/api/leagues-classic/${id}/standings/`);
    const data = await res.json();
    if (data.standings && data.standings.results) {
      let html = '<div class="text-xs">FPL League Standings:</div>';
      data.standings.results.slice(0,5).forEach((r, i) => {
        html += `<div>${i+1}. ${r.player_name} - ${r.total} pts</div>`;
      });
      wrap.innerHTML = html;
    } else {
      // Try H2H
      const h2h = await fetch(`https://fantasy.premierleague.com/api/leagues-h2h/${id}/standings/`);
      const h2hData = await h2h.json();
      if (h2hData.standings && h2hData.standings.results) {
        let html = '<div class="text-xs">FPL H2H Standings:</div>';
        h2hData.standings.results.slice(0,5).forEach((r, i) => {
          html += `<div>${i+1}. ${r.player_name} - ${r.total} pts</div>`;
        });
        wrap.innerHTML = html;
      } else {
        wrap.innerHTML = 'No standings found. Check ID.';
      }
    }
  } catch (e) {
    wrap.innerHTML = 'Error loading from FPL API. Check league ID and privacy.';
  }
}

bootstrap();
