import test from 'node:test';
import assert from 'node:assert/strict';
import { stationView, mergeEvents, observationTime, formatRange, age, filterEvents, voltage, estimatedBatteryPercent } from '../public/presentation.js';
import { DashboardClient, AuthenticationError, SupersededRequest, ServiceError } from '../public/dashboard-client.js';
import { distancePlotData } from '../public/distance-plot.js';

const healthy = { now: 200000, device: { last_seen: 199900, sensor_ok: 1, storage_ok: 1 }, health: 'reporting', state: 'no detections in last hour' };

test('battery estimate handles missing readings, bounds and a nonlinear curve without false precision', () => {
  for (const value of [null, undefined, NaN, Infinity, '4200', 0, 5000]) assert.equal(estimatedBatteryPercent(value), null);
  assert.equal(estimatedBatteryPercent(3200), 0);
  assert.equal(estimatedBatteryPercent(3700), 20);
  assert.equal(estimatedBatteryPercent(3800), 50);
  assert.equal(estimatedBatteryPercent(4140), 95);
  assert.equal(estimatedBatteryPercent(4200), 100);
  assert.equal(estimatedBatteryPercent(4232), 100);
  let previous = 0;
  for (let mv = 2500; mv <= 4300; mv++) {
    const value = estimatedBatteryPercent(mv);
    assert.ok(value >= previous && value <= 100);
    assert.equal(value % 5, 0); previous = value;
  }
});
test('missing sensor, missing station, stale connection and overdue reports never imply a quiet storm', () => {
  for (const view of [stationView({ ...healthy, device: null }),
    stationView({ ...healthy, device: { ...healthy.device, sensor_ok: 0 } }),
    stationView({ ...healthy, device: { ...healthy.device, storage_ok: 0 } }),
    stationView({ ...healthy, device: { ...healthy.device, last_seen: 150000 } }), stationView(healthy, true)]) {
    assert.equal(view.available, false);
    assert.doesNotMatch(view.activity, /No recent detections/);
  }
  assert.match(stationView({ ...healthy, device: { ...healthy.device, sensor_ok: 0 } }).description, /bare-board/);
  assert.equal(stationView(healthy).available, true);
  assert.equal(stationView({ ...healthy, state: 'nearby activity' }).activity, 'Nearby activity recorded');
});
test('fresh records replace cached duplicates, with a bounded newest-first history', () => {
  assert.deepEqual(mergeEvents([{ seq: 1, energy: 2 }, { seq: 2 }], [{ seq: 1, energy: 0 }, { seq: 3 }], 2), [{ seq: 3 }, { seq: 2 }]);
  assert.equal(mergeEvents([{ seq: 1, energy: 2 }], [{ seq: 1, energy: 0 }])[0].energy, 0);
  assert.deepEqual(filterEvents([{ type: 'lightning' }, { type: 'sensor_fault' }], 'system'), [{ type: 'sensor_fault' }]);
});
test('unknown event time uses arrival time without claiming detection time', () => {
  assert.deepEqual(observationTime({ detected_at: null, received_at: 123 }), { timestamp: 123, received: true });
  assert.deepEqual(observationTime({ detected_at: 100, received_at: 123 }), { timestamp: 100, received: false });
  assert.equal(formatRange(1), 'Overhead'); assert.equal(formatRange(63), 'Beyond 40 km');
  assert.equal(formatRange(null), '—'); assert.equal(voltage(null), '—');
  assert.equal(age(1000, 900), 'Just now'); assert.equal(age(1000, 200000), '2 d ago');
});
test('access is remembered only after validation and can operate without session storage', async () => {
  const entries = new Map(), storage = { getItem: k => entries.get(k), setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) };
  const client = new DashboardClient({ storage, fetchImpl: async (_path, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token'); return Response.json({ ok: true });
  } });
  client.useToken(' test-token '); assert.equal(entries.size, 0);
  await client.request('/api/status'); client.remember(); assert.equal(entries.get('dashboard-token'), 'test-token');
  client.clear(); assert.equal(entries.size, 0);
  const blocked = new DashboardClient({ storage: { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } } });
  blocked.useToken('test'); blocked.remember(); blocked.clear(); assert.equal(blocked.token, '');
});

const fakeStorage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
};

test('remembered browser access survives a new client and signing out clears both stores', async () => {
  const storage = fakeStorage(), persistentStorage = fakeStorage();
  const client = new DashboardClient({ storage, persistentStorage, fetchImpl: async () => Response.json({ ok: true }) });
  client.useToken('good', { rememberBrowser: true });
  assert.equal(persistentStorage.getItem('dashboard-token'), null);
  await client.request('/api/status'); assert.equal(client.remember(), 'browser');
  const reopened = new DashboardClient({ storage: fakeStorage(), persistentStorage });
  assert.equal(reopened.token, 'good');
  reopened.clear(); assert.equal(persistentStorage.getItem('dashboard-token'), null);
  assert.equal(new DashboardClient({ storage, persistentStorage }).token, '');
});

