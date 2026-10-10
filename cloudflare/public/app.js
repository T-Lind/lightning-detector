import { HISTORY_LIMIT, formatRange, age, voltage, estimatedBatteryPercent, wifiQuality, mergeEvents, filterEvents, observationTime, EVENT_LABELS, stationView } from './presentation.js';
import { DashboardClient, AuthenticationError, SupersededRequest, ServiceError } from './dashboard-client.js';
import { renderDistancePlot } from './distance-plot.js';

const $ = id => document.getElementById(id);
let storage, persistentStorage;
try { storage = window.sessionStorage; } catch { /* A private tab may block storage. */ }
try { persistentStorage = window.localStorage; } catch { /* Storage can be disabled. */ }
const client = new DashboardClient({ storage, persistentStorage });
let current = null, rows = [], checkedAt = null, stale = false;
let refreshing = false, loadingHistory = false, historyStarted = false;
let historyCursor = 4294967296, hasOlder = true, visibleCount = 20;

const fullDate = timestamp => timestamp ? new Date(timestamp * 1000).toLocaleString(undefined,
  { dateStyle: 'medium', timeStyle: 'short' }) : 'No report received';
const time = timestamp => new Date(timestamp * 1000).toLocaleTimeString(undefined,
  { hour: 'numeric', minute: '2-digit' });
const calendarDate = timestamp => new Date(timestamp * 1000).toLocaleDateString(undefined,
  { month: 'short', day: 'numeric', year: 'numeric' });
const matchingRows = () => filterEvents(rows, $('history-filter').value);

function refreshControls() {
  $('refresh').disabled = refreshing;
  $('refresh-label').textContent = refreshing ? 'Checking…' : 'Refresh';
  $('login-submit').disabled = refreshing;
  $('remember-browser').disabled = refreshing;
  $('login-submit').textContent = refreshing ? 'Opening…' : 'Open dashboard';
  $('login-form').setAttribute('aria-busy', String(refreshing));
}

function logout({ focus = true, forget = true } = {}) {
  client.clear({ forget });
  current = null; rows = []; checkedAt = null; stale = false;
  refreshing = false; loadingHistory = false; historyStarted = false;
  historyCursor = 4294967296; hasOlder = true; visibleCount = 20;
  $('token').value = ''; $('token').type = 'password';
  $('reveal-token').textContent = 'Show'; $('reveal-token').setAttribute('aria-pressed', 'false');
  $('login-error').textContent = ''; $('error').hidden = true; $('history-error').hidden = true;
  $('history-filter').value = 'all';
  $('login').hidden = false; $('dashboard').hidden = true; $('signout').hidden = true;
  $('connection').textContent = 'Private dashboard'; $('connection').dataset.tone = 'neutral';
  $('dashboard').dataset.stale = 'false';
  refreshControls(); renderTable();
  if (focus) $('token').focus();
}

function handleAuth(error) {
  if (!(error instanceof AuthenticationError)) return false;
  logout();
  $('login-error').textContent = error.message;
  return true;
}

function setText(id, value) { $(id).textContent = value; }

