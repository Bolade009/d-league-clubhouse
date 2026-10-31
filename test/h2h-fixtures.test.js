'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchH2HFixtures } = require('../h2h-fixtures');

const match = (a, b, event = 9) => ({ event, entry_1_entry: a, entry_2_entry: b });
const fake = (...pages) => {
  const requested = [];
  return { requested, fetchJSON: async url => {
    requested.push(url);
    return pages[requested.length - 1];
  }};
};

test('imports official fixtures across pages and maps both directions', async () => {
  const f = fake(
    { results: [match(100, 200)], has_next: true },
    { results: [match(300, 400), match(500, null)], has_next: false }
  );
  const data = await fetchH2HFixtures({ leagueId: '123', gameweek: 9, fetchJSON: f.fetchJSON });
  assert.deepEqual(data.fixtures, { '100': '200', '200': '100', '300': '400', '400': '300' });
  assert.equal(data.matchCount, 2);
  assert.equal(data.pages, 2);
  assert.match(f.requested[0], /league\/123\/\?event=9&page=1$/);
  assert.match(f.requested[1], /page=2$/);
});

test('rejects duplicate and conflicting fixtures', async () => {
  const f = fake({ results: [match(100, 200), match(100, 300)], has_next: false });
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: f.fetchJSON }), /duplicate\/conflicting/);
});

test('rejects self-matches and wrong rounds', async () => {
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: fake({ results: [match(100, 100)], has_next: false }).fetchJSON }), /self-match/);
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: fake({ results: [match(100, 200, 8)], has_next: false }).fetchJSON }), /different gameweek/);
});

test('fails safely if FPL returns an invalid or empty response', async () => {
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: fake(null).fetchJSON }), /unavailable/);
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: fake({ results: [], has_next: false }).fetchJSON }), /No complete/);
  await assert.rejects(fetchH2HFixtures({ leagueId: 'bad', gameweek: 9, fetchJSON: fake().fetchJSON }), /numeric/);
});

test('fails safely when FPL paginates indefinitely', async () => {
  let calls = 0;
  await assert.rejects(fetchH2HFixtures({ leagueId: 123, gameweek: 9, fetchJSON: async () => {
    calls++;
    return { results: [match(calls * 2, calls * 2 + 1)], has_next: true };
  }}), /pagination exceeded/);
  assert.equal(calls, 20);
});
