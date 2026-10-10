import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBatch,summarize,eventCanonical,detectionTime} from '../src/model.js';
import {hmac} from '../src/index.js';
import {createHmac} from 'node:crypto';
const now=1791100000;
const event=(overrides={})=>({seq:1,type:'lightning',timestamp:now,distance_raw:17,energy:0x1fffff,battery_mv:3950,...overrides});
const batch=(overrides={})=>({v:1,device_id:'yard-1',firmware:'1.0.0',sent_at:now,rssi:-67,dropped_total:0,rejected_total:0,storage_ok:true,sensor_ok:true,events:[event()],...overrides});
const device={last_seen:now,storage_ok:1,sensor_ok:1};
test('exact UTF-8 HMAC matches Node crypto',async()=>{const body=JSON.stringify(batch()),secret='a'.repeat(64);assert.equal(await hmac(secret,body),createHmac('sha256',secret).update(body).digest('hex'));});
test('valid 21-bit energy, overhead, out-of-range accepted',()=>{for(const distance_raw of [1,17,63])assert.equal(validateBatch(batch({events:[event({distance_raw})]}),'yard-1',now).v,1);});
test('malformed IDs, duplicate IDs, future clocks, invalid range or energy rejected',()=>{
  for(const b of [batch({device_id:'attacker'}),batch({sent_at:now+301}),batch({events:[event(),event()]}),batch({events:[event({distance_raw:2})]}),batch({events:[event({energy:0x200000})]}),batch({events:[event({timestamp:0x100000000})]}),batch({events:[event({type:'heartbeat'})]})])assert.throws(()=>validateBatch(b,'yard-1',now));
});
test('future capture clock is stored as untimed without changing retry identity',()=>{
  const e=event({timestamp:now+3600}), original=eventCanonical(e);
  validateBatch(batch({events:[e]}),'yard-1',now);
  assert.equal(detectionTime(e,now),null);
  assert.equal(eventCanonical(e),original);
  assert.equal(detectionTime(event(),now),now);
  assert.equal(summarize([{type:'lightning',detected_at:detectionTime(e,now),distance_raw:5}],device,now).state,'no detections in last hour');
});
test('old backlog, untimed detections and range changes cannot create a current storm',()=>{
  const rows=[{type:'lightning',detected_at:now-3601,distance_raw:5},{type:'lightning',detected_at:null,distance_raw:5},{type:'range_change',detected_at:now,distance_raw:5}];
  assert.equal(summarize(rows,device,now).state,'no detections in last hour');
  assert.equal(summarize(rows,device,now).untimed_events,1);
});
test('overhead shown as nearby and 63 excluded from minimum',()=>{
  const result=summarize([{type:'lightning',detected_at:now-1,distance_raw:1},{type:'lightning',detected_at:now,distance_raw:63}],device,now);
  assert.equal(result.state,'nearby activity');assert.equal(result.nearest_distance_raw,1);assert.equal(result.latest_distance_raw,63);
});
test('overdue and faulty detector have unknown status',()=>{
  assert.equal(summarize([],null,now).state,'unknown');
  assert.equal(summarize([],{...device,last_seen:now-43201},now).state,'unknown');
  assert.equal(summarize([],{...device,sensor_ok:0},now).state,'unknown');
});
test('trend requires separate populated windows and substantial change',()=>{
  const rows=[...Array.from({length:3},(_,i)=>({type:'lightning',detected_at:now-900+i,distance_raw:31})),...Array.from({length:3},(_,i)=>({type:'lightning',detected_at:now-100+i,distance_raw:17}))];
  assert.equal(summarize(rows,device,now).trend,'range decreasing');
  assert.equal(summarize(rows.slice(1),device,now).trend,'insufficient data');
});
test('event fingerprint ignores envelope transport data',()=>{assert.equal(eventCanonical(event()),eventCanonical({...event(),rssi:-80}));assert.notEqual(eventCanonical(event()),eventCanonical(event({energy:1})));});