function renderStation() {
  if (!current) return;
  const s = current, device = s.device, view = stationView(s, stale);
  $('dashboard').dataset.stale = String(stale);
  $('station-banner').dataset.tone = view.tone;
  document.querySelector('.activity-panel').dataset.tone = view.tone;
  setText('station-title', view.title); setText('station-description', view.description);
  setText('health', view.badge);
  $('health').className = 'badge' + (view.tone === 'warning' ? ' warning' : view.tone === 'neutral' ? ' neutral' : '');
  setText('label', s.label);
  document.title = s.label + ' · Local Lightning';
  setText('state', view.activity);
  setText('last', s.last_detection ? 'Last timed detection ' + age(s.last_detection, s.now)
    : 'No timed detections recorded in the past hour.');
  setText('count10', s.detections_10m ?? '—'); setText('count60', s.detections_1h ?? '—');
  setText('nearest', formatRange(s.nearest_distance_raw));
  setText('trend', s.trend === 'insufficient data' ? 'Not enough observations' : s.trend);
  setText('activity-note', view.available
    ? 'Counts reflect records received by this station. A quiet record is not an all-clear.'
    : 'Recorded counts are shown for reference. An unavailable station cannot confirm a quiet storm.');

  const raw = view.available ? s.latest_distance_raw : null;
  setText('range', formatRange(raw));
  setText('range-caption', raw !== null && raw !== undefined ? 'Latest timed estimate' : 'No current range estimate');
  setText('range-context', !view.available
    ? 'A working sensor and a recent timed observation are needed for a current estimate.'
    : raw === null || raw === undefined ? 'A range estimate appears after a timed lightning observation.'
    : 'Recorded ' + age(s.last_detection, s.now) + '. Range can vary between observations.');

  setText('device-id', device?.device_id ?? 'Awaiting first report');
  setText('report', age(device?.last_seen, s.now));
  setText('report-time', fullDate(device?.last_seen));
  setText('battery', voltage(s.battery_mv));
  const batteryPercent = estimatedBatteryPercent(s.battery_mv);
  setText('battery-percent', batteryPercent === null ? 'Unavailable' : '≈' + batteryPercent + '%');
  setText('rssi', Number.isFinite(device?.rssi) ? device.rssi + ' dBm' : '—');
  setText('wifi-quality', wifiQuality(device?.rssi));
  setText('storage', !device ? 'Unknown' : device.storage_ok ? 'Working' : 'Fault reported');
  $('storage').classList.toggle('warning', !!device && !device.storage_ok);
  setText('dropped', device ? (device.dropped_total ?? 0) + ' records lost to overflow' : 'No queue data');
  setText('faults', !device ? 'No health report has been received.'
    : !device.sensor_ok ? 'Last sensor check: unavailable. This is expected with the AS3935 disconnected; it can also indicate a sensor or wiring fault.'
    : 'Last sensor check: responding. Local storage: ' + (device.storage_ok ? 'working.' : 'fault reported.'));
  setText('firmware', device ? 'Firmware ' + device.firmware + ' · ' + (device.rejected_total ?? 0) + ' observations rejected by the device.' : '');
  $('untimed').hidden = !s.untimed_events;
  setText('untimed', s.untimed_events + ' lightning observation' + (s.untimed_events === 1 ? '' : 's')
    + ' arrived without a valid event time in the past hour. These do not count toward current activity.');
  setText('connection', stale ? 'Last check ' + new Date(checkedAt).toLocaleTimeString()
    : 'Dashboard checked ' + new Date(checkedAt).toLocaleTimeString());
  $('connection').dataset.tone = stale ? 'warning' : 'good';
}

function renderTable() {
  if (current) renderDistancePlot($('distance-plot'), $('plot-note'), rows, current.now);
  const body = $('history'), matches = matchingRows(), shown = matches.slice(0, visibleCount);
  body.replaceChildren();
  for (const event of shown) {
    const tr = document.createElement('tr');
    tr.className = Object.hasOwn(EVENT_LABELS, event.type) ? event.type : '';
    const when = observationTime(event);
    const values = [null, null, formatRange(event.distance_raw), event.energy ?? '—', voltage(event.battery_mv)];
    const labels = ['Time · local', 'Observation', 'Range', 'Energy · unitless', 'Voltage'];
    values.forEach((value, index) => {
      const td = document.createElement('td');
      td.dataset.label = labels[index];
      if (index === 0) {
        const primary = document.createElement('span'); primary.className = 'event-time';
        primary.textContent = when.timestamp ? (when.received ? 'Received ' : '') + time(when.timestamp) : 'Time unavailable';
        const secondary = document.createElement('span'); secondary.className = 'event-date';
        secondary.textContent = when.timestamp ? calendarDate(when.timestamp) : 'No timestamp supplied';
        td.append(primary, secondary);
        if (when.received) {
          const note = document.createElement('span'); note.className = 'event-secondary';
          note.textContent = 'Event time unavailable'; td.append(note);
        }
      } else if (index === 1) {
        const primary = document.createElement('span'); primary.className = 'event-type';
        primary.textContent = EVENT_LABELS[event.type] ?? 'Other observation';
        const secondary = document.createElement('span'); secondary.className = 'event-secondary';
        secondary.textContent = 'Record #' + event.seq; td.append(primary, secondary);
      } else td.textContent = value;
      tr.append(td);
    });
    body.append(tr);
  }
  if (!shown.length) {
    const tr = document.createElement('tr'); tr.className = 'empty-row';
    const td = document.createElement('td'); td.colSpan = 5; td.className = 'empty-cell';
    const heading = document.createElement('strong');
    heading.textContent = rows.length ? 'No matching observations loaded' : 'No observations loaded yet';
    const message = document.createElement('span');
    message.textContent = rows.length ? 'Try another filter or load older records.'
      : current?.device ? 'Older records may be outside the last hour. Check the stored history below.'
      : 'The first report will appear after the station is commissioned.';
    td.append(heading, message); tr.append(td); body.append(tr);
  }
  setText('history-count', shown.length + ' shown · ' + rows.length + ' loaded' +
    ($('history-filter').value !== 'all' ? ' · ' + matches.length + ' matching' : ''));
  $('export').disabled = rows.length === 0;
  const moreLoaded = matches.length > visibleCount;
  const atLimit = rows.length >= HISTORY_LIMIT;
  $('older').disabled = loadingHistory || (!moreLoaded && (!hasOlder || atLimit));
  setText('older', loadingHistory ? 'Loading…' : moreLoaded ? 'Show next 20 records'
    : atLimit ? 'Loaded record limit reached' : hasOlder ? 'Load older records' : 'No older records');
  $('history').setAttribute('aria-busy', String(loadingHistory));
  setText('history-note', atLimit
    ? 'Up to 2,000 records per tab. Export includes all loaded records.'
    : '30-day stored history · Export includes all loaded records.');
}

