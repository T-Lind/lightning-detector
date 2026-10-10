// LOCAL verification only. Requires wrangler dev and initialized local D1.
import assert from 'node:assert/strict';
import {hmac} from '../src/index.js';
const base='http://127.0.0.1:8787',secret='a'.repeat(64),token='b'.repeat(64);
const now=Math.floor(Date.now()/1000),seq=1000+Math.floor(Math.random()*1000000);
const body={v:1,device_id:'yard-1',firmware:'local-test',sent_at:now,rssi:-67,dropped_total:0,rejected_total:0,storage_ok:true,sensor_ok:true,
  events:[{seq,type:'lightning',timestamp:now,distance_raw:17,energy:2000000,battery_mv:3950},
          {seq:seq+1,type:'lightning',timestamp:now-7200,distance_raw:5,energy:1000,battery_mv:3950},
          {seq:seq+2,type:'lightning',timestamp:null,distance_raw:5,energy:1000,battery_mv:3950},
          {seq:seq+3,type:'lightning',timestamp:now+3600,distance_raw:5,energy:1000,battery_mv:3950}]};
async function post(b,signature){const raw=JSON.stringify(b);return fetch(`${base}/api/events`,{method:'POST',headers:{'Content-Type':'application/json','X-Device-Id':'yard-1','X-Signature':signature??await hmac(secret,raw)},body:raw});}
let r=await post(body);assert.equal(r.status,200,await r.clone().text());assert.deepEqual((await r.json()).accepted,[seq,seq+1,seq+2,seq+3]);
r=await post(body);assert.equal(r.status,200); // retransmit same IDs
r=await post({...body,events:[{...body.events[0],energy:42}]});assert.equal(r.status,409); // conflicting reuse
r=await post(body,'0'.repeat(64));assert.equal(r.status,401);
r=await post({...body,sent_at:now-301});assert.equal(r.status,400);
r=await fetch(`${base}/api/status`);assert.equal(r.status,401);
r=await fetch(`${base}/api/status`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(r.status,200);
const status=await r.json();assert.equal(status.latest_distance_raw,17);assert.equal(status.nearest_distance_raw,17);
assert.equal(status.health,'reporting');assert.ok(status.untimed_events>=1);
r=await fetch(`${base}/api/history?before=${seq+4}`,{headers:{Authorization:`Bearer ${token}`}});
const history=await r.json();assert.equal(history.events.filter(e=>e.seq===seq).length,1);
assert.equal(history.events.find(e=>e.seq===seq+3).detected_at,null);
r=await fetch(base);assert.equal(r.status,200);assert.ok((await r.text()).includes('id="login-form"'));
console.log('PASS: actual local Worker + D1 ingestion, retry deduplication, conflict rejection, HMAC rejection, replay expiry, private reads, backlog semantics, static assets.');
console.log('Local dashboard has synthetic observations for visual review, including a quarantined future clock.');
