'use strict';
// Read-only live smoke test for the real DLeague FPL H2H league.
// No authentication, no production writes, no API tokens.
const league = '346910';
const gw = 9;
const origin = 'https://fantasy.premierleague.com/api';
const targets = [
  ['GW9 fixtures', origin + '/leagues-h2h-matches/league/' + league + '/?event=' + gw + '&page=1'],
  ['Unfiltered fixtures', origin + '/leagues-h2h-matches/league/' + league + '/?page=1'],
  ['League standings', origin + '/leagues-h2h/' + league + '/standings/'],
];
(async () => {
  for (const [name, url] of targets) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DLeagueFixtureVerification/1.0)', Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const raw = await res.text();
      console.log('\n' + name + ': HTTP ' + res.status + ' (' + raw.length + ' chars), final URL: ' + res.url);
      let json;
      try { json = JSON.parse(raw); } catch {}
      if (!json) { console.log('Non-JSON preview:', raw.slice(0, 180).replace(/\s+/g, ' ')); continue; }
      console.log('Keys:', Object.keys(json).join(', '));
      if (Array.isArray(json.results)) {
        console.log('Matches:', json.results.length, 'has_next:', json.has_next);
        console.log('Samples:', JSON.stringify(json.results.slice(0, 3).map(x => ({
          event: x.event, id: x.id,
          homeId: x.entry_1_entry, homeName: x.entry_1_name,
          awayId: x.entry_2_entry, awayName: x.entry_2_name
        }))));
      } else if (json.standings) {
        console.log('League:', json.league && json.league.name, 'standings rows:', (json.standings.results || []).length);
      } else {
        console.log('JSON preview:', JSON.stringify(json).slice(0, 220));
      }
    } catch (e) { console.log('\n' + name + ': network error:', e.message); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
