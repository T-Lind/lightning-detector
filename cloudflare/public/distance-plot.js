const VALID_DISTANCES = new Set([1, 5, 6, 8, 10, 12, 14, 17, 20, 24, 27, 31, 34, 37, 40, 63]);

export function distancePlotData(events, now, hours = 24, includeRangeUpdates = false) {
  const start = now - hours * 3600;
  const points = [], beyond = [];
  let untimed = 0, missingRange = 0;
  for (const event of events) {
    if (event.type !== 'lightning' && !(includeRangeUpdates && event.type === 'range_change')) continue;
    if (!Number.isFinite(event.detected_at) || event.detected_at <= 0) { untimed++; continue; }
    if (!Number.isFinite(now) || event.detected_at < start || event.detected_at > now) continue;
    if (!VALID_DISTANCES.has(event.distance_raw)) { missingRange++; continue; }
    const point = { seq: event.seq, time: event.detected_at, distance: event.distance_raw === 1 ? 0 : event.distance_raw,
      type: event.type, count: event.count ?? 1, first: event.first_at ?? event.detected_at,
      last: event.last_at ?? event.detected_at };
    (event.distance_raw === 63 ? beyond : points).push(point);
  }
  points.sort((a, b) => a.time - b.time); beyond.sort((a, b) => a.time - b.time);
  return { start, end: now, points, beyond, untimed, missingRange };
}
