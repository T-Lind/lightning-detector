const WINDOW_SECONDS = 24 * 3600;
const VALID_DISTANCES = new Set([1, 5, 6, 8, 10, 12, 14, 17, 20, 24, 27, 31, 34, 37, 40, 63]);

export function distancePlotData(events, now) {
  const start = now - WINDOW_SECONDS;
  const points = [], beyond = [];
  let untimed = 0, missingRange = 0;
  for (const event of events) {
    if (event.type !== 'lightning') continue;
    if (!Number.isFinite(event.detected_at) || event.detected_at <= 0) { untimed++; continue; }
    if (!Number.isFinite(now) || event.detected_at < start || event.detected_at > now) continue;
    if (!VALID_DISTANCES.has(event.distance_raw)) { missingRange++; continue; }
    const point = { seq: event.seq, time: event.detected_at, distance: event.distance_raw === 1 ? 0 : event.distance_raw };
    (event.distance_raw === 63 ? beyond : points).push(point);
  }
  points.sort((a, b) => a.time - b.time); beyond.sort((a, b) => a.time - b.time);
  return { start, end: now, points, beyond, untimed, missingRange };
}

const NS = 'http://www.w3.org/2000/svg';
function element(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderDistancePlot(svg, note, events, now) {
  const data = distancePlotData(events, now);
  const total = data.points.length + data.beyond.length;
  svg.replaceChildren();
  svg.append(element('title', { id: 'distance-plot-title' }, 'Lightning range over the past 24 hours'),
    element('desc', { id: 'distance-plot-description' }, `${total} timed lightning range observations plotted from loaded history; ${data.missingRange} timed observations have no valid range. Each point shows an estimate, not an exact strike location. Overhead is plotted at zero; observations beyond 40 km have their own row.`));
  const width = Math.max(250, svg.clientWidth || 980);
  svg.setAttribute('viewBox', `0 0 ${width} 326`);
  const left = 68, right = width - 14, top = 82, bottom = 258;
  const x = time => left + (time - data.start) / WINDOW_SECONDS * (right - left);
  const y = distance => bottom - distance / 40 * (bottom - top);
  svg.append(element('text', { x: 8, y: 16, class: 'plot-axis-title' }, 'Range (km)'));
  for (const distance of [0, 10, 20, 30, 40]) {
    svg.append(element('line', { x1: left, x2: right, y1: y(distance), y2: y(distance), class: 'plot-grid' }),
      element('text', { x: left - 12, y: y(distance) + 4, 'text-anchor': 'end', class: 'plot-label' }, distance === 0 ? 'Overhead' : distance));
  }
  svg.append(element('text', { x: left - 12, y: 48, 'text-anchor': 'end', class: 'plot-label' }, '>40'),
    element('line', { x1: left, x2: right, y1: 44, y2: 44, class: 'plot-grid plot-beyond' }));
  const ticks = width < 600 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const timestamp = data.start + i * WINDOW_SECONDS / ticks, axisX = x(timestamp);
    svg.append(element('line', { x1: axisX, x2: axisX, y1: top, y2: bottom, class: 'plot-grid' }),
      element('text', { x: axisX, y: 282, 'text-anchor': i === 0 ? 'start' : i === ticks ? 'end' : 'middle', class: 'plot-label' },
        new Date(timestamp * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })));
  }
  svg.append(element('text', { x: right, y: 311, 'text-anchor': 'end', class: 'plot-label' }, 'Time · local'));
  for (const point of [...data.points, ...data.beyond]) {
    const label = point.distance === 63 ? 'Beyond 40 km' : point.distance === 0 ? 'Overhead' : point.distance + ' km';
    const marker = element('circle', { cx: x(point.time), cy: point.distance === 63 ? 44 : y(point.distance), r: 5, class: 'plot-point' });
    marker.append(element('title', {}, `${new Date(point.time * 1000).toLocaleString()} · ${label} · Record #${point.seq}`));
    svg.append(marker);
  }
  if (!total) svg.append(element('text', { x: (left + right) / 2, y: 167, 'text-anchor': 'middle', class: 'plot-empty' }, width < 600 ? 'No range estimates loaded' : 'No timed range estimates loaded for this period'));
  note.textContent = `${total} timed observation${total === 1 ? '' : 's'} plotted from loaded history. ${data.missingRange ? data.missingRange + ' timed observations have no valid range. ' : ''}${data.untimed ? data.untimed + ' untimed lightning records omitted. ' : ''}Load older records below to include more history. Times use your browser’s local time.`;
}
