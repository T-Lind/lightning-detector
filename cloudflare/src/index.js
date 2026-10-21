import {validateBatch, eventCanonical, detectionTime, summarize} from './model.js';
import {readTrends} from './trends.js';
const enc=new TextEncoder();
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'}});
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
export async function hmac(secret,body) {
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,enc.encode(body)));
}
async function verified(secret,body,signature) {
  if(!/^[0-9a-f]{64}$/.test(signature??'')) return false;
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.match(/../g),v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',key,bytes,enc.encode(body));
}
async function tokenMatches(a,b) {
  if(!a || !b || b.length<32) return false;
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)));
  const [x,y]=await Promise.all([digest(a),digest(b)]);
  let diff=0; for(let i=0;i<x.length;i++) diff|=x[i]^y[i]; return diff===0;
}
async function limitedText(request,max=16384) {
  const reader=request.body?.getReader(); if(!reader) return '';
  let total=0, parts=[];
  while(true) {
    const {done,value}=await reader.read(); if(done) break;
    total+=value.length; if(total>max) { await reader.cancel(); throw new Error('Body too large'); }
    parts.push(value);
  }
  const bytes=new Uint8Array(total); let offset=0;
  for(const p of parts) { bytes.set(p,offset); offset+=p.length; }
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function ingest(request,env,ctx,now) {
  if(!env.DEVICE_SECRET || env.DEVICE_SECRET.length!==64) return json({error:'Device secret not configured'},503);
  if(request.headers.get('X-Device-Id')!==env.DEVICE_ID) return json({error:'Unauthorized'},401);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON required'},415);
  let text;
  try { text=await limitedText(request); } catch { return json({error:'Invalid or oversized body'},413); }
  if(!await verified(env.DEVICE_SECRET,text,request.headers.get('X-Signature'))) return json({error:'Unauthorized'},401);
  let body;
  try { body=validateBatch(JSON.parse(text),env.DEVICE_ID,now); }
  catch(e) { return json({error:e.message},400); }
  const rows=await Promise.all(body.events.map(async e=>({...e,
    fingerprint:hex(await crypto.subtle.digest('SHA-256',enc.encode(eventCanonical(e))))})));
  // Sequential inserts in D1 batch are transactional. Existing IDs stay immutable.
  const statements=rows.map(e=>env.DB.prepare(`INSERT OR IGNORE INTO events
    (device_id,seq,type,detected_at,received_at,distance_raw,energy,battery_mv,fingerprint)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(env.DEVICE_ID,e.seq,e.type,detectionTime(e,now),now,e.distance_raw,e.energy,e.battery_mv,e.fingerprint));
  statements.push(env.DB.prepare(`INSERT INTO devices
    (device_id,last_seen,firmware,rssi,dropped_total,rejected_total,storage_ok,sensor_ok)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET
    last_seen=excluded.last_seen,firmware=excluded.firmware,rssi=excluded.rssi,
    dropped_total=excluded.dropped_total,rejected_total=excluded.rejected_total,
    storage_ok=excluded.storage_ok,sensor_ok=excluded.sensor_ok
    WHERE excluded.last_seen>=devices.last_seen`).bind(env.DEVICE_ID,body.sent_at,body.firmware,body.rssi,
      body.dropped_total,body.rejected_total,Number(body.storage_ok),Number(body.sensor_ok)));
  await env.DB.batch(statements);
  const placeholders=rows.map(()=>'?').join(',');
  const {results}=await env.DB.prepare(`SELECT seq,fingerprint FROM events WHERE device_id=? AND seq IN (${placeholders})`)
    .bind(env.DEVICE_ID,...rows.map(e=>e.seq)).all();
  const accepted=rows.filter(e=>results.some(r=>r.seq===e.seq && r.fingerprint===e.fingerprint)).map(e=>e.seq);
  if(accepted.length!==rows.length) return json({error:'Sequence reused with different event; reprovision a new device ID',accepted},409);
  // Optional external notification only after the owner explicitly configures it.
  if(env.ALERT_WEBHOOK_URL && rows.some(e=>e.type==='lightning' && detectionTime(e,now)!==null && e.timestamp>=now-300))
    ctx.waitUntil(notify(env,now));
  return json({accepted});
}
async function notify(env,now) {
  // Durable 10-minute cooldown claim before network side effect. Failed sends
  // are logged, not falsely recorded as delivery; a future event can retry later.
  await env.DB.prepare('INSERT OR IGNORE INTO alert_state(device_id,last_notified) VALUES (?,0)').bind(env.DEVICE_ID).run();
  const claim=await env.DB.prepare('UPDATE alert_state SET last_notified=? WHERE device_id=? AND last_notified<=?')
    .bind(now,env.DEVICE_ID,now-600).run();
  if(!claim.meta.changes) return;
  try {
    const response=await fetch(env.ALERT_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:`${env.DEVICE_LABEL}: recent lightning activity detected. Check the dashboard.`,device_id:env.DEVICE_ID}),
      signal:AbortSignal.timeout(5000)});
    if(!response.ok) console.error('Alert webhook returned',response.status);
  } catch { console.error('Alert webhook failed'); }
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url); const now=Math.floor(Date.now()/1000);
    try {
      if(url.pathname==='/api/events' && request.method==='POST') return await ingest(request,env,ctx,now);
      if(url.pathname.startsWith('/api/')) {
        const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
        if(!await tokenMatches(token,env.READ_TOKEN)) return json({error:'Dashboard token required'},401);
        if(request.method!=='GET') return json({error:'Method not allowed'},405);
        if(url.pathname==='/api/trends') {
          const hours=Number(url.searchParams.get('hours')??24);
          if(![24,168].includes(hours)) return json({error:'Choose 24 or 168 hours'},400);
          return json(await readTrends(env.DB,env.DEVICE_ID,now,hours));
        }
        const device=await env.DB.prepare('SELECT * FROM devices WHERE device_id=?').bind(env.DEVICE_ID).first();
        if(url.pathname==='/api/status') {
          const {results}=await env.DB.prepare(`SELECT * FROM events WHERE device_id=? AND
            (detected_at>=? OR (detected_at IS NULL AND received_at>=?)) ORDER BY seq DESC LIMIT 4096`)
            .bind(env.DEVICE_ID,now-3600,now-3600).all();
          const battery=await env.DB.prepare('SELECT battery_mv FROM events WHERE device_id=? ORDER BY seq DESC LIMIT 1').bind(env.DEVICE_ID).first();
          return json({label:env.DEVICE_LABEL,now,device,battery_mv:battery?.battery_mv??null,...summarize(results,device,now),events:results.slice(0,100)});
        }
        if(url.pathname==='/api/history') {
          const before=Number(url.searchParams.get('before')??4294967296);
          if(!Number.isSafeInteger(before) || before<1) return json({error:'Invalid cursor'},400);
          const {results}=await env.DB.prepare('SELECT * FROM events WHERE device_id=? AND seq<? ORDER BY seq DESC LIMIT 200').bind(env.DEVICE_ID,before).all();
          return json({events:results,next_before:results.at(-1)?.seq??null});
        }
        return json({error:'Not found'},404);
      }
      return env.ASSETS.fetch(request);
    } catch(e) {
      console.error('Request failed',e.name); return json({error:'Service unavailable; retry later'},503);
    }
  },
  async scheduled(_event,env) {
    // 30 days of history. Old untimed records expire by arrival, never activate a storm.
    const cutoff=Math.floor(Date.now()/1000)-30*86400;
    await env.DB.prepare('DELETE FROM events WHERE COALESCE(detected_at,received_at)<?').bind(cutoff).run();
  }
};
