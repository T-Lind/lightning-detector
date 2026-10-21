export const HISTORY_LIMIT = 2000;

export function formatRange(raw) {
  if (raw === 1) return 'Overhead';
  if (raw === 63) return 'Beyond 40 km';
  return Number.isFinite(raw) ? `${raw} km` : '—';
}

export function age(timestamp, now = Date.now() / 1000) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'No report';
  const seconds = Math.max(0, now - timestamp);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export function voltage(millivolts) {
  return Number.isFinite(millivolts) ? `${(millivolts / 1000).toFixed(2)} V` : '—';
}

// Generic 1S 4.2 V LiPo planning curve, not a characterization of this pack.
// Charging, temperature, load and the uncalibrated ADC can shift the estimate.
// 0% is the approximate depleted end of the curve, not a hardware cutoff.
const LIPO_CURVE = [[3300, 0], [3500, 5], [3600, 10], [3700, 20],
  [3750, 40], [3800, 50], [3850, 60], [3900, 70], [4000, 80],
  [4100, 90], [4200, 100]];

export function estimatedBatteryPercent(millivolts) {
  if (!Number.isFinite(millivolts) || millivolts < 2500 || millivolts > 4300) return null;
  if (millivolts <= LIPO_CURVE[0][0]) return 0;
  for (let i = 1; i < LIPO_CURVE.length; i++) {
    const [upperV, upperPercent] = LIPO_CURVE[i], [lowerV, lowerPercent] = LIPO_CURVE[i - 1];
    if (millivolts <= upperV) {
      const percent = lowerPercent + (millivolts - lowerV) / (upperV - lowerV) * (upperPercent - lowerPercent);
      return Math.round(percent / 5) * 5;
    }
  }
  return 100;
}

export function wifiQuality(rssi) {
  if (!Number.isFinite(rssi)) return 'No reading';
  return rssi >= -60 ? 'Strong signal' : rssi >= -75 ? 'Fair signal' : 'Weak signal';
}

export function mergeEvents(existing, incoming, limit = HISTORY_LIMIT) {
  // Incoming records take precedence, so a refresh cannot restore an old value.
  return [...new Map([...existing, ...incoming].map(event => [event.seq, event])).values()]
    .sort((a, b) => b.seq - a.seq).slice(0, limit);
}

export function filterEvents(events, filter) {
  return events.filter(event => filter === 'lightning' ? event.type === 'lightning'
    : filter === 'overview' ? event.type !== 'range_change'
    : filter === 'system' ? event.type !== 'lightning' : true);
}

export function observationTime(event) {
  return { timestamp: event.detected_at ?? event.received_at ?? null,
    received: event.detected_at === null || event.detected_at === undefined };
}

export const EVENT_LABELS = {
  heartbeat: 'Station check-in', lightning: 'Lightning', noise: 'Noise',
  disturber: 'Interference', range_change: 'Range update', sensor_fault: 'Sensor fault'
};

export function stationView(status, stale = false) {
  const device = status.device;
  const view = { tone: 'good', badge: 'Reporting', title: 'Station is reporting',
    description: 'The last report confirms the sensor and local storage are working.',
    activity: 'No recent detections', available: true };
  if (stale) return { ...view, tone: 'warning', badge: 'Stale data',
    title: 'Dashboard connection unavailable', available: false,
    description: 'The readings below are from the last successful check. Current station status is unknown.',
    activity: 'Status unavailable' };
  if (!device) return { ...view, tone: 'neutral', badge: 'Awaiting setup',
    title: 'Awaiting the first station report', available: false,
    description: 'No station has checked in yet. Observations and health will appear after commissioning.',
    activity: 'No station data yet' };
  if (status.health === 'overdue' || status.now - device.last_seen > 12 * 3600)
    return { ...view, tone: 'warning', badge: 'Overdue', title: 'Station report overdue', available: false,
      description: 'No station report in over 12 hours. The board may be unplugged or unable to connect; current lightning activity is unknown.',
      activity: 'Status unavailable' };
  if (!device.sensor_ok || !device.storage_ok) {
    const sensorOnly = !device.sensor_ok && !!device.storage_ok;
    return { ...view, tone: 'warning', badge: 'Needs attention', available: false,
      title: sensorOnly ? 'Lightning sensor unavailable' : 'Station needs attention',
      description: sensorOnly
        ? 'The AS3935 is disconnected or not responding. This is expected during a bare-board setup; lightning activity cannot be assessed.'
        : 'The last report flagged a local storage or sensor fault. Check the instrument before relying on its observations.',
      activity: 'Detection unavailable' };
  }
  if (status.state === 'unknown') return { ...view, tone: 'warning', badge: 'Unknown', available: false,
    title: 'Station status unknown', description: 'The latest report cannot confirm current lightning activity.', activity: 'Status unavailable' };
  if (status.state === 'nearby activity') return { ...view, tone: 'warning',
    title: 'Nearby activity recorded', description: 'This station recorded a range estimate of 10 km or less in the past hour.', activity: 'Nearby activity recorded' };
  if (status.state === 'activity detected') return { ...view, tone: 'warning',
    title: 'Lightning activity recorded', description: 'Timed lightning observations were received in the past hour.', activity: 'Lightning activity recorded' };
  return view;
}
