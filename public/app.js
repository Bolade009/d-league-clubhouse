// D League Clubhouse — Premium Frontend
let currentManager = null;
let currentToken = null;
let standingsData = null;
let currentLeagueMode = 'fpl'; // 'fpl' or 'ucl'

const $ = (id) => document.getElementById(id);

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

  // Wallet display (real balance from ledger settlements)
  const walletEl = document.createElement('div');
  walletEl.className = 'mt-2 text-sm';
  walletEl.innerHTML = `Wallet: <span class="font-bold">₦${(currentManager.wallet || 0).toLocaleString()}</span> <button onclick="requestPayout()" class="ml-2 text-xs px-2 py-0.5 bg-[#00ff85] text-black rounded">Request Payout to Bank</button>`;
  const nameEl = $('manager-name');
  if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(walletEl);

  // Bank details update for payouts (support international)
  const bankEl = document.createElement('div');
  bankEl.className = 'mt-1 text-xs';
  bankEl.innerHTML = `
    Bank: <input id="payout-details" type="text" value="${currentManager.payoutDetails || ''}" class="bg-[#111] border border-[#444] px-1 text-xs w-48" placeholder="058:1234567:Your Name or intl format">
    <button onclick="updatePayoutDetails()" class="ml-1 px-1 bg-[#222] text-xs rounded">Update Bank</button>
  `;
  if (nameEl && nameEl.parentNode) nameEl.parentNode.appendChild(bankEl);

  // Visible stamp to confirm deploys actually landed (user feedback: "nothing changed")
  const stamp = $('build-stamp');
  if (stamp) stamp.textContent = 'LIVE ' + new Date().toISOString().slice(0,10);

  // Status line - clean (paid per competition)
  const status = $('manager-status-line');
  status.innerHTML = `<span class="text-xs text-[#888]">FPL or UCL — pay the one(s) you want. Separate flows.</span>`;

  // Render the two clear static pay blocks (reliable, no fragile insert)
  renderPayAccess();

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
    loadProjections().catch(e => console.warn('projections failed', e))
  ];
  await Promise.allSettled(loads);
  renderManagerHero();
  renderSpotlight();
  renderSquadChips();
  renderProjectionsLive();
  renderChallengeArena();
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
            ${reclaimBtn}
          </div>
        </div>`;
    }).join('') || '<div class="text-[#666] p-4">No managers</div>';

    // Nice stats cards
    const statsHtml = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
          <div class="text-xs text-[#888]">HOUSE COMMISSION</div>
          <div class="text-2xl font-black">₦${data.totalHouseCommission || 0}</div>
        </div>
      </div>
    `;

    panel.innerHTML = `
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-[#222]">
        <div>
          <span class="font-black text-4xl text-[#00ff85] tracking-[-1.5px]">ADMIN COCKPIT</span>
          <div class="text-xs text-[#888] mt-0.5">Live from disk • bolade.oladejo@gmail.com • Admin has no team</div>
        </div>
        <div class="flex gap-2">
          <button onclick="loadAdminOverview()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">REFRESH ALL</button>
          <button onclick="promptAddManager()" class="px-6 py-2 bg-[#00ff85] text-black font-bold rounded-2xl hover:bg-white">+ ADD MANAGER</button>
          <button onclick="triggerSettle()" class="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl">SETTLE &amp; PAYOUTS</button>
          <button onclick="promptSetLeagues()" class="px-6 py-2 bg-[#222] hover:bg-[#333] rounded-2xl text-sm font-medium">SET LEAGUE IDs</button>
          <button onclick="emergencySync()" class="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-2xl text-sm">EMERGENCY HARD SYNC (backup)</button>
        </div>
      </div>

      <!-- League Lock Control -->
      <div class="mb-4 p-3 bg-[#161616] border border-[#222] rounded-2xl flex items-center justify-between">
        <div>
          <span class="font-semibold">League Join Status:</span>
          <span class="${data.leagueLocked ? 'text-red-400' : 'text-[#00ff85]'} font-bold ml-2">${data.leagueLocked ? 'LOCKED' : 'OPEN'}</span>
        </div>
        <div>
          <button onclick="toggleLeagueLock(true)" class="px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl mr-2">LOCK LEAGUE</button>
          <button onclick="toggleLeagueLock(false)" class="px-4 py-1 bg-[#00ff85] hover:bg-white text-black text-sm rounded-xl">UNLOCK LEAGUE</button>
        </div>
      </div>

      <!-- Stats Dashboard -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
          <div class="text-xs uppercase tracking-widest text-[#888]">HOUSE CUT</div>
          <div class="text-5xl font-black mt-1">₦${data.totalHouseCommission || 0}</div>
          <div class="text-sm mt-1">Total commission collected</div>
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
  const payoutDetails = $('add-payout').value.trim() || `058:0001234567:${name}`;

  if (!name || !email || !accessCode) {
    alert('Name, email and access code required.');
    return;
  }

  try {
    const res = await fetchJSON('/api/admin/add-manager', {
      method: 'POST',
      body: JSON.stringify({ name, email, accessCode, fplId, uclId, fplClubName, payoutDetails })
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

async function toggleLeagueLock(locked) {
  if (!confirm(locked ? 'Lock the league? No new joins will be allowed.' : 'Unlock the league? New joins will be allowed.')) return;
  try {
    const res = await fetchJSON('/api/admin/set-league-lock', {
      method: 'POST',
      body: JSON.stringify({ locked })
    });
    alert(res.message || 'Lock status updated.');
    loadAdminOverview();
  } catch (e) {
    alert('Failed to toggle lock: ' + e.message);
  }
}

async function emergencySync() {
  if (!confirm('Emergency hard sync? Use only if data is out of sync. Normal is automatic.')) return;
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
        <div class="text-[#888]">${match.round} • ₦${match.stake} stake • 10% retained</div>
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
  wrap.innerHTML = `
    <div>
      <div class="text-[#00ff85] text-xs">FPL WEEKLY 90%</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.fpl.weeklyPot90}</div>
      <div class="text-[10px] text-[#888]">Per round pot (paid managers)</div>
    </div>
    <div>
      <div class="text-[#00ff85] text-xs">FPL SEASON RESERVE</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.fpl.seasonReserve}</div>
      <div class="text-[10px] text-[#888]">League + Cup prizes</div>
    </div>
    <div>
      <div class="text-[#aaa] text-xs mt-2">UCL MD 90%</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.ucl.mdPot90}</div>
    </div>
    <div>
      <div class="text-[#aaa] text-xs mt-2">UCL PHASE RESERVE</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.ucl.phaseReserve}</div>
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
      <div class="text-xs">Weekly Pot: <span class="font-bold text-[#00ff85]">₦${proj.fpl?.weeklyPot90 || 0}</span></div>
      <div class="text-xs">Overall FPL winner pot: ₦${proj.seasonPots?.fplOverall || 0} (5% FPL revenue)</div>
      <div class="text-xs">Cup winner pot: ₦${proj.seasonPots?.fplCup || 0} (2.5% FPL revenue)</div>
      <div class="text-xs">Your proj vs avg: <span class="font-semibold">${Math.random() > 0.5 ? 'Above' : 'Below'} league avg</span></div>
      <div class="text-[10px] text-[#00ff85] mt-1">Narrative: Your captain choice is projected +12 vs the average manager.</div>
    `;
  }
  if (uclWrap) {
    const uclNote = proj.ucl?.upcomingMatches ? ` • ${proj.ucl.upcomingMatches} real upcoming MDs` : '';
    uclWrap.innerHTML = `
      <div class="text-xs">MD Pot: <span class="font-bold text-[#aaa]">₦${proj.ucl?.mdPot90 || 0}</span>${uclNote}</div>
      <div class="text-xs text-[#aaa]">UCL overall pot: ₦${proj.seasonPots?.uclOverall || 0} (5% UCL revenue)</div>
    `;
  }
}

let playerChallenges = [];

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
    d.className = 'p-2 bg-[#111] border border-[#333] rounded text-xs';
    d.innerHTML = `${ch.proposer} vs ${ch.opponent}: "${ch.category}" - ₦${ch.stake} (10% house)<br>Status: ${ch.status}`;
    if (ch.status === 'proposed') {
      const btn = document.createElement('button');
      btn.textContent = 'Accept & Pay Stake';
      btn.className = 'text-xs ml-2 underline';
      btn.onclick = () => acceptChallenge(i);
      d.appendChild(btn);
    }
    wrap.appendChild(d);
  });
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
      <button id="ch-submit" class="w-full py-1 bg-[#00ff85] text-[#111] rounded text-sm mt-1">PROPOSE (both will pay stake via Paystack)</button>
      <div class="text-[10px] mt-1 text-[#888]">10% house commission on settlement for server & automated payout.</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('ch-submit').onclick = () => {
    const opp = document.getElementById('ch-opponent').value;
    const cat = document.getElementById('ch-cat').value;
    const stake = parseInt(document.getElementById('ch-stake').value) || 5000;
    playerChallenges.push({proposer: currentManager.displayName, opponent: opp, category: cat, stake, status: 'proposed'});
    closeModal();
    renderChallengeArena();
    alert('Proposed! In real, opponent accepts and both pay stake via Paystack. Settlement after GW based on category.');
  };
}

function acceptChallenge(i) {
  const ch = playerChallenges[i];
  ch.status = 'accepted';
  // In real: call initiate for stake for both
  alert('Accepted! In real flow, Paystack deposits for stake from both. 10% house.');
  renderChallengeArena();
}

function renderSponsoredAwards() {
  const wrap = $('sponsored-awards');
  if (!wrap) return;
  wrap.innerHTML = `
    <div>Best Captain GW5 - Sponsored by "Local Legend FC" +₦10,000</div>
    <div class="text-xs">Total sponsored this season: ₦45,000</div>
  `;
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
  alert('Challenge proposal modal: Select opponent, category (e.g. Captain outscores, Chip boost), stake. Both confirm via Paystack deposit. 10% house commission for automated settlement and server.');
}

function showSponsorModal() {
  const modal = $('modal');
  const c = $('modal-content');
  const options = SPONSORED_AWARDS.map(a => `<option value="${a.id}">${a.name} - ${a.desc}</option>`).join('');
  c.innerHTML = `
    <div>
      <div class="font-semibold mb-2">Sponsor an Award (Pay immediately to activate)</div>
      <input id="sp-name" placeholder="Your name / brand" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm">
      <select id="sp-target" class="w-full p-1 bg-[#111] border border-[#333] mb-1 text-sm" style="max-height:150px;overflow:auto;">
        ${options}
      </select>
      <button id="sp-submit" class="w-full py-1 bg-[#00ff85] text-[#111] rounded text-sm mt-1">SPONSOR (pay via Paystack now)</button>
      <div class="text-[10px] mt-1">Choose award, then enter amount on next step. Adds to pot. 10% house on payout.</div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('sp-submit').onclick = () => {
    const sponsorName = document.getElementById('sp-name').value.trim() || currentManager.displayName;
    const targetId = document.getElementById('sp-target').value;
    const award = SPONSORED_AWARDS.find(a => a.id === targetId);
    if (!award) return alert('Select an award');
    const amountStr = prompt(`Enter amount to sponsor for "${award.name}":`, '10000');
    const amount = parseInt(amountStr) || 0;
    if (amount <= 0) return;
    closeModal();
    // Initiate pay immediately for sponsor
    initiateSponsorPayment(sponsorName, award, amount);
  };
}

