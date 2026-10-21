import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readTrends } from '../src/trends.js';
import worker from '../src/index.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE events (device_id TEXT, seq INTEGER, type TEXT,
    detected_at INTEGER, received_at INTEGER, distance_raw INTEGER)`);
  return { sqlite, prepare(sql) { return { bind(...values) {
    const statement = sqlite.prepare(sql);
    return { async all() { return { results: statement.all(...values) }; },
      async first() { return statement.get(...values); } };
  } }; } };
}

test('D1-compatible SQL includes range revisions and all stored records beyond browser pagination', async () => {
  const db = database(), now = 2000000, start = now - 7 * 86400;
  const insert = db.sqlite.prepare('INSERT INTO events VALUES (?,?,?,?,?,?)');
  const add = (seq, type, time, distance, id = 'station') => insert.run(id, seq, type, time, now, distance);
  for (let i = 0; i < 4100; i++) add(i, 'lightning', now - 60, 17);
  add(4676, 'range_change', now - 19000, 20);
  add(4677, 'range_change', now - 18000, 63);
  add(5000, 'lightning', start, 1);
  add(5001, 'lightning', start - 1, 5);
  add(5002, 'lightning', now + 1, 5);
  add(5003, 'lightning', null, 8);
  add(5004, 'range_change', null, 8);
  add(5005, 'lightning', now, 63);
  add(5006, 'lightning', now, 5, 'another-station');
  add(5007, 'noise', now, null);
  const day = await readTrends(db, 'station', now, 24);
  assert.equal(day.bucket_seconds, 300);
  assert.equal(day.ranges.reduce((sum, row) => sum + row.count, 0), 4103);
  assert.equal(day.ranges.find(row => row.type === 'lightning' && row.distance_raw === 17).count, 4100);
  assert.equal(day.untimed, 2);
  assert.equal(day.days.length, 7);
  assert.equal(day.days[0].lightning, 1);
  assert.equal(day.days[0].nearest, 1);
  assert.equal(day.days[6].lightning, 4101);
  assert.equal(day.days[6].range_change, 2);
  assert.equal(day.days[6].nearest, 17);
  assert.equal(day.days[2].nearest, null);
  const week = await readTrends(db, 'station', now, 168);
  assert.equal(week.bucket_seconds, 3600);
  assert.equal(week.ranges.reduce((sum, row) => sum + row.count, 0), 4104);
  assert.deepEqual(week.days, day.days);
  db.sqlite.close();
});

test('empty data yields seven explicit zero-count intervals with no invented ranges', async () => {
  const db = database(), result = await readTrends(db, 'station', 2000000, 24);
  assert.deepEqual(result.ranges, []); assert.equal(result.untimed, 0);
  for (const day of result.days) {
    assert.equal(day.lightning, 0); assert.equal(day.range_change, 0);
    assert.equal(day.nearest, null); assert.equal(day.end - day.start, 86400);
  }
  db.sqlite.close();
});

test('trends are private and invalid chart periods are rejected before database reads', async () => {
  const env = { READ_TOKEN: 'a'.repeat(64), DB: { prepare() { throw new Error('Unexpected DB read'); } } };
  const unauthenticated = await worker.fetch(new Request('https://example.com/api/trends'), env, {});
  assert.equal(unauthenticated.status, 401);
  for (const hours of ['0', '-1', '25', 'NaN', '999999']) {
    const response = await worker.fetch(new Request('https://example.com/api/trends?hours=' + hours,
      { headers: { Authorization: 'Bearer ' + env.READ_TOKEN } }), env, {});
    assert.equal(response.status, 400);
  }
});