test('tab-only choices survive reload without being migrated; legacy sessions upgrade after validation', () => {
  const storage = fakeStorage(), persistentStorage = fakeStorage();
  const client = new DashboardClient({ storage, persistentStorage });
  client.useToken('tab', { rememberBrowser: false }); client.remember();
  const reload = new DashboardClient({ storage, persistentStorage });
  assert.equal(reload.rememberBrowser, false); assert.equal(reload.remember(), 'tab');
  assert.equal(persistentStorage.getItem('dashboard-token'), null);
  storage.removeItem('dashboard-storage');
  const legacy = new DashboardClient({ storage, persistentStorage });
  assert.equal(legacy.rememberBrowser, true); legacy.remember();
  assert.equal(persistentStorage.getItem('dashboard-token'), 'tab');
  assert.equal(storage.getItem('dashboard-token'), null);
});

test('blocked persistent storage falls back and a cleared browser token is never rewritten by a refresh', () => {
  const storage = fakeStorage(), blocked = { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
  const fallback = new DashboardClient({ storage, persistentStorage: blocked });
  fallback.useToken('good', { rememberBrowser: true }); assert.equal(fallback.remember(), 'tab');
  const persistentStorage = fakeStorage();
  const client = new DashboardClient({ persistentStorage });
  client.useToken('good', { rememberBrowser: true }); client.remember();
  persistentStorage.removeItem('dashboard-token'); client.remember();
  assert.equal(persistentStorage.getItem('dashboard-token'), null);
  persistentStorage.setItem('dashboard-token', 'replacement'); client.clear({ forget: false });
  assert.equal(client.token, ''); assert.equal(persistentStorage.getItem('dashboard-token'), 'replacement');
});

test('distance plot uses detection time only, separates beyond-range readings and handles overhead', () => {
  const now = 200000;
  const event = (seq, time, range, type = 'lightning') => ({ seq, detected_at: time, received_at: now, distance_raw: range, type });
  const data = distancePlotData([event(1, now - 2, 8), event(2, now - 5, 1), event(3, now - 3, 63),
    event(4, null, 8), event(5, now - 86401, 8), event(6, now + 1, 8), event(7, now, 2), event(8, now, 8, 'noise')], now);
  assert.deepEqual(data.points.map(({seq, time, distance}) => ({seq, time, distance})), [{ seq: 2, time: now - 5, distance: 0 }, { seq: 1, time: now - 2, distance: 8 }]);
  assert.deepEqual(data.beyond.map(({seq, time, distance}) => ({seq, time, distance})), [{ seq: 3, time: now - 3, distance: 63 }]);
  assert.equal(data.untimed, 1);
  assert.equal(data.missingRange, 1);
  assert.equal(distancePlotData([], now).points.length, 0);
});

test('range revisions are plotted distinctly and seven-day view includes older ranges without inflating lightning counts', () => {
  const now = 2000000;
  const events = [
    { seq: 4677, type: 'range_change', detected_at: now - 18000, distance_raw: 63 },
    { seq: 4676, type: 'range_change', detected_at: now - 19000, distance_raw: 20 },
    { seq: 1, type: 'lightning', detected_at: now - 3 * 86400, distance_raw: 1 }
  ];
  const day = distancePlotData(events, now);
  assert.equal(day.points.length, 1); assert.equal(day.beyond.length, 1);
  assert.equal(day.points[0].type, 'range_change');
  const week = distancePlotData(events, now, 168);
  assert.equal(week.points.length, 2); assert.equal(week.points[0].distance, 0);
  assert.equal(week.points.filter(point => point.type === 'lightning').length, 1);
});
test('a response arriving after sign-out cannot reopen the dashboard', async () => {
  let resolve;
  const client = new DashboardClient({ fetchImpl: () => new Promise(r => { resolve = r; }) });
  client.useToken('test');
  const pending = client.request('/api/status'); client.clear(); resolve(Response.json({ ok: true }));
  await assert.rejects(pending, SupersededRequest);
});
test('an old unauthorized response cannot reject a newer login', async () => {
  let resolve;
  const client = new DashboardClient({ fetchImpl: () => new Promise(r => { resolve = r; }) });
  client.useToken('old'); const pending = client.request('/api/status');
  client.useToken('new'); resolve(new Response('', { status: 401 }));
  await assert.rejects(pending, SupersededRequest); assert.equal(client.token, 'new');
});
test('rejected access, service errors and timeout have distinct recoverable messages', async () => {
  const rejected = new DashboardClient({ fetchImpl: async () => new Response('', { status: 401 }) });
  await assert.rejects(rejected.request('/api/status'), AuthenticationError);
  const down = new DashboardClient({ fetchImpl: async () => new Response('', { status: 503 }) });
  await assert.rejects(down.request('/api/status'), ServiceError);
  const slow = new DashboardClient({ timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(slow.request('/api/status'), /too long/);
});
