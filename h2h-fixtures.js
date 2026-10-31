'use strict';

// Official FPL H2H fixture import. No funds, standings, or settlement writes.
const MAX_PAGES = 20;
const FPL_BASE = 'https://fantasy.premierleague.com/api';

function validId(value) {
  const id = String(value == null ? '' : value).trim();
  return /^[1-9]\d*$/.test(id) ? id : null;
}

async function fetchH2HFixtures({ leagueId, gameweek, fetchJSON }) {
  const league = validId(leagueId);
  const gw = Number(gameweek);
  if (!league || !Number.isInteger(gw) || gw < 1 || gw > 38) {
    throw new Error('Valid numeric FPL H2H league ID and GW 1–38 required');
  }
  if (typeof fetchJSON !== 'function') throw new Error('Missing FPL fetch adapter');

  const fixtures = {};
  const pairs = [];
  const seen = new Set();
  let pages = 0;
  let hasNext = true;
  while (hasNext) {
    pages += 1;
    if (pages > MAX_PAGES) throw new Error('FPL H2H pagination exceeded safety limit');
    const url = `${FPL_BASE}/leagues-h2h-matches/league/${league}/?event=${gw}&page=${pages}`;
    const page = await fetchJSON(url);
    if (!page || !Array.isArray(page.results) || typeof page.has_next !== 'boolean') {
      throw new Error('FPL H2H unavailable or unexpected response; saved fixtures preserved');
    }
    for (const match of page.results) {
      if (!match || typeof match !== 'object') throw new Error('Malformed FPL fixture');
      const a = validId(match.entry_1_entry);
      const b = validId(match.entry_2_entry);
      const event = match.event != null ? Number(match.event) : gw;
      if (event !== gw) throw new Error('FPL fixture returned for a different gameweek');
      // FPL can assign a bye (no real opponent): do not generate an imaginary manager.
      if (!a || !b) continue;
      if (a === b) throw new Error('FPL fixture contains a self-match');
      const key = [a, b].sort().join(':');
      if (seen.has(key) || fixtures[a] || fixtures[b]) {
        throw new Error('FPL fixture has duplicate/conflicting opponents');
      }
      seen.add(key);
      fixtures[a] = b;
      fixtures[b] = a;
      pairs.push({ a, b });
    }
    hasNext = page.has_next;
  }
  if (!pairs.length) throw new Error('No complete official H2H pairs returned; saved fixtures preserved');
  return { leagueId: league, gw, fixtures, matchCount: pairs.length, pages };
}

module.exports = { fetchH2HFixtures };
