import {hmac} from '../src/index.js';
import {randomBytes} from 'node:crypto';
// Default is the LOCAL dev server. Cloud writes require explicit URL in environment.
const base=process.env.API_BASE_URL??'http://127.0.0.1:8787';
const secret=process.env.DEVICE_SECRET;
if(!secret || secret.length!==64) throw new Error('Set DEVICE_SECRET to the local .dev.vars secret');
const now=Math.floor(Date.now()/1000);
const seq=Number(process.env.EVENT_SEQ??randomBytes(4).readUInt32BE());
const body=JSON.stringify({v:1,device_id:process.env.DEVICE_ID??'yard-1',firmware:'simulator',sent_at:now,
  rssi:-60,dropped_total:0,rejected_total:0,storage_ok:true,sensor_ok:true,
  events:[{seq,type:process.env.EVENT_TYPE??'lightning',timestamp:now,distance_raw:17,energy:12345,battery_mv:3950}]});
const response=await fetch(`${base}/api/events`,{method:'POST',headers:{'Content-Type':'application/json',
  'X-Device-Id':process.env.DEVICE_ID??'yard-1','X-Signature':await hmac(secret,body)},body});
console.log(response.status,await response.text());
if(!response.ok) process.exitCode=1;
