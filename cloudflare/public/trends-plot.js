import { distancePlotData } from './distance-plot.js';

const NS = 'http://www.w3.org/2000/svg';
function element(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
const dateTime = value => new Date(value * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const rangeLabel = value => value === 63 ? 'Beyond 40 km' : value === 0 || value === 1 ? 'Overhead' : value + ' km';

export function renderDistancePlot(svg, note, trends, hours = 24, includeRangeUpdates = false) {
  const events = trends.ranges.map(row => ({ ...row, detected_at: (row.first_at + row.last_at) / 2 }));
  const data = distancePlotData(events, trends.now, hours, includeRangeUpdates);
  const all = [...data.points, ...data.beyond];
  const total = all.reduce((sum, point) => sum + point.count, 0);
  const lightning = all.filter(point => point.type === 'lightning').reduce((sum, point) => sum + point.count, 0);
  svg.replaceChildren();
  svg.append(element('title', { id: 'distance-plot-title' }, `Recorded range over the past ${hours === 24 ? '24 hours' : '7 days'}`),
    element('desc', { id: 'distance-plot-description' }, `${lightning} recorded lightning observations with valid times and ranges. ${includeRangeUpdates ? (total - lightning) + ' diagnostic range updates are also shown as hollow diamonds; these are not new detections and their cause is under investigation.' : 'Range updates are hidden.'} Overhead is zero; beyond 40 km has its own row. Nearby records of the same type and range are grouped.`));
  const width = Math.max(250, svg.clientWidth || 980);
  svg.setAttribute('viewBox', `0 0 ${width} 326`);
  const left = 68, right = width - 14, top = 82, bottom = 258;
  const x = time => left + (time - data.start) / (hours * 3600) * (right - left);
  const y = distance => bottom - distance / 40 * (bottom - top);
  svg.append(element('text', { x: 8, y: 16, class: 'plot-axis-title' }, 'Range (km)'));
  for (const distance of [0, 10, 20, 30, 40]) {
    svg.append(element('line', { x1: left, x2: right, y1: y(distance), y2: y(distance), class: 'plot-grid' }),
      element('text', { x: left - 12, y: y(distance) + 4, 'text-anchor': 'end', class: 'plot-label' }, distance === 0 ? 'Overhead' : distance));
  }
  svg.append(element('text', { x: left - 12, y: 48, 'text-anchor': 'end', class: 'plot-label' }, '>40'),
    element('line', { x1: left, x2: right, y1: 44, y2: 44, class: 'plot-grid plot-beyond' }));
  const ticks = width < 600 ? 2 : hours === 24 ? 4 : 7;
  for (let i = 0; i <= ticks; i++) {
    const timestamp = data.start + i * hours * 3600 / ticks, axisX = x(timestamp), date = new Date(timestamp * 1000);
    svg.append(element('line', { x1: axisX, x2: axisX, y1: top, y2: bottom, class: 'plot-grid' }),
      element('text', { x: axisX, y: 282, 'text-anchor': i === 0 ? 'start' : i === ticks ? 'end' : 'middle', class: 'plot-label' },
        hours === 24 ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })));
  }
  svg.append(element('text', { x: right, y: 311, 'text-anchor': 'end', class: 'plot-label' }, 'Time · local'));
  // Updates go first so a coincident lightning marker remains visible.
  for (const point of all.sort((a, b) => (a.type === 'lightning') - (b.type === 'lightning'))) {
    const cx = x(point.time), cy = point.distance === 63 ? 44 : y(point.distance), update = point.type === 'range_change';
    const marker = update
      ? element('path', { d: `M ${cx} ${cy - 6} l 6 6 l -6 6 l -6 -6 Z`, class: 'plot-update', tabindex: 0 })
      : element('circle', { cx, cy, r: 5, class: 'plot-point', tabindex: 0 });
    const label = `${point.count} ${update ? 'range update' : 'lightning observation'}${point.count === 1 ? '' : 's'} · ${rangeLabel(point.distance)} · ${dateTime(point.first)}${point.last !== point.first ? ' – ' + dateTime(point.last) : ''}`;
    marker.setAttribute('aria-label', label); marker.append(element('title', {}, label));
    const inspect = () => { document.getElementById('plot-inspection').textContent = label; };
    marker.addEventListener('focus', inspect); marker.addEventListener('mouseenter', inspect);
    marker.addEventListener('click', inspect); svg.append(marker);
  }
  if (!total) svg.append(element('text', { x: (left + right) / 2, y: 167, 'text-anchor': 'middle', class: 'plot-empty' }, includeRangeUpdates ? 'No timed ranges recorded' : width < 600 ? 'No timed lightning recorded' : 'No timed lightning observations recorded for this period'));
  note.textContent = `${lightning} recorded lightning observations. ${includeRangeUpdates ? (total - lightning) + ' diagnostic range updates shown; these do not count as lightning.' : 'Range updates are hidden by default.'} All stored records of the selected types in this period are included; table pagination does not limit this chart. Same-type, same-range records within ${trends.bucket_seconds === 300 ? '5 minutes' : 'an hour'} share a marker.${data.missingRange ? ' ' + data.missingRange + ' range groups have no valid range.' : ''}${trends.untimed ? ' ' + trends.untimed + ' lightning or range-update records received without event times are excluded.' : ''}`;
}

export function renderWeeklyActivity(svg, body, days) {
  svg.replaceChildren(); body.replaceChildren();
  const total = key => days.reduce((sum, day) => sum + day[key], 0);
  svg.append(element('title', { id: 'weekly-title' }, 'Recorded activity over seven days'),
    element('desc', { id: 'weekly-description' }, `${total('lightning')} recorded lightning observations in seven consecutive 24-hour intervals. Range updates are excluded. A zero count does not confirm the station was online. Exact intervals and counts are in the table below.`));
  const width = Math.max(250, svg.clientWidth || 980), left = 44, right = width - 12, top = 28, bottom = 178;
  svg.setAttribute('viewBox', `0 0 ${width} 224`);
  const maximum = Math.max(1, ...days.map(day => day.lightning));
  const step = (right - left) / 7, barWidth = step * .6;
  for (const value of [...new Set([0, Math.ceil(maximum / 2), maximum])]) {
    const yy = bottom - value / maximum * (bottom - top);
    svg.append(element('line', { x1: left, x2: right, y1: yy, y2: yy, class: 'plot-grid' }),
      element('text', { x: left - 8, y: yy + 4, 'text-anchor': 'end', class: 'plot-label' }, value));
  }
  days.forEach((day, i) => {
    const xx = left + step * i + (step - barWidth) / 2;
    const height = day.lightning / maximum * (bottom - top);
    if (height) {
      const rect = element('rect', { x: xx, y: bottom - height, width: barWidth, height, class: 'weekly-lightning', tabindex: 0 });
      const label = `${dateTime(day.start)} – ${dateTime(day.end)} · ${day.lightning} recorded lightning observations`;
      rect.append(element('title', {}, label)); rect.setAttribute('aria-label', label); svg.append(rect);
    }
    svg.append(element('text', { x: xx + barWidth / 2, y: 201, 'text-anchor': 'middle', class: 'plot-label' },
      new Date((day.start + day.end) / 2 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })));
    const tr = document.createElement('tr');
    [dateTime(day.start) + ' – ' + dateTime(day.end), day.lightning,
      day.nearest === null ? '—' : rangeLabel(day.nearest)].forEach((value, index) => {
      const td = document.createElement('td'); td.textContent = value;
      td.dataset.label = ['24-hour interval · local', 'Lightning', 'Nearest lightning range'][index]; tr.append(td);
    });
    body.append(tr);
  });
}
