// D League Clubhouse — Premium Frontend
let currentManager = null;
let currentToken = null;
let standingsData = null;

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
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ============ LOGIN ============
async function performLogin() {
  const email = $('login-email').value.trim();
  const code = $('login-code').value.trim();

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
    alert('Login failed: ' + e.message);
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
        <div class="text-sm font-semibold">${currentManager.displayName}</div>
        <div class="text-[10px] text-emerald-400 -mt-0.5">${currentManager.fplPaid && currentManager.uclPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}</div>
      </div>
      <div class="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-[#0A0F1C] font-black text-lg">
        ${currentManager.displayName[0]}
      </div>
    </div>
  `;

  $('welcome-line').textContent = `WELCOME BACK, MANAGER • ${new Date().getFullYear()}`;
  $('manager-name').textContent = currentManager.displayName;

  // Status line
  const status = $('manager-status-line');
  const fplPaid = currentManager.fplPaid;
  const uclPaid = currentManager.uclPaid;
  let badges = '';
  if (fplPaid) badges += `<span class="px-2.5 py-px text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">FPL PAID</span>`;
  if (uclPaid) badges += `<span class="px-2.5 py-px text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">UCL PAID</span>`;
  if (!fplPaid && !uclPaid) badges = `<span class="px-2.5 py-px text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/30">PAYMENT REQUIRED</span>`;
  status.innerHTML = `${badges} <span class="text-xs text-slate-400">• ELIGIBLE FOR PRIZES ONLY WHEN FULLY PAID</span>`;

  // Populate hero stats immediately from the data we already have
  renderManagerHero();
}

async function loadAllData() {
  const loads = [
    loadStandings().catch(e => console.warn('standings load failed', e)),
    loadTicker().catch(e => console.warn('ticker failed', e)),
    loadH2H().catch(e => console.warn('h2h failed', e)),
    loadCup().catch(e => console.warn('cup failed', e)),
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
}

async function loadStandings() {
  standingsData = await fetchJSON('/api/standings');
  renderCombinedRace();
  renderFPLRace();
  renderUCLRace();
  renderFullTable();
}

function renderCombinedRace() {
  const container = $('combined-race');
  container.innerHTML = '';
  const list = standingsData.combined || [];

  if (!list.length) {
    container.innerHTML = `<div class="text-slate-400 text-sm py-2">No fully paid managers yet.</div>`;
    return;
  }

  list.slice(0, 8).forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = `flex items-center justify-between px-4 py-[9px] rounded-2xl ${m.id === currentManager.id ? 'bg-white/5' : ''}`;
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 text-center font-mono text-xs text-slate-400">${idx + 1}</div>
        <div>
          <div class="font-semibold">${m.displayName} ${m.id === currentManager.id ? '<span class="text-[10px] ml-1 text-emerald-400">(YOU)</span>' : ''}</div>
          <div class="text-[10px] text-slate-400">${m.fplTeam.teamName || ''}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="font-black tabular-nums text-xl tracking-tighter">${m.combined}</div>
        <div class="text-[9px] text-emerald-400">COMBINED</div>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderFPLRace() {
  const wrap = $('fpl-race');
  $('fpl-gw-num').textContent = standingsData.currentRound.fpl;
  wrap.innerHTML = '';
  const list = standingsData.fpl || [];

  if (!list.length) {
    wrap.innerHTML = `<div class="text-xs text-slate-500">No paid FPL managers.</div>`;
    return;
  }

  list.slice(0, 6).forEach((m, i) => {
    const el = document.createElement('div');
    el.className = `flex justify-between items-center px-3 py-1.5 rounded-xl ${m.id === currentManager.id ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`;
    el.innerHTML = `
      <div class="flex gap-2 items-center">
        <span class="font-mono text-xs w-4 text-slate-400">${i+1}</span>
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
  $('ucl-md-num').textContent = standingsData.currentRound.ucl;
  wrap.innerHTML = '';
  const list = standingsData.ucl || [];

  if (!list.length) {
    wrap.innerHTML = `<div class="text-xs text-slate-500">No paid UCL managers.</div>`;
    return;
  }

  list.slice(0, 6).forEach((m, i) => {
    const el = document.createElement('div');
    el.className = `flex justify-between items-center px-3 py-1.5 rounded-xl ${m.id === currentManager.id ? 'bg-blue-500/10' : 'hover:bg-white/5'}`;
    el.innerHTML = `
      <div class="flex gap-2 items-center">
        <span class="font-mono text-xs w-4 text-slate-400">${i+1}</span>
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
  tbody.innerHTML = '';

  const all = standingsData.all || [];
  const sorted = [...all].sort((a, b) => (b.combined || 0) - (a.combined || 0));

  sorted.forEach((m) => {
    const tr = document.createElement('tr');
    tr.className = `leader-row cursor-pointer ${m.id === currentManager.id ? 'bg-white/5' : ''}`;
    tr.onclick = () => showManagerProfile(m.id);

    const fplPaidBadge = m.fplPaid ? '<span class="text-[10px] px-1.5 py-px border border-emerald-500/30 text-emerald-400 rounded">FPL</span>' : '';
    const uclPaidBadge = m.uclPaid ? '<span class="text-[10px] px-1.5 py-px border border-blue-500/30 text-blue-400 rounded">UCL</span>' : '';

    tr.innerHTML = `
      <td class="py-2 pr-4">
        <div class="font-semibold">${m.displayName} ${m.id === currentManager.id ? '<span class="text-emerald-400 text-xs ml-1">(YOU)</span>' : ''}</div>
        <div class="text-[10px] text-slate-500">${m.fplTeam.teamName || ''} • ${m.uclTeam.teamName || ''}</div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="font-bold">${m.fplTotal ?? '—'}</div>
        <div class="text-[10px] text-emerald-400">${m.fplPaid ? 'PAID' : '—'}</div>
      </td>
      <td class="py-2 px-3 tabular-nums">
        <div class="font-bold">${m.uclTotal ?? '—'}</div>
        <div class="text-[10px] text-blue-400">${m.uclPaid ? 'PAID' : '—'}</div>
      </td>
      <td class="py-2 px-3">
        <div class="font-black text-xl tabular-nums tracking-tighter">${m.combined}</div>
      </td>
      <td class="py-2 px-3 text-xs">
        <div>FPL ${m.currentFpl ?? '—'}</div>
        <div>UCL ${m.currentUcl ?? '—'}</div>
      </td>
      <td class="py-2 px-3">
        <span class="${m.totalFines > 0 ? 'text-amber-400 font-semibold' : ''}">₦${m.totalFines || 0}</span>
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

    scoresHTML += '<div class="grid grid-cols-2 gap-4 mt-4 text-xs"><div><div class="font-semibold text-emerald-400 mb-1">Recent FPL</div>';
    fplRecent.forEach(s => {
      scoresHTML += `<div>GW${s.round}: <b>${s.points ?? '—'}</b> <span class="source-label">${s.source}</span></div>`;
    });
    scoresHTML += '</div><div><div class="font-semibold text-blue-400 mb-1">Recent UCL</div>';
    uclRecent.forEach(s => {
      scoresHTML += `<div>MD${s.round}: <b>${s.points ?? '—'}</b> <span class="source-label">${s.source}</span></div>`;
    });
    scoresHTML += '</div></div>';

    let finesHTML = '';
    if (data.fines && data.fines.length) {
      finesHTML = `<div class="mt-3"><div class="font-semibold text-amber-400 text-xs mb-1">FINES</div>`;
      data.fines.slice(0,3).forEach(f => finesHTML += `<div class="text-xs">₦500 • GW${f.round || ''} — ${f.note}</div>`);
      finesHTML += `</div>`;
    }

    c.innerHTML = `
      <div>
        <div class="font-black text-3xl">${data.displayName}</div>
        <div class="text-xs text-slate-400 mt-0.5">${data.fplTeam.teamName || ''} • ${data.uclTeam.teamName || ''}</div>
        
        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div class="bg-black/40 rounded-2xl p-3"><div class="text-xs">FPL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.fplTotal || 0}</div></div>
          <div class="bg-black/40 rounded-2xl p-3"><div class="text-xs">UCL TOTAL</div><div class="font-black text-2xl tabular-nums">${data.uclTotal || 0}</div></div>
          <div class="bg-black/40 rounded-2xl p-3"><div class="text-xs">COMBINED</div><div class="font-black text-2xl tabular-nums">${data.combined || 0}</div></div>
        </div>

        ${scoresHTML}
        ${finesHTML}

        <div class="mt-4 text-xs">
          <div class="flex justify-between"><span>Wallet</span><span class="font-semibold tabular-nums">₦${data.wallet || 0}</span></div>
          <div class="flex justify-between"><span>Fines to date</span><span class="font-semibold text-amber-400">₦${data.totalFines || 0}</span></div>
        </div>

        <div class="mt-5 text-[10px] text-emerald-400">Eligibility: ${data.eligibleFpl ? 'FPL ✓' : 'FPL unpaid'} • ${data.eligibleUcl ? 'UCL ✓' : 'UCL unpaid'}</div>

        <button onclick="closeModal()" class="w-full mt-5 py-3 border border-white/10 rounded-2xl text-sm">CLOSE PROFILE</button>
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
  $('fpl-status').innerHTML = currentManager.fplPaid ? 
    `<span class="text-emerald-400">PAID • ELIGIBLE</span>` : 
    `<span class="text-red-400">UNPAID</span>`;
  $('ucl-status').innerHTML = currentManager.uclPaid ? 
    `<span class="text-blue-400">PAID • ELIGIBLE</span>` : 
    `<span class="text-red-400">UNPAID</span>`;

  const round = (standingsData && standingsData.currentRound) || {fpl: '?', ucl: '?'};
  $('fpl-current').innerHTML = currentManager.currentFpl != null ? 
    `GW${round.fpl} • ${currentManager.currentFpl} pts <span class="source-label">${currentManager.currentFplSource || ''}</span>` : '—';
  $('ucl-current').innerHTML = currentManager.currentUcl != null ? 
    `MD${round.ucl} • ${currentManager.currentUcl} pts` : '—';

  // Compute combined rank from current standings
  const list = (standingsData && standingsData.all) || [];
  const sorted = [...list].sort((a,b) => (b.combined || 0) - (a.combined || 0));
  const rank = sorted.findIndex(x => x.id === currentManager.id) + 1;
  $('combined-rank').innerHTML = rank ? `#${rank}` : '—';

  $('total-fines').textContent = `₦${currentManager.totalFines || 0}`;
  $('wallet-balance').textContent = `₦${currentManager.wallet || 0}`;
}

async function loadTicker() {
  try {
    const t = await fetchJSON('/api/ticker');
    const el = $('ticker-content');
    el.innerHTML = '';
    t.messages.forEach((msg, i) => {
      const span = document.createElement('span');
      span.className = 'ticker-item';
      span.innerHTML = `<span class="text-emerald-400">●</span> ${msg}`;
      el.appendChild(span);
    });
  } catch {}
}

async function loadH2H() {
  const { h2h } = await fetchJSON('/api/h2h');
  const wrap = $('h2h-list');
  wrap.innerHTML = '';

  if (!h2h || !h2h.length) {
    wrap.innerHTML = `<div class="text-xs text-slate-400">No active H2H matches this round.</div>`;
    return;
  }

  h2h.forEach(match => {
    const div = document.createElement('div');
    div.className = 'h2h-card';
    const youA = match.managerA === currentManager.id;
    const youB = match.managerB === currentManager.id;
    div.innerHTML = `
      <div class="flex justify-between text-xs mb-1">
        <div class="text-slate-400">${match.round} • ₦${match.stake} stake • 10% retained</div>
        <div class="${match.status === 'settled' ? 'text-emerald-400' : 'text-amber-400'}">${match.status.toUpperCase()}</div>
      </div>
      <div class="font-medium">
        ${youA || youB ? '<span class="text-emerald-400">YOU vs </span>' : ''}${match.managerA === currentManager.id ? 'Opponent' : 'Manager'} 
        vs ${match.managerB === currentManager.id ? 'YOU' : 'Opponent'}
      </div>
      ${match.winner ? `<div class="text-[10px] mt-1">Winner: <span class="font-semibold">${match.winner === currentManager.id ? 'YOU' : 'OPPONENT'}</span></div>` : ''}
    `;
    wrap.appendChild(div);
  });
}

async function loadCup() {
  const { cup } = await fetchJSON('/api/cup');
  const wrap = $('cup-bracket');
  wrap.innerHTML = `<div class="text-xs text-emerald-400 mb-1">${cup.name} — ${cup.stage}</div>`;

  cup.bracket.forEach(m => {
    const d = document.createElement('div');
    d.className = 'cup-match flex justify-between';
    d.innerHTML = `
      <div>${m.a} <span class="text-slate-400">vs</span> ${m.b}</div>
      <div class="text-emerald-400 text-xs font-medium">${m.winner || 'TBD'}</div>
    `;
    wrap.appendChild(d);
  });
}

async function loadChallenges() {
  const { challenges } = await fetchJSON('/api/challenges');
  const wrap = $('challenges-list');
  wrap.innerHTML = '';

  challenges.forEach(ch => {
    const d = document.createElement('div');
    d.className = 'p-3 bg-black/40 rounded-2xl';
    d.innerHTML = `
      <div class="font-semibold">${ch.title}</div>
      <div class="text-xs flex justify-between mt-1">
        <span class="${ch.status === 'settled' ? 'text-emerald-400' : 'text-amber-400'}">${ch.status}</span>
        <span>₦${ch.prize} • ${ch.entrants} entered</span>
      </div>
      ${ch.winner ? `<div class="text-xs mt-0.5">Winner: ${ch.winner}</div>` : ''}
    `;
    wrap.appendChild(d);
  });
}

async function loadProjections() {
  const proj = await fetchJSON('/api/payouts');
  const wrap = $('payout-projections');
  wrap.innerHTML = `
    <div>
      <div class="text-emerald-400 text-xs">FPL WEEKLY 90%</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.fpl.weeklyPot90}</div>
      <div class="text-[10px] text-slate-400">Per round pot (paid managers)</div>
    </div>
    <div>
      <div class="text-emerald-400 text-xs">FPL SEASON RESERVE</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.fpl.seasonReserve}</div>
      <div class="text-[10px] text-slate-400">League + Cup prizes</div>
    </div>
    <div>
      <div class="text-blue-400 text-xs mt-2">UCL MD 90%</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.ucl.mdPot90}</div>
    </div>
    <div>
      <div class="text-blue-400 text-xs mt-2">UCL PHASE RESERVE</div>
      <div class="text-2xl font-black tabular-nums">₦${proj.ucl.phaseReserve}</div>
    </div>
  `;
}

function renderSquadChips() {
  const wrap = $('squad-chips');
  if (!currentManager || !standingsData) return;
  const mgrId = currentManager.id;
  const fplScore = (standingsData.all || []).find(m => m.id === mgrId) || currentManager;
  const recent = fplScore.fplScores ? fplScore.fplScores[fplScore.fplScores.length-1] : null;
  wrap.innerHTML = `
    <div>Captain: <span class="font-semibold">${recent && recent.captain ? 'Player #' + recent.captain : 'N/A'}</span></div>
    <div>Chip this week: <span class="chip-badge">${recent && recent.activeChip ? recent.activeChip : 'None'}</span></div>
    <div class="text-xs text-slate-400">Transfers: ${recent && recent.transfers || 0}</div>
    <div class="text-[10px] mt-1">Lineup available in modal</div>
  `;
}

function renderProjectionsLive() {
  const wrap = $('projections-live');
  wrap.innerHTML = `
    <div class="flex justify-between"><span>Current GW Proj</span><span class="font-bold text-emerald-400">82 pts</span></div>
    <div class="projection-bar w-[82%]" style="width: 82%"></div>
    <div class="text-xs mt-2">Live data + expected from FPL. Captain boost applied.</div>
    <div class="mt-2 text-amber-400 text-xs">Chip usage tracked per round.</div>
  `;
}

function renderChallengeArena() {
  const wrap = $('challenge-arena');
  wrap.innerHTML = `
    <div class="challenge-proposal p-2">You vs Chinedu: "Captain scores more" - 5k stake. <button class="text-xs ml-2">ACCEPT</button></div>
    <div class="text-xs text-amber-400">Creative categories supported. 10% house cut on automated settlement.</div>
  `;
}

function renderSponsoredAwards() {
  const wrap = $('sponsored-awards');
  wrap.innerHTML = `
    <div>Best Captain GW5 - Sponsored by "Local Legend FC" +₦10,000</div>
    <div class="text-xs">Total sponsored this season: ₦45,000</div>
  `;
}

function showSquadModal() {
  const modal = $('modal');
  const c = $('modal-content');
  c.innerHTML = `
    <div>
      <div class="font-black text-2xl mb-2">Ayo's FPL Squad GW5</div>
      <div class="lineup-grid mb-4">
        <div class="lineup-player captain">Haaland (C)</div>
        <div class="lineup-player">Salah</div>
        <div class="lineup-player">Palmer</div>
        <div class="lineup-player">Isak</div>
        <div class="lineup-player">Saka</div>
      </div>
      <div>Chip used: None</div>
      <div class="text-xs mt-1">Captain: Haaland • Vice: Salah</div>
      <button onclick="closeModal()" class="mt-4 w-full py-2 border rounded-2xl">CLOSE</button>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function showChallengeModal() {
  alert('Challenge proposal modal: Select opponent, category (e.g. Captain outscores, Chip boost), stake. Both confirm via Paystack deposit. 10% house commission for automated settlement and server.');
}

function showSponsorModal() {
  alert('Sponsor form: Name, amount, target award (e.g. Best Captain this GW, League Winner). Funds added to specific pot. Visible to all.');
}

function renderSpotlight() {
  if (!standingsData || !standingsData.all) return;
  const sorted = [...standingsData.all].sort((a, b) => (b.combined || 0) - (a.combined || 0));
  const top = sorted[0];
  if (!top) return;

  $('spotlight-name').innerHTML = top.displayName;
  $('spotlight-stats').innerHTML = `
    <div class="font-bold text-lg">${top.combined} pts</div>
    <div class="text-xs">FPL ${top.fplTotal} • UCL ${top.uclTotal}</div>
  `;
}

// ============ PAYMENTS ============
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
      // Show simulate button
      showPaymentModal(res.reference, comp, true);
    } else if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      // Use Paystack inline if public key available
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
      email: currentManager.email || 'manager@dleague.ng',
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
        <div class="text-sm uppercase tracking-widest text-emerald-400">PAYSTACK</div>
        <div class="text-3xl font-black tracking-[-1.2px]">Complete Payment</div>
      </div>
      <div class="bg-black/50 rounded-2xl p-4 text-sm">
        <div>Reference: <span class="font-mono">${reference}</span></div>
        <div>Amount: <span class="font-bold">${comp === 'fpl' ? '₦20,000' : '₦10,000'}</span></div>
        <div class="text-xs mt-2 text-emerald-300">This is the full season fee. No installments.</div>
      </div>

      ${isDemo ? `
        <button onclick="simulatePaymentSuccess('${reference}'); closeModal();" 
                class="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl">SIMULATE PAYSTACK SUCCESS (DEMO)</button>
        <div class="text-center text-xs text-slate-400">In production this is done via verified webhook.</div>
      ` : `
        <div class="text-sm">You will be redirected to Paystack.</div>
      `}

      <button onclick="closeModal()" class="w-full py-3 rounded-2xl border border-white/10">CANCEL</button>
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
    alert('Payment confirmed via simulation. You are now eligible!');
  } catch (e) {
    alert('Simulate failed: ' + e.message);
  }
}

// ============ OTHER ACTIONS ============
async function triggerSync() {
  try {
    const res = await fetchJSON('/api/sync/run', { method: 'POST' });
    await loadStandings();
    alert('Sync completed. Scores updated from official sources.');
  } catch (e) {
    alert('Sync error (may need SYNC_TOKEN in prod): ' + e.message);
  }
}

async function generateWhatsAppSummary() {
  if (!currentManager || !standingsData) return;
  const m = currentManager;
  const text = `D LEAGUE CLUBHOUSE UPDATE\n\n` +
    `Manager: ${m.displayName}\n` +
    `FPL: ${m.fplPaid ? 'PAID' : 'UNPAID'} • GW${standingsData.currentRound.fpl} score: ${m.currentFpl || '—'}\n` +
    `UCL: ${m.uclPaid ? 'PAID' : 'UNPAID'} • MD${standingsData.currentRound.ucl} score: ${m.currentUcl || '—'}\n` +
    `Combined: ${m.combined} pts • Wallet: ₦${m.wallet}\n` +
    `Fines: ₦${m.totalFines || 0}\n\n` +
    `Only paid managers qualify. Payments via Paystack webhook only.\n` +
    `Clubhouse: ${location.origin}`;

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
      html += `<div class="text-sm text-slate-400">No transactions yet.</div>`;
    } else {
      data.ledger.forEach(l => {
        const sign = l.amount > 0 ? '+' : '';
        html += `
          <div class="flex justify-between border-b border-white/10 py-2.5 text-sm">
            <div>
              <span class="font-medium">${l.type.toUpperCase()}</span>
              ${l.round ? `• ${l.competition.toUpperCase()} R${l.round}` : ''}
              <div class="text-xs text-slate-400">${l.note || ''}</div>
            </div>
            <div class="font-semibold tabular-nums ${l.amount >= 0 ? 'text-emerald-400' : 'text-amber-400'}">${sign}₦${Math.abs(l.amount)}</div>
          </div>`;
      });
    }
    html += `</div><button onclick="closeModal()" class="mt-5 w-full py-2.5 text-sm border border-white/10 rounded-2xl">CLOSE</button>`;
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
      if (hint) hint.textContent = 'Production mode • Demo accounts disabled';
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

  // Attach login button handler (avoids inline onclick + CSP issues)
  const loginBtn = document.getElementById('login-button');
  if (loginBtn) {
    loginBtn.addEventListener('click', performLogin);
  }

  // Expose limited debug for friends testing
  window.DL = { triggerSync, logout };
  console.log('%c[D League Clubhouse] Premium dashboard ready.', 'color:#334155');
}

bootstrap();
