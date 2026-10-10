export const DISTANCES = new Set([1,5,6,8,10,12,14,17,20,24,27,31,34,37,40,63]);
export const TYPES = new Set(['heartbeat','lightning','noise','disturber','range_change','sensor_fault']);
const integer = (v,lo,hi) => Number.isSafeInteger(v) && v>=lo && v<=hi;

export function validateBatch(body, deviceId, now) {
  if(!body || body.v!==1 || body.device_id!==deviceId ||
     !integer(body.sent_at,now-300,now+300) ||
     typeof body.firmware!=='string' || !/^[\w.+-]{1,32}$/.test(body.firmware) ||
     !integer(body.rssi,-127,0) || !integer(body.dropped_total,0,0xffffffff) ||
     !integer(body.rejected_total,0,0xffffffff) ||
     typeof body.storage_ok!=='boolean' || typeof body.sensor_ok!=='boolean' ||
     !Array.isArray(body.events) || body.events.length<1 || body.events.length>16)
    throw new Error('Invalid batch envelope or clock; synchronize NTP');
  const ids=new Set();
  for(const e of body.events) {
    if(!e || !integer(e.seq,1,0xffffffff) || ids.has(e.seq) || !TYPES.has(e.type) ||
       !(e.timestamp===null || integer(e.timestamp,1767225600,0xffffffff)) ||
       !(e.distance_raw===null || DISTANCES.has(e.distance_raw)) ||
       !(e.energy===null || integer(e.energy,0,0x1fffff)) ||
       !integer(e.battery_mv,2000,5000) ||
       (e.type==='lightning' && e.energy===null) ||
       (!['lightning','range_change'].includes(e.type) && e.distance_raw!==null) ||
       (e.type!=='lightning' && e.energy!==null)) throw new Error('Invalid event');
    ids.add(e.seq);
  }
  return body;
}
export function eventCanonical(e) {
  return JSON.stringify([e.seq,e.type,e.timestamp,e.distance_raw,e.energy,e.battery_mv]);
}
// A fast-drifting RTC must not poison an entire durable queue or create a future
// storm. Fingerprints still use the original event fields so retry identity holds.
export function detectionTime(e,now) {
  return e.timestamp!==null && e.timestamp<=now+300 ? e.timestamp : null;
}
export function summarize(events, device, now) {
  const strikes=events.filter(e=>e.type==='lightning' && e.detected_at!==null &&
    e.detected_at<=now && e.detected_at>=now-3600).sort((a,b)=>a.detected_at-b.detected_at);
  const ranges=strikes.filter(e=>e.distance_raw!==63 && e.distance_raw!==null);
  const last=strikes.at(-1);
  const near=ranges.some(e=>e.distance_raw===1 || e.distance_raw<=10);
  const offline=!device || now-device.last_seen>12*3600;
  const unhealthy=device && (!device.sensor_ok || !device.storage_ok);
  let trend='insufficient data';
  // Compare medians across two independent 10-minute windows. This is a hint,
  // not a physical storm velocity or a forecast. Require >=3 valid ranges each.
  const recent=ranges.filter(e=>e.detected_at>=now-600);
  const prior=ranges.filter(e=>e.detected_at>=now-1200 && e.detected_at<now-600);
  const median=a=>{ const v=a.map(x=>x.distance_raw===1?0:x.distance_raw).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
  if(recent.length>=3 && prior.length>=3) {
    const diff=median(recent)-median(prior);
    trend=diff<=-5?'range decreasing':diff>=5?'range increasing':'roughly steady';
  }
  return {
    state: offline || unhealthy ? 'unknown' : strikes.length ? (near?'nearby activity':'activity detected') : 'no detections in last hour',
    health: !device?'not commissioned':offline?'overdue':unhealthy?'fault reported':'reporting',
    last_detection:last?.detected_at??null,
    latest_distance_raw:last?.distance_raw??null,
    nearest_distance_raw:ranges.length?Math.min(...ranges.map(e=>e.distance_raw)):null,
    detections_10m:strikes.filter(e=>e.detected_at>=now-600).length,
    detections_1h:strikes.length, trend,
    untimed_events:events.filter(e=>e.type==='lightning' && e.detected_at===null).length
  };
}