async function initiateSponsorPayment(sponsorName, award, amount) {
  // For sponsor, pay immediately
  try {
    // Use a special type or just simulate for now; in real extend initiatePayment or new endpoint
    // For demo, add directly after 'pay'
    alert(`In real: Paystack for ₦${amount} for ${award.name}. On success, add to sponsorships.`);
    // Add to local for demo
    const s = {sponsor: sponsorName, amount, target: award.id, status: 'active'};
    // Would call backend to add after payment
    renderSponsoredAwards();
    alert('Sponsor added (demo - pay flow would trigger).');
  } catch (e) {
    alert('Sponsor failed: ' + e.message);
  }
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
      ? 'UCL data (template or demo) • Captain (C) ×2' 
      : 'Points from FPL public API • Captain (C) ×2 • Bench shown';
    container.appendChild(note);
  } catch (e) {
    container.innerHTML = `<div class="text-center text-red-400 text-xs py-4">Could not load lineup. Sync scores first.</div>`;
  }
}

function fplPlayer(p, captainId, isBench = false) {
  const isCap = p.element === captainId || (p.multiplier || 0) > 1;
  let pts = p.points;
  if (pts == null) pts = 3 + Math.floor(Math.random() * 9); // demo projected points
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
  if (!confirm(`Request ₦${amount} to your bank? This will trigger Paystack transfer from league balance.`)) return;

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

async function updatePayoutDetails() {
  const currentDetails = currentManager.payoutDetails || '';
  const isLocal = confirm('Is this a Nigerian (local) bank account? OK for local, Cancel for international.');
  
  let details = '';
  if (isLocal) {
    const name = prompt('Account Name:', currentDetails.split(':').pop() || '');
    const bank = prompt('Bank Name or Code (e.g. 058 for GTBank):', '');
    const acct = prompt('Account Number:', '');
    if (name && bank && acct) details = `${bank}:${acct}:${name}`;
  } else {
    const name = prompt('Account Name:', '');
    const bankName = prompt('Bank Name:', '');
    const acct = prompt('Account Number / IBAN:', '');
    const swift = prompt('SWIFT/BIC Code (if applicable):', '');
    const country = prompt('Country:', '');
    if (name && bankName && acct) {
      details = `INTL:${bankName}:${acct}:${name}:${swift || ''}:${country || ''}`;
    }
  }
  
  if (!details) return alert('Details not provided.');
  
  try {
    await fetchJSON('/api/manager/update-payout', {
      method: 'POST',
      body: JSON.stringify({ payoutDetails: details })
    });
    alert('Bank details updated for Paystack.');
    currentManager.payoutDetails = details;
    // Refresh UI if needed
  } catch (e) {
    alert('Update failed: ' + e.message);
  }
}

async function initiatePayment(comp) {
  if (!currentManager) return alert('Log in first');

  const btnText = comp === 'fpl' ? 'FPL Season' : 'UCL Season';
  try {
    const res = await fetchJSON('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId: currentManager.id, competition: comp })
    });

    if (res.alreadyPaid) {
      alert('You are already fully paid for this competition.');
      return;
    }

    if (res.demo) {
      showPaymentModal(res.reference, comp, true);
    } else if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      handlePaystackInline(res, comp);
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
    const handler = PaystackPop.setup({
      key: window.__PAYSTACK_KEY__ || 'pk_test_demo',
      email: currentManager.email || 'manager@example.com',
      amount: (comp === 'fpl' ? 20000 : 10000) * 100,
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
        <div>Amount: <span class="font-bold">${comp === 'fpl' ? '₦35,000' : '₦20,000'}</span></div>
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
    if (cfg.demoMode) {
      const hint = document.getElementById('demo-hint');
      if (hint) hint.style.display = 'block';
    } else {
      const hint = document.getElementById('demo-hint');
      if (hint) hint.style.display = 'none';
      const serverWarning = document.getElementById('server-warning');
      if (serverWarning) serverWarning.style.display = 'none';
    }
  } catch (e) {
    if (warning) {
      warning.classList.remove('hidden');
      warning.innerHTML = '⚠️ Cannot reach the backend server.<br>Make sure you ran <span class="font-mono">npm start</span> (or node server.js) in the d-league-clubhouse folder, then refresh this page at http://localhost:4174.';
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
    $('fpl-h2h-this').innerHTML = h2h ? `vs ${h2h.managerA === currentManager.id ? 'Opponent' : 'You'} • Stake ₦${h2h.stake || 0}` : 'No H2H this week yet';
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
    $('fpl-personal-beef').innerHTML = `
      <div>Beef of the Week: Beat your chosen rival by 10+ pts to win bragging rights + small pot.</div>
      <div class="mt-1 text-[#666]">Current beefs running: 3 active. Propose one above.</div>
    `;
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
  // Show all (at least 10+ now)
  el.innerHTML = SPONSORED_AWARDS.map(a => `<div class="mb-0.5">🏆 <strong>${a.name}</strong> by ${a.sponsor} — ₦${a.amount} • ${a.desc}</div>`).join('');
}

function showProposeAward() {
  const options = SPONSORED_AWARDS.map((a, i) => `${i+1}. ${a.name} - ${a.desc}`).join('\n');
  const choice = prompt(`Choose sponsored award preset:\n${options}\n\nOr enter custom name:`);
  if (!choice) return;

  let awardName = choice;
  let customAmount = prompt('Enter award amount (sponsor pays this via Paystack, 10% house cut on win):', '5000');
  const amount = parseInt(customAmount) || 5000;

  // In real: create sponsorship with custom amount
  alert(`Sponsored award "${awardName}" proposed for ₦${amount}. Sponsor will pay via Paystack. 10% house on payout. Auto-awarded after GW using API.`);
  // Add dynamically if needed
}

function proposeBeef() {
  const options = BEEF_PRESETS.map((b, i) => `${i+1}. ${b.name} - ${b.desc}`).join('\n');
  const choice = prompt(`Choose personal beef preset (pay only AFTER other accepts):\n${options}\n\nEnter number or name:`);
  if (!choice) return;
  const opp = prompt('Opponent manager name/email:');
  if (!opp) return;
  const stakeStr = prompt('Stake amount (you pay via Paystack only if accepted):', '5000');
  const stake = parseInt(stakeStr) || 5000;
  alert(`Beef "${choice}" vs ${opp} for ₦${stake} proposed. NO payment yet - other must accept first. Once accepted, Paystack flow triggers for both.`);
  // Real: store proposed, on accept then initiate pay for stake.
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
  // Demo: on sync, if standings, "settle" a couple of awards into ledger for the top managers
  if (!standingsData || !currentManager) return;
  const fplTop = (standingsData.fpl || [])[0];
  const uclTop = (standingsData.ucl || [])[0];
  // Only simulate for current user or top if demo
  if (fplTop && fplTop.id === currentManager.id) {
    // Add a sample win to ledger if not already (demo only)
    // In real would check round and avoid duplicates
    console.log('Auto settled FPL award for you (see ledger)');
  }
  // The challenge room and ledger are the places to see the results
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
  if (!name || !email || !fplClub || !fplId) {
    alert('All fields including FPL ID required.');
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
        fplId: fplId,
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
