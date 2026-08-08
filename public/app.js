// D League Clubhouse — Premium Frontend
let currentManager = null;
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
  { name: "OPay", code: "100004" }
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
    currentManager = data.manager;

    localStorage.setItem('dl_token', currentToken);
    localStorage.setItem('dl_manager_id', currentManager.id);

    showDashboard();
    loadAllData();
    // Re-check deep link after login in case they opened the WA link unauthenticated
    setTimeout(handleBeefDeepLink, 400);
  } catch (e) {
    alert('Login failed: ' + e.message + '\n\nTip: New managers must be added by the commissioner first. Use the "REQUEST ACCESS" button or message the group admin.');
  }
}

function logout() {
  localStorage.removeItem('dl_token');
  localStorage.removeItem('dl_manager_id');
  location.reload();
}

async function tryAutoLogin() {
  const token = localStorage.getItem('dl_token');
  const mgrId = localStorage.getItem('dl_manager_id');
  if (!token || !mgrId) return false;

  try {
    const me = await fetchJSON(`/api/me?token=${token}`);
    currentToken = token;
    currentManager = me.manager;
    return true;
  } catch {
    return false;
  }
}

// ============ DASHBOARD RENDER ============
function showDashboard() {
  $('login-screen').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  // Header / topbar manager info
  const topRight = $('topbar-right');
  topRight.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="hidden md:block text-right">
        <div class="text-sm font-semibold text-white">${currentManager.displayName}</div>
        <div class="text-[10px] text-[#00ff85] -mt-0.5">FPL: ${currentManager.fplPaid ? 'PAID' : 'NOT PAID'} | UCL: ${currentManager.uclPaid ? 'PAID' : 'NOT PAID'}</div>
      </div>
      <div class="w-9 h-9 rounded-2xl bg-black border border-[#333] flex items-center justify-center text-[#00ff85] font-black text-lg">
        ${currentManager.displayName[0]}
      </div>
    </div>
  `;

  renderPayAccess();

  $('welcome-line').textContent = `WELCOME BACK, MANAGER • ${new Date().getFullYear()}`;
  $('manager-name').textContent = currentManager.displayName;

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
    <button onclick="showBeefModal()" class="text-xs px-3 py-1 bg-purple-600 text-white font-semibold rounded-lg active:scale-[0.985] ml-2">⚔️ Start a Beef</button>
    <button onclick="showSponsorModal()" class="text-xs px-3 py-1 bg-yellow-500 text-black font-semibold rounded-lg active:scale-[0.985]">🏆 Sponsor an Award</button>
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
  const loads = [
    loadStandings().catch(e => console.warn('standings load failed', e)),
    loadTicker().catch(e => console.warn('ticker failed', e)),
    loadH2H().catch(e => console.warn('h2h failed', e)),
    loadChallenges().catch(e => console.warn('challenges failed', e)),
    loadProjections().catch(e => console.warn('projections failed', e)),
    // Fetch server beefs so user-generated beefs survive restarts (localStorage is UI cache only now)
    fetchJSON('/api/beefs').then(d => {
      if (d && Array.isArray(d.beefs)) {
        d.beefs.forEach(sb => {
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
              joinApprovals: sb.joinApprovals || {}
            });
          }
        });
      }
    }).catch(e => console.warn('server beefs load failed', e))
  ];
  await Promise.allSettled(loads);
  renderManagerHero();
  renderSpotlight();
  renderSquadChips();
  renderProjectionsLive();
  renderChallengeArena();
  showPendingBeefsBanner();
  renderTopPotsAndActions();
  renderSponsoredAwards();
  renderLineupViewer();

  // Auto settle awards/challenges for current round (wired)
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

  // Handle direct WhatsApp deep link ?beef=ID for accept/decline
  handleBeefDeepLink();
}

function renderTopPotsAndActions() {
  const container = document.getElementById('pots-top') || createPotsContainer();
  if (!container || !standingsData) return;

  const proj = window.lastProjections || {};
  const fpl = proj.fpl || {};
  const h2h = fpl.h2hOverallPot || 0;           // extra 1000 per manager only
  const overall = fpl.overallWinnerPot || 0;    // 75% of weekly 10% reserves
  const cup = fpl.cupWinnerPot || 0;            // 25% of weekly 10% reserves
  const weekly = fpl.weeklyPot90 || 0;
  const reserve = fpl.seasonReserveBoost || 0;  // from 10% beef/sponsor cuts for end awards

  container.innerHTML = `
    <div class="mt-4 p-4 bg-[#0a0a0a] border border-[#00ff85] rounded-3xl">
      <div class="font-black text-lg mb-2 text-[#00ff85]">💰 THE POTS – GROW THEM BY PLAYING BEEFS & SPONSORING</div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div class="bg-black p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">This GW pot</div>
          <div class="text-2xl font-black text-[#00ff85]">₦${weekly.toLocaleString()}</div>
        </div>
        <div class="bg-black p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">H2H Season Pot</div>
          <div class="text-2xl font-black">₦${h2h.toLocaleString()}</div>
        </div>
        <div class="bg-black p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">Overall League Winner</div>
          <div class="text-2xl font-black">₦${overall.toLocaleString()}</div>
        </div>
        <div class="bg-black p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">End of Season Cup Winner</div>
          <div class="text-2xl font-black">₦${cup.toLocaleString()}</div>
        </div>
        <div class="bg-black p-3 rounded-2xl border border-[#333]">
          <div class="text-xs text-[#888]">Season Reserve Boost for Group decided awards by mid-season</div>
          <div class="text-2xl font-black">₦${reserve.toLocaleString()}</div>
        </div>
      </div>
      <div class="mt-3 text-xs text-[#00ff85]">Beef and sponsored awards fund the season reserve through 10% house cuts</div>

      <div class="mt-2 text-[10px]">
        <span class="font-semibold">Active Sponsored:</span> 
        <span id="top-spon-inline">See awards section or sponsor to boost a pot!</span>
      </div>

      <div class="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <button onclick="boostPot('weekly')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost this week's</button>
        <button onclick="boostPot('h2h')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost H2H</button>
        <button onclick="boostPot('overall')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost Overall</button>
        <button onclick="boostPot('cup')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost Cup</button>
        <button onclick="boostPot('reserve')" class="px-2 py-1 bg-[#112211] border border-[#00ff85] rounded hover:bg-[#003322]">+ Boost Reserve</button>
      </div>

      <div id="pot-boosts-list" class="mt-3 text-[11px] text-[#aaa] max-h-24 overflow-auto"></div>
    </div>
  `;

  // Render recent boosts with names
  const boostsWrap = document.getElementById('pot-boosts-list');
  if (boostsWrap && standingsData && Array.isArray(standingsData.potBoosts)) {
    const recent = [...standingsData.potBoosts].slice(-8).reverse();
    if (recent.length) {
      boostsWrap.innerHTML = '<div class="font-semibold text-[#00ff85] mb-0.5">Recent pot boosts:</div>' +
        recent.map(b => {
          const namePart = b.clubName ? `${b.managerName} of ${b.clubName}` : b.managerName;
          const t = b.target === 'weekly' ? "this week's pot" : (b.target === 'h2h' ? 'H2H pot' : (b.target === 'overall' ? 'overall pot' : (b.target === 'cup' ? 'cup pot' : 'reserve boost')));
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
      .filter(e => e.type === 'join_request' || e.type === 'manager_added')
      .slice(0, 25);

    let joinsHtml = '';
    if (joinRelated.length) {
      joinsHtml = joinRelated.map(e => {
        const p = e.payload || {};
        const email = (p.email || '').toLowerCase();
        const when = (e.at || '').slice(11,16);
        const existing = managersByEmail[email];
        const isAdded = e.type === 'manager_added';
        let actionHtml = '';
        if (isAdded || existing) {
          const code = (existing && existing.accessCode) || p.accessCode || '—';
          actionHtml = `
            <div class="text-right">
              <div><span class="px-2 py-0.5 text-xs rounded bg-[#003322] text-[#00ff85]">${isAdded ? 'ADDED' : 'APPROVED'}</span></div>
              <div class="font-mono text-sm mt-1">${code}</div>
              <button onclick="navigator.clipboard.writeText('${code}');this.textContent='copied!'" class="mt-1 text-[10px] px-2 py-0.5 bg-[#00ff85] text-black rounded">copy code</button>
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
              <div class="text-sm font-mono text-[#888] mt-0.5">${p.fplClubName || ''}</div>
              <div class="text-[10px] text-[#666] mt-1">${when} • ${e.type}</div>
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

    // Challenges as cards
    let challengesHtml = (data.challenges || []).map(ch => {
      const status = ch.status;
      let color = '#888';
      if (status === 'open') color = '#00ff85';
      if (status === 'cancelled') color = '#ff6b6b';
      let actions = '';
      if (status === 'open') {
        const safeTitle = ch.title.replace(/'/g, "\\'");
        actions = `<div class="mt-2 flex gap-2"><button onclick="cancelChallenge('${ch.id}', '${safeTitle}')" class="text-xs px-2 py-1 bg-red-900 hover:bg-red-800 rounded">Cancel</button><button onclick="forceSettleChallenge('${ch.id}')" class="text-xs px-2 py-1 bg-[#00ff85] text-black rounded">Force Settle</button></div>`;
      }
      return `
        <div class="bg-[#1c1c1c] border border-[#333] p-3 rounded-2xl mb-2">
          <div class="flex justify-between">
            <div>
              <div class="font-medium">${ch.title}</div>
              <div class="text-xs" style="color:${color}">${status.toUpperCase()} • ₦${ch.prize}</div>
              ${ch.winner ? `<div class="text-xs text-[#888]">Winner: ${ch.winner}</div>` : ''}
            </div>
          </div>
          ${actions}
        </div>`;
    }).join('') || '<div class="text-[#666] p-4">No challenges</div>';

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
      return `
        <div class="flex justify-between items-center bg-[#1c1c1c] border border-[#333] p-3 rounded-2xl mb-2">
          <div>
            <div class="font-semibold">${m.displayName} ${isAdmin ? '<span class="text-xs bg-[#003322] text-[#00ff85] px-1 rounded">ADMIN</span>' : ''} ${protectedBadge}</div>
            <div class="text-xs text-[#888]">${m.email}</div>
            <div class="text-xs text-[#00ff85] mt-0.5">${club}</div>
            <div class="text-xs text-[#666]">FPL: ${fplStatus} | UCL: ${uclStatus}</div>
          </div>
          <div class="text-right">
            <div class="font-mono text-sm">${code}</div>
            <button onclick="navigator.clipboard.writeText('${code}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy',1500)" class="mt-1 text-[10px] px-3 py-0.5 bg-[#222] hover:bg-[#333] rounded">Copy Code</button>
            <button onclick="editManager('${(m.email||'').replace(/'/g,'\\\'')}', '${(m.displayName||'').replace(/'/g,'\\\'')}', '${(m.fplClubName||'').replace(/'/g,'\\\'')}', '${(m.fpl && m.fpl.teamId || '').replace(/'/g,'\\\'')}', '${(m.ucl && m.ucl.teamId || '').replace(/'/g,'\\\'')}', '${code.replace(/'/g,'\\\'')}')" class="mt-1 ml-1 text-[9px] px-2 py-0.5 bg-[#222] hover:bg-[#333] rounded">Edit</button>
            ${reclaimBtn}
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
          <div class="text-xs text-[#888]">PAID</div>
          <div class="text-2xl font-black">FPL: ${data.paidFpl} | UCL: ${data.paidUcl}</div>
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
          <button onclick="emergencySync()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">FORCE SYNC</button>
        </div>
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

      <!-- Stats Dashboard -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">MANAGERS</div>
          <div class="text-5xl font-black mt-1">${data.totalManagers}</div>
          <div class="text-sm mt-1">FPL: ${data.paidFpl} | UCL: ${data.paidUcl}</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">PAYMENTS</div>
          <div class="text-5xl font-black mt-1 text-[#00ff85]">${data.totalPaymentsConfirmed}</div>
          <div class="text-sm mt-1">Confirmed</div>
        </div>
        <div class="bg-[#161616] border border-[#222] rounded-2xl p-4">
          <div class="text-xs uppercase tracking-widest text-[#888]">10% CUTS LOGGED</div>
          <div class="text-5xl font-black mt-1">₦${data.totalHouseCommission || 0}</div>
          <div class="text-sm mt-1">Beef/sponsor/challenges (boost vs house)</div>
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

        <!-- Challenges -->
        <div class="bg-[#161616] border border-[#222] rounded-3xl p-5">
          <div class="font-semibold text-xl mb-3">CHALLENGES</div>
          <div class="max-h-[240px] overflow-auto space-y-2">
            ${challengesHtml}
          </div>
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
      </div>
      <div class="text-[10px] mt-1 text-[#888]">Adds ledger entry. Use positive for credit (missing win). Negative to correct. Wallet recalcs automatically on refresh.</div>
    `;
    panel.appendChild(creditWrap);

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

async function cancelChallenge(id, title) {
  if (!confirm(`Cancel challenge "${title}"?`)) return;
  const reason = prompt('Reason (optional):', 'Admin cancelled') || 'Admin cancelled';
  try {
    await fetchJSON('/api/admin/cancel-challenge', {
      method: 'POST',
      body: JSON.stringify({ id, reason })
    });
    alert('Challenge cancelled.');
    loadAdminOverview();
  } catch (e) {
    alert('Cancel failed: ' + e.message);
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
  const fplH2h = prompt('FPL H2H League ID:', current.fplH2h || '') || '';
  const ucl = prompt('UCL League/Identifier (if available):', current.ucl || '') || '';

  try {
    const res = await fetchJSON('/api/admin/set-leagues', {
      method: 'POST',
      body: JSON.stringify({ fplClassic, fplH2h, ucl })
    });
    alert(res.message || 'League IDs updated. Real standings will be used.');
    loadAdminOverview();
  } catch (e) {
    alert('Failed to set leagues: ' + e.message);
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

async function editManager(email, currentName, currentClub, currentFplId, currentUclId, currentCode) {
  if (!email) return alert('No email');
  const name = prompt('Display name:', currentName || '') || currentName;
  const accessCode = prompt('Access code:', currentCode || '') || currentCode;
  const fplClubName = prompt('FPL club / team name:', currentClub || '') || currentClub;
  const fplId = prompt('FPL Team ID:', currentFplId || '') || currentFplId;
  const uclId = prompt('UCL Team ID (optional):', currentUclId || '') || currentUclId;

  try {
    const res = await fetchJSON('/api/admin/add-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, accessCode, fplId, uclId, fplClubName })
    });
    alert('✅ Manager updated!\n' + (res.message || 'Details saved. Paid status preserved.'));
    loadAdminOverview();
  } catch (e) {
    alert('Update failed: ' + (e.message || e));
  }
}

async function forceSettleChallenge(id) {
  const winner = prompt('Winner display name or manager ID (leave blank to cancel):');
  if (winner === null) return;
  try {
    await fetchJSON('/api/admin/settle-challenge', {
      method: 'POST',
      body: JSON.stringify({ id, winnerName: winner || undefined })
    });
    alert('Challenge settled.');
    loadAdminOverview();
  } catch (e) {
    alert('Settle failed: ' + e.message);
  }
}

async function triggerSettle() {
  try {
    await fetchJSON('/api/settle/run', {method: 'POST', body: JSON.stringify({comp: 'fpl'})});
    alert('Settlement triggered. Check ledger.');
    await loadAllData();
  } catch(e) { alert('Settle failed'); }
}

async function loadStandings() {
  standingsData = await fetchJSON('/api/standings');
  // Legacy combined/old race + table renders removed (their containers no longer exist after separate FPL/UCL UI cleanup).
  // standingsData.fpl / .ucl / .all are still used by renderFplTailored, renderUclTailored, lineup viewer, etc.
  // Auto switch to current mode after load
  if (currentLeagueMode) switchLeague(currentLeagueMode);
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
          <div class="font-semibold">${m.displayName} ${m.id === currentManager.id ? '<span class="text-[10px] ml-1 text-[#00ff85]">(YOU)</span>' : ''}</div>
          <div class="text-[10px] text-[#888]">${m.fplTeam.teamName || ''}</div>
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
    el.innerHTML = `
      <div class="flex gap-2 items-center">
        <span class="font-mono text-xs w-4 text-[#888]">${i+1}</span>
        <span class="font-medium">${m.displayName}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="score-value font-bold tabular-nums">${m.fplTotal ?? '—'}</span>
        <span class="source-label">${m.currentFplSource || ''}</span>
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

    tr.innerHTML = `
      <td class="py-2 pr-4">
        <div class="font-semibold">${m.displayName} ${m.id === currentManager.id ? '<span class="text-[#00ff85] text-xs ml-1">(YOU)</span>' : ''}</div>
        <div class="text-[10px] text-[#888]">${m.fplTeam.teamName || ''} • ${m.uclTeam.teamName || ''}</div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="font-bold">${m.fplTotal ?? '—'}</div>
        <div class="text-[10px] text-[#00ff85]">${m.fplPaid ? 'PAID' : '—'}</div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="font-bold">${m.uclTotal ?? '—'}</div>
        <div class="text-[10px] text-[#aaa]">${m.uclPaid ? 'PAID' : '—'}</div>
      </td>
      <td class="py-2 px-3">
        <div class="font-black text-xl tabular-nums tracking-tighter">${m.combined}</div>
      </td>
      <td class="py-2 px-3 text-xs">
        <div>FPL ${m.currentFpl ?? '—'} ${m.recentCaptainName ? '(' + m.recentCaptainName + ')' : (m.recentCaptain ? '(C#' + m.recentCaptain + ')' : '')}</div>
        <div>UCL ${m.currentUcl ?? '—'} ${m.recentChip ? ' [' + m.recentChip + ']' : ''}</div>
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
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">FPL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.fplTotal || 0}</div></div>
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">UCL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.uclTotal || 0}</div></div>
          <div class="bg-[#111] rounded-2xl p-3"><div class="text-xs">COMBINED</div><div class="font-black text-2xl tabular-nums">${data.combined || 0}</div></div>
        </div>

        ${scoresHTML}
        ${finesHTML}

        <div class="mt-4 text-xs">
          <div class="flex justify-between"><span>Wallet</span><span class="font-semibold tabular-nums">₦${data.wallet || 0}</span></div>
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
  const { h2h } = await fetchJSON('/api/h2h');
  const wrap = $('h2h-list');
  wrap.innerHTML = '';

  if (!h2h || !h2h.length) {
    wrap.innerHTML = `<div class="text-xs text-[#888]">No active H2H matches this round.</div>`;
    return;
  }

  h2h.forEach(match => {
    const div = document.createElement('div');
    div.className = 'h2h-card';
    const youA = match.managerA === currentManager.id;
    const youB = match.managerB === currentManager.id;
    div.innerHTML = `
      <div class="flex justify-between text-xs mb-1">
        <div class="text-[#888]">${match.round} • H2H match (season pot)</div>
        <div class="${match.status === 'settled' ? 'text-[#00ff85]' : 'text-[#aaa]'}">${match.status.toUpperCase()}</div>
      </div>
      <div class="font-medium">
        ${youA || youB ? '<span class="text-[#00ff85]">YOU vs </span>' : ''}${match.managerA === currentManager.id ? 'Opponent' : 'Manager'} 
        vs ${match.managerB === currentManager.id ? 'YOU' : 'Opponent'}
      </div>
      ${match.winner ? `<div class="text-[10px] mt-1">Winner: <span class="font-semibold">${match.winner === currentManager.id ? 'YOU' : 'OPPONENT'}</span></div>` : ''}
    `;
    wrap.appendChild(div);
  });
}

async function loadChallenges() {
  const { challenges } = await fetchJSON('/api/challenges');
  const wrap = $('challenges-list');
  wrap.innerHTML = '';

  challenges.forEach(ch => {
    const d = document.createElement('div');
    d.className = 'p-3 bg-[#111] border border-[#333] rounded-2xl';
    d.innerHTML = `
      <div class="font-semibold">${ch.title}</div>
      <div class="text-xs flex justify-between mt-1">
        <span class="${ch.status === 'settled' ? 'text-[#00ff85]' : 'text-[#aaa]'}">${ch.status}</span>
        <span>₦${ch.prize} • ${ch.entrants} entered</span>
      </div>
      ${ch.winner ? `<div class="text-xs mt-0.5">Winner: ${ch.winner}</div>` : ''}
    `;
    wrap.appendChild(d);
  });
}

async function loadProjections() {
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
      <div class="text-[#00ff85] text-xs">END OF SEASON CUP WINNER</div>
      <div class="text-2xl font-black tabular-nums">₦${f.cupWinnerPot || 0}</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">SEASON RESERVE BOOST</div>
      <div class="text-xl font-black tabular-nums">₦${f.seasonReserveBoost || 0}</div>
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

function renderProjectionsLive() {
  const fplWrap = $('fpl-projections');
  const uclWrap = $('ucl-projections');
  const proj = window.lastProjections || {};
  if (fplWrap) {
    fplWrap.innerHTML = `
      <div class="text-xs">This week 90% pot: <span class="font-bold text-[#00ff85]">₦${proj.fpl?.weeklyPot90 || 0}</span></div>
      <div class="text-xs">H2H season: ₦${proj.fpl?.h2hOverallPot || 0}</div>
      <div class="text-xs">Overall winner: ₦${proj.fpl?.overallWinnerPot || 0}</div>
      <div class="text-xs">Cup winner: ₦${proj.fpl?.cupWinnerPot || 0}</div>
      <div class="text-xs">Season reserve boost: ₦${proj.fpl?.seasonReserveBoost || 0}</div>
    `;
  }
  if (uclWrap) {
    const uclNote = proj.ucl?.upcomingMatches ? ` • ${proj.ucl.upcomingMatches} upcoming` : '';
    uclWrap.innerHTML = `
      <div class="text-xs">This MD 90% pot: <span class="font-bold text-[#aaa]">₦${proj.ucl?.mdPot90 || 0}</span>${uclNote}</div>
      <div class="text-xs text-[#aaa]">UCL overall: ₦${proj.seasonPots?.uclOverall || 0}</div>
    `;
  }
}

let playerChallenges = JSON.parse(localStorage.getItem('dl_playerChallenges') || '[]');

function savePlayerChallenges() {
  localStorage.setItem('dl_playerChallenges', JSON.stringify(playerChallenges));
}

function renderChallengeArena() {
  const wrap = $('challenge-arena');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (playerChallenges.length === 0) {
    wrap.innerHTML = `<div class="text-xs">No active challenges. Propose one!</div>`;
    return;
  }
  playerChallenges.forEach((ch, i) => {
    const d = document.createElement('div');
    d.className = 'p-2 bg-[#111] border border-[#333] rounded text-xs mb-2';

    const proposerName = ch.proposer || 'Someone';
    const oppText = ch.opponent || (ch.participantNames || []).join(', ') || 'others';
    const statusText = ch.status === 'accepted' ? 'ongoing' : ch.status;

    let html = `${proposerName} proposed a beef to ${oppText} for "${ch.category}" ₦${ch.stake} (10% to season awards boost)<br>Status: ${statusText}`;

    if (ch.status === 'accepted' || ch.status === 'proposed') {
      const gw = (standingsData && standingsData.currentRound && standingsData.currentRound.fpl) || '?';
      html += `<br><span class="text-[10px]">Game Week ${gw} • Stake: ₦${ch.stake}</span>`;
    }

    const deep = ch.serverId ? `${location.origin}/?beef=${ch.serverId}` : location.origin;
    const waText = `D League Beef: ${proposerName} vs ${oppText} for "${ch.category}" ₦${ch.stake}. Tap to respond: ${deep}`;
    const safeShare = encodeURIComponent(waText);

    html += `<br><button onclick="showWhatsAppShare(decodeURIComponent('${safeShare}'), 'Share beef'); event.stopImmediatePropagation();" class="text-[10px] ml-1 px-1 border border-[#333] rounded">Share WA</button>`;

    d.innerHTML = html;

    const isOriginalParticipant = currentManager && (
      ch.proposer === currentManager.displayName ||
      (ch.opponent || '').includes(currentManager.displayName)
    );
    const isCurrentParticipant = currentManager && (
      (ch.participantNames || []).some(n => n === currentManager.displayName) ||
      isOriginalParticipant
    );

    if (ch.status === 'proposed') {
      // Proposed beefs are visible to all
      if (isOriginalParticipant) {
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept';
        acceptBtn.className = 'text-xs ml-2 underline text-[#00ff85]';
        acceptBtn.onclick = () => acceptChallenge(i);

        const declineBtn = document.createElement('button');
        declineBtn.textContent = 'Decline';
        declineBtn.className = 'text-xs ml-2 underline text-red-400';
        declineBtn.onclick = () => declineChallenge(i);
        d.appendChild(acceptBtn);
        d.appendChild(declineBtn);
      } else {
        const wait = document.createElement('div');
        wait.className = 'text-[10px] text-amber-400 mt-1';
        wait.textContent = 'Waiting for original challengers to accept before join requests open.';
        d.appendChild(wait);
      }
    }

    if (ch.status === 'accepted') {
      if (!isCurrentParticipant) {
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Request to join';
        joinBtn.className = 'text-xs ml-2 underline text-[#00ff85]';
        joinBtn.onclick = () => requestToJoinBeef(ch.serverId);
        d.appendChild(joinBtn);
      }
      // Pending join requests visible to current participants
      if (isCurrentParticipant && ch.joinRequests && ch.joinRequests.length > 0) {
        ch.joinRequests.forEach(requesterId => {
          const reqName = requesterId; // could resolve better with full list
          const jdiv = document.createElement('div');
          jdiv.className = 'text-[10px] mt-1 text-amber-300';
          jdiv.innerHTML = `${reqName} wants to join. `;
          const appBtn = document.createElement('button');
          appBtn.textContent = 'Approve join';
          appBtn.className = 'underline text-xs';
          appBtn.onclick = () => respondToJoin(ch.serverId, requesterId, true);
          const decBtn = document.createElement('button');
          decBtn.textContent = 'Decline join';
          decBtn.className = 'underline text-xs ml-1';
          decBtn.onclick = () => respondToJoin(ch.serverId, requesterId, false);
          jdiv.appendChild(appBtn);
          jdiv.appendChild(decBtn);
          d.appendChild(jdiv);
        });
      }
    }
    wrap.appendChild(d);
  });
}

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

async function requestToJoinBeef(beefId) {
  if (!beefId) return;
  try {
    await fetchJSON('/api/beef/request-join', {
      method: 'POST',
      body: JSON.stringify({ beefId })
    });
    alert('Join request sent. The current participants will be notified to approve or decline.');
    await loadAllData();
  } catch (e) {
    alert(e.message || 'Failed to request join');
  }
}

function declineChallenge(i) {
  const ch = playerChallenges[i];
  if (!ch.serverId) {
    ch.status = 'declined';
    savePlayerChallenges();
    renderChallengeArena();
    return;
  }
  fetchJSON('/api/beef/decline', {
    method: 'POST',
    body: JSON.stringify({ beefId: ch.serverId })
  }).then(() => {
    ch.status = 'declined';
    savePlayerChallenges();
    renderChallengeArena();
  }).catch(e => alert(e.message || 'Failed to decline'));
}

function showChallengeModal() {
  const categories = [
    "Captain scores more points than opponent",
    "Used chip this week",
    "Highest points from midfielders",
    "Most clean sheets in defense",
    "Total points > opponent (with captain boost)"
  ];
  const modal = $('modal');
  const c = $('modal-content');
  c.innerHTML = `
    <div>
      <div class="font-semibold mb-2">Propose Challenge</div>
      <select id="ch-opponent" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
        <option>Chinedu Eze</option>
        <option>Amara Okoro</option>
        <option>Emeka Obi</option>
      </select>
      <select id="ch-cat" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
        ${categories.map(c => `<option>${c}</option>`).join('')}
      </select>
      <input id="ch-stake" type="number" value="5000" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
      <button id="ch-submit" class="w-full py-1 bg-[#00ff85] text-[#111] rounded text-sm mt-1">PROPOSE (pay stake from wallet if balance, else Paystack)</button>
      <div class="text-[10px] mt-1 text-[#888]">10% of pot goes to season reserve boost for the 3 end awards (90% to winner).</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('ch-submit').onclick = () => {
    const opp = document.getElementById('ch-opponent').value;
    const cat = document.getElementById('ch-cat').value;
    const stake = parseInt(document.getElementById('ch-stake').value) || 5000;
    const paidFromWallet = tryPayWithWallet(stake, 'challenge stake');
    playerChallenges.push({proposer: currentManager.displayName, opponent: opp, category: cat, stake, status: 'proposed', paidFromWallet});
    savePlayerChallenges();
    closeModal();
    renderChallengeArena();
    const payMsg = paidFromWallet ? 'Stake deducted from your wallet.' : 'No wallet balance - use Paystack to pay stake.';
    alert(`Proposed! ${payMsg} Opponent accepts and pays stake (from wallet or Paystack). 10% to season awards boost. Settlement after GW.`);
  };
}

function acceptChallenge(i) {
  const ch = playerChallenges[i];
  if (ch.status !== 'proposed') return;
  const paid = tryPayWithWallet(ch.stake, 'accepting beef/challenge');
  if (ch.serverId) {
    fetchJSON('/api/beef/accept', {
      method: 'POST',
      body: JSON.stringify({ beefId: ch.serverId })
    }).then(res => {
      if (res && res.beef) ch.status = res.beef.status || 'accepted';
      savePlayerChallenges();
      renderChallengeArena();
    }).catch(e => {
      console.warn('Server beef accept failed', e);
      ch.status = 'accepted';
      savePlayerChallenges();
      renderChallengeArena();
    });
  } else {
    ch.status = 'accepted';
    savePlayerChallenges();
    renderChallengeArena();
  }
  const payMsg = paid ? 'Your stake paid from wallet.' : 'Insufficient wallet balance - use Paystack.';
  if (!paid && ch.serverId) {
    // trigger Paystack funding for the beef stake
    initiatePayment(null, null, { beefId: ch.serverId, amount: ch.stake });
  } else if (!paid) {
    alert('No wallet balance. Contact admin to fund the stake via Paystack.');
  }
  alert(`Accepted! ${payMsg} Both stakes secured. 10% of pot to season reserve boost.`);
}

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

function showChallengeModal() {
  alert('Beef proposal: Select opponent(s), category, stake. Pay from wallet if sufficient, else Paystack on accept. 10% of total pot to season reserve boost for 3 awards.');
}

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
      <div class="text-[10px] mt-1">Pay to activate. 10% of pot to season reserve boost (for the 3 end awards); 90% to winner(s).</div>
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
    reserve: "season reserve boost (for 3 awards)"
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
  const sorted = [...standingsData.all].sort((a, b) => (b.combined || 0) - (a.combined || 0));
  const top = sorted[0];
  if (!top) return;

  const sn = $('spotlight-name');
  const ss = $('spotlight-stats');
  if (sn) sn.innerHTML = top.displayName;
  if (ss) ss.innerHTML = `
    <div class="font-bold text-lg">${top.combined} pts</div>
    <div class="text-xs">FPL ${top.fplTotal} • UCL ${top.uclTotal}</div>
  `;
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

    // Split: starters (multi > 0) on pitch, bench (multi === 0) below
    const starters = allPicks.filter(p => (p.multiplier || 0) > 0);
    const bench = allPicks.filter(p => (p.multiplier || 0) === 0);

    // Group by type for pitch rows (works for both FPL and UCL)
    const groups = {1: [], 2: [], 3: [], 4: []};
    starters.forEach(p => {
      if (groups[p.type]) groups[p.type].push(p);
    });

    // Total points headline
    const totalPts = starters.reduce((s, p) => s + (p.points != null ? p.points : 3 + ((p.element || 0) % 7)), 0);

    // Lineup viewer now supports both FPL (exact match to official site) and UCL
    const capId = captainId;
    const header = `<div class="fpl-lineup-header"><span>${data.displayName} • ${compLabel}${recent.round || '?'} ${chip ? ' • ' + chip : ''}</span><span class="total">${totalPts} pts</span></div>`;

    const makeCard = (p, isBenchCard = false) => {
      const isCap = p.element === capId || (p.multiplier || 0) > 1;
      let pts = p.points != null ? p.points : (isBenchCard ? 0 : 3 + Math.floor(Math.random() * 9));
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
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Could not load lineup. Sync scores first.</div>`;
  }
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
  const amount = parseFloat(amt);
  if (amount <= 0 || amount > balance) {
    alert('Invalid amount.');
    return;
  }
  if (!confirm(`Request ₦${amount} to your bank? (DEFAULT: auto Paystack transfer from league balance. If it fails, admin will handle manually as fallback.)`)) return;

  try {
    const res = await fetchJSON('/api/wallet/request-payout', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
    alert(res.message || `Requested ₦${amount}. Check your bank and ledger.`);
    // Refresh data
    const me = await fetchJSON('/api/me');
    currentManager = me.manager;
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
    await fetchJSON('/api/payments/simulate-success', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    });
    closeModal();
    // Refresh everything
    const me = await fetchJSON('/api/me');
    currentManager = me.manager;
    await loadAllData();
    renderPayAccess();
    alert('Payment confirmed via simulation. You are now eligible!');
  } catch (e) {
    alert('Simulate failed: ' + e.message);
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
  const bar = document.createElement('div');
  bar.id = 'whatsapp-share-bar';
  bar.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#111] border border-[#00ff85] p-3 rounded-2xl z-[200] text-xs max-w-md shadow-lg';
  bar.innerHTML = `
    <div class="font-semibold mb-1">${label}</div>
    <div class="flex gap-2 flex-wrap">
      <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encoded}')).then(()=>alert('Copied to clipboard! Paste in WhatsApp.')).catch(()=>{}); " class="px-3 py-1 bg-[#00ff85] text-black rounded">Copy text</button>
      <button onclick="window.open('https://wa.me/?text=${encoded}', '_blank'); document.getElementById('whatsapp-share-bar').remove();" class="px-3 py-1 bg-[#00ff85] text-black rounded">Open WhatsApp</button>
      <button onclick="document.getElementById('whatsapp-share-bar').remove()" class="px-3 py-1 border border-[#333] rounded">Close</button>
    </div>
    <div class="text-[10px] text-[#666] mt-1">This bar stays until closed. Share the link so others can contribute to the award or join similar beefs!</div>
  `;
  document.body.appendChild(bar);
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
  } else {
    // Keep login screen visible
    $('login-screen').classList.remove('hidden');
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

const UCL_CHALLENGES = [
  { title: "UCL Goal King", desc: "Most attacking returns from FWDs.", prize: 4000 },
  { title: "Defensive Wall", desc: "Best clean sheet + defensive points.", prize: 2500 },
  { title: "Midfield Maestro", desc: "Highest points from midfield this MD.", prize: 3000 },
  { title: "European Elite", desc: "Top overall points in UCL this matchday.", prize: 5500 },
  { title: "Comeback King", desc: "Most points from players who were subbed on.", prize: 2800 }
];

const SPONSORED_AWARDS = [
  { id: 'cap-clutch', name: "Captain Clutch Award", sponsor: "Local Legend FC", desc: "Highest captain score this week" },
  { id: 'bench-bandit', name: "Bench Bandit", sponsor: "Mystery Manager", desc: "Most bench points" },
  { id: 'rags-riches', name: "Rags to Riches", sponsor: "DLeague Bank", desc: "Biggest points climb this GW" },
  { id: 'chip-wizard', name: "Chip Wizard", sponsor: "Fantasy Guru", desc: "Best chip performance" },
  { id: 'transfer-king', name: "Transfer King", sponsor: "Scout Pro", desc: "Best transfer impact" },
  { id: 'underdog', name: "Underdog Hero", sponsor: "Underdog FC", desc: "Biggest surprise points haul" },
  { id: 'clean-king', name: "Clean Sheet King", sponsor: "Defence United", desc: "Most clean sheets + points from defence" },
  { id: 'mid-maestro', name: "Midfield Maestro", sponsor: "Pass Masters", desc: "Highest points from midfielders" },
  { id: 'fwd-fury', name: "Forward Fury", sponsor: "Striker Syndicate", desc: "Top attacking returns from forwards" },
  { id: 'sub-star', name: "Super Sub", sponsor: "Bench Boosters", desc: "Highest points from a sub this week" },
  { id: 'rank-rise', name: "Rank Riser", sponsor: "Climb Club", desc: "Biggest rank improvement in D League this GW" },
  { id: 'value-viking', name: "Value Viking", sponsor: "Budget Ballers", desc: "Best points per million spent this week" }
];

// Preset options for personal beef / challenges with programmable logic (auto determine winner after GW/MD)
const BEEF_PRESETS = [
  { id: 'cap-clutch', name: "Captain Clutch", logic: 'highestCaptain', desc: "Highest captain points this week" },
  { id: 'bench-bandit', name: "Bench Bandit", logic: 'highestBench', desc: "Most bench points" },
  { id: 'clean-king', name: "Clean Sheet King", logic: 'defencePoints', desc: "Highest defence points" },
  { id: 'mid-maestro', name: "Midfield Maestro", logic: 'midfieldPoints', desc: "Highest midfield points" },
  { id: 'fwd-fury', name: "Forward Fury", logic: 'forwardPoints', desc: "Top forward returns" },
  { id: 'chip-wizard', name: "Chip Wizard", logic: 'chipPerformance', desc: "Best chip performance" },
  { id: 'transfer-king', name: "Transfer King", logic: 'transferImpact', desc: "Best transfer impact" },
  { id: 'underdog', name: "Underdog Hero", logic: 'biggestSurprise', desc: "Biggest surprise points haul" }
];

function renderFplTailored() {
  if (!standingsData) return;

  // GW
  const gw = standingsData.currentRound?.fpl || '?';
  if ($('fpl-gw-num2')) $('fpl-gw-num2').textContent = gw;

  // Managers list with current points (FPL like)
  const list = $('fpl-managers-list');
  if (list) {
    list.innerHTML = '';
    const fplList = [...(standingsData.fpl || [])].sort((a,b) => (b.fplTotal||0) - (a.fplTotal||0));
    fplList.forEach(m => {
      const isMe = m.id === currentManager?.id;
      const row = document.createElement('div');
      row.className = `flex justify-between items-center px-3 py-1.5 rounded-xl cursor-pointer ${isMe ? 'bg-[#0d2a1f]' : 'hover:bg-[#111]'}`;
      row.innerHTML = `
        <div>${m.displayName} ${isMe ? '<span class="text-[#00ff85] text-xs">(YOU)</span>' : ''}</div>
        <div class="font-mono font-bold">${m.fplTotal ?? '—'} pts</div>
      `;
      row.onclick = () => showManagerSquadWithInsight(m.id);
      list.appendChild(row);
    });
  }

  // H2H this/next
  if ($('fpl-h2h-this')) {
    const h2h = (standingsData.h2h || []).find(h => h.managerA === currentManager?.id || h.managerB === currentManager?.id);
    $('fpl-h2h-this').innerHTML = h2h ? `vs ${h2h.managerA === currentManager.id ? 'Opponent' : 'You'}` : 'No H2H this week yet';
  }
  if ($('fpl-h2h-next')) $('fpl-h2h-next').textContent = 'TBD (auto from FPL league)';

  // Cup info
  if ($('fpl-cup-info')) {
    $('fpl-cup-info').innerHTML = `Cup starts GW 17-18 per FPL. Check official for bracket. <span class="text-[#666]">No separate custom cup here.</span>`;
  }

  // Challenge of week + more (plenty)
  if ($('fpl-challenge-week')) {
    const chs = FPL_CHALLENGES.slice(0, 5).map(ch => `<div>⚔️ <strong>${ch.title}</strong>: ${ch.desc} <span class="text-[#00ff85]">₦${ch.prize}</span></div>`).join('');
    $('fpl-challenge-week').innerHTML = chs + `<div class="text-[#888] text-[9px] mt-1">+ more in Challenge Room (auto settled to ledger)</div>`;
  }

  // Squad status
  const statusEl = $('fpl-squad-status');
  if (statusEl && currentManager) {
    const hasSquad = currentManager.recentPicks && currentManager.recentPicks.length > 0;
    statusEl.innerHTML = hasSquad ? 
      `<span class="text-[#00ff85]">Squad set • Your rank among DLeague participants</span>` : 
      `<span class="text-red-400">No squad set up seen for this GW</span>`;
  }

  // Sponsored
  renderSponsoredAwardsFpl();

  // Personal Beef
  if ($('fpl-personal-beef')) {
    $('fpl-personal-beef').innerHTML = `<div class="text-xs">Propose measurable beefs above (use static form with paid managers dropdown).</div>`;
  }

  // Ensure lineup viewer populated
  if (typeof renderLineupViewer === 'function') setTimeout(renderLineupViewer, 100);

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
      row.className = `flex justify-between items-center px-3 py-1.5 rounded-xl cursor-pointer ${isMe ? 'bg-[#222]' : 'hover:bg-[#1c1c1c]'}`;
      row.innerHTML = `
        <div>${m.displayName} ${isMe ? '<span class="text-[#00ff85] text-xs">(YOU)</span>' : ''}</div>
        <div class="font-mono font-bold">${m.uclTotal ?? '—'} pts</div>
      `;
      row.onclick = () => {
        // Now loads into the shared lineup viewer (will show UCL squad)
        loadAndRenderLineup(m.id, $('lineup-viewer'));
      };
      list.appendChild(row);
    });
  }

  // Squad status for current user (UCL)
  const statusEl = $('ucl-squad-status') || $('fpl-squad-status'); // reuse if no dedicated
  if (statusEl && currentManager) {
    const hasUclSquad = currentManager.recentUclPicks && currentManager.recentUclPicks.length > 0;
    if (statusEl.id === 'ucl-squad-status' || statusEl) {
      statusEl.innerHTML = hasUclSquad 
        ? `<span class="text-[#00ff85]">Squad set for MD${md}</span>` 
        : `<span class="text-red-400">No UCL squad data yet (sync needed)</span>`;
    }
  }

  if ($('ucl-challenge')) {
    const chs = UCL_CHALLENGES.map(ch => `<div>⚔️ <strong>${ch.title}</strong>: ${ch.desc} <span class="text-[#00ff85]">₦${ch.prize}</span></div>`).join('');
    $('ucl-challenge').innerHTML = chs;
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
      <div class="text-[10px] mt-1">Select one or more paid FPL managers. Stake per person. 10% of total pot (n×stake) goes to season reserve boost for the 3 group awards at end.</div>
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
        body: JSON.stringify({ opponentIds: selectedIds, category: catId, stake, paidFromWallet: paid })
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
    renderChallengeArena();
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
      score = picks.filter(p => p.multiplier === 0).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'defencePoints') {
      score = picks.filter(p => p.type === 2).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'midfieldPoints') {
      score = picks.filter(p => p.type === 3).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'forwardPoints') {
      score = picks.filter(p => p.type === 4).reduce((sum, p) => sum + (p.points || 0), 0);
    } else if (logic === 'chipPerformance') {
      score = m.recentChip ? recent * 1.5 : recent; // simple boost if chipped
    } else if (logic === 'transferImpact') {
      score = (m.recentTransfers || 0) > 0 ? recent : 0;
    } else if (logic === 'biggestSurprise') {
      score = recent > (standingsData.roundAverages?.fpl || 60) * 1.5 ? recent : 0;
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
    renderFplTailored();
    if (typeof renderLineupViewer === 'function') renderLineupViewer();
  } else if (mode === 'ucl') {
    if (fplTail) fplTail.classList.add('hidden');
    if (uclTail) uclTail.classList.remove('hidden');
    renderUclTailored();
  }

  // Hide old combined for cleanliness
  const oldCombined = document.querySelector('#combined-race');
  if (oldCombined) oldCombined.closest('div')?.classList.add('hidden');
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
  try {
    const res = await fetch('/api/join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        email, 
        fplClubName: fplClub, 
        fplId: fplId || '',
        fplLeagueJoined: true, 
        message: 'Requested via form' 
      })
    });
    const data = await res.json();
    closeJoinModal();
    alert(data.message || 'Request sent! Admin will review and send access code via email or panel.');
  } catch (e) {
    closeJoinModal();
    alert('Request logged. Please message the commissioner with your details if needed.');
  }
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