async function loadOlder() {
  if (!client.token || loadingHistory || !hasOlder || rows.length >= HISTORY_LIMIT) return;
  const revision = client.revision;
  loadingHistory = true; $('history-error').hidden = true; renderTable();
  try {
    const result = await client.request('/api/history?before=' + historyCursor);
    if (!Array.isArray(result.events)) throw new ServiceError('History could not be read. Try again.');
    rows = mergeEvents(rows, result.events);
    historyCursor = result.next_before ?? historyCursor;
    hasOlder = result.events.length === 200 && result.next_before !== null && result.next_before < 4294967296;
  } catch (error) {
    if (error instanceof SupersededRequest || handleAuth(error)) return;
    setText('history-error', error.message); $('history-error').hidden = false;
  } finally {
    if (revision === client.revision) { loadingHistory = false; renderTable(); }
  }
}

async function refresh({ focus = false } = {}) {
  if (!client.token || refreshing) return;
  const revision = client.revision;
  refreshing = true; refreshControls();
  try {
    const s = await client.request('/api/status');
    if (!s || !Number.isFinite(s.now) || typeof s.label !== 'string' || !Array.isArray(s.events))
      throw new ServiceError('The station summary could not be read. Try again.');
    current = s; checkedAt = Date.now(); stale = false;
    rows = mergeEvents(rows, s.events);
    client.remember();
    setText('browser-access', client.persistence === 'browser' ? 'This browser is remembered. Sign out to forget it.'
      : client.rememberBrowser ? 'Browser storage is unavailable. Access is remembered only for this tab or page.'
      : 'Access is remembered only for this tab or page.');
    $('token').value = '';
    $('error').hidden = true; $('login-error').textContent = '';
    $('login').hidden = true; $('dashboard').hidden = false; $('signout').hidden = false;
    renderStation(); renderTable();
    if (focus) $('main').focus();
    if (!historyStarted) { historyStarted = true; void loadOlder(); }
  } catch (error) {
    if (error instanceof SupersededRequest || handleAuth(error)) return;
    if (current) {
      stale = true;
      setText('error', error.message + ' Readings below were last checked ' + new Date(checkedAt).toLocaleString() + '.');
      $('error').hidden = false; renderStation();
    } else {
      setText('login-error', error.message);
      $('connection').textContent = 'Connection unavailable'; $('connection').dataset.tone = 'warning';
    }
  } finally {
    if (revision === client.revision) { refreshing = false; refreshControls(); }
  }
}

$('login-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = $('token').value.trim();
  if (refreshing) return;
  if (!value) { setText('login-error', 'Enter your dashboard token to continue.'); return; }
  client.useToken(value, { rememberBrowser: $('remember-browser').checked });
  void refresh({ focus: true });
});
$('reveal-token').addEventListener('click', () => {
  const show = $('token').type === 'password';
  $('token').type = show ? 'text' : 'password';
  $('reveal-token').textContent = show ? 'Hide' : 'Show';
  $('reveal-token').setAttribute('aria-pressed', String(show));
});
$('signout').addEventListener('click', () => { logout(); document.title = 'Local Lightning · Your station'; });
$('refresh').addEventListener('click', () => void refresh());
$('history-filter').addEventListener('change', () => { visibleCount = 20; renderTable(); });
$('older').addEventListener('click', async () => {
  if (matchingRows().length > visibleCount) { visibleCount += 20; renderTable(); return; }
  await loadOlder();
  if (client.token) { visibleCount += 20; renderTable(); }
});
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  const today = new Date();
  const localDay = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  anchor.href = url; anchor.download = 'lightning-history-' + localDay + '.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
window.addEventListener('resize', () => {
  if (current) renderDistancePlot($('distance-plot'), $('plot-note'), rows, current.now);
});
window.addEventListener('storage', event => {
  if (event.storageArea === persistentStorage && client.persistence === 'browser' &&
      (event.key === null || event.key === 'dashboard-token' && event.newValue !== client.token)) {
    logout({ forget: false });
    setText('login-error', 'Saved access changed in another tab. Sign in again to continue.');
  }
});
setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
renderTable();
if (client.token) void refresh();
