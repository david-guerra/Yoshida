import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmodSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createCallService } from '../lib/call-service.ts';

const browserToken = 'b'.repeat(43);
function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'yoshida-calls-'));
  const dispatches = [], creates = [];
  const options = {
    databasePath: join(dir, 'calls.sqlite'), serverUrl:'wss://voice.example.test',
    callServerUrl:'http://127.0.0.1:3000', callerPhone:'+12025550102',
    listDispatch: async () => dispatches,
    createDispatch: async (room, metadata) => { creates.push({room, metadata}); const d={id:'dispatch1',agentName:'client-call-agent',metadata:JSON.stringify(metadata)}; dispatches.push(d); return d; },
    deleteRoom: async () => {}, mintToken: async room => `token-for-${room}`,
    backend: async () => Response.json({}, {status:404}), ...overrides,
  };
  const service = createCallService(options);
  t.after(() => {service.close();rmSync(dir,{recursive:true,force:true});});
  return {service, options, creates, dispatches, id:randomUUID()};
}

test('concurrent same-call starts preserve identity and reuse one pending dispatch', async t => {
  const {service,creates,id} = fixture(t);
  const results = await Promise.allSettled([service.start(id,browserToken),service.start(id,browserToken)]);
  assert.equal(creates.length,1);
  assert.ok(results.some(r=>r.status==='fulfilled'));
  const result = await service.start(id,browserToken);
  assert.equal(result.callId,id);
  assert.equal(result.serverUrl,'wss://voice.example.test');
  assert.equal(creates[0].metadata.caller_phone,'+12025550102');
  assert.equal(creates[0].metadata.call_id,id);
  assert.notEqual(creates[0].metadata.worker_token,browserToken);
  assert.equal(creates.length,1);
  await assert.rejects(service.start(id,browserToken,'+12025550103'),{status:409});
});

test('the durable call ledger is private on POSIX filesystems', t => {
  const {options}=fixture(t);
  if (process.platform === 'win32') return;
  assert.equal(statSync(dirname(options.databasePath)).mode & 0o777,0o700);
  assert.equal(statSync(options.databasePath).mode & 0o777,0o600);
});

test('an insecure existing ledger directory is rejected without changing its permissions', t => {
  if (process.platform === 'win32') return;
  const dir=mkdtempSync(join(tmpdir(),'yoshida-shared-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  chmodSync(dir,0o750);
  const options={
    databasePath:join(dir,'calls.sqlite'),serverUrl:'wss://voice.example.test',callServerUrl:'http://127.0.0.1:3000',callerPhone:'+12025550102',
    listDispatch:async()=>[],createDispatch:async()=>({id:'unused',agentName:'client-call-agent'}),deleteRoom:async()=>{},mintToken:async()=>'',backend:async()=>Response.json({}, {status:404}),
  };
  assert.throws(()=>createCallService(options),/private/);
  assert.equal(statSync(dir).mode & 0o777,0o750);
});

test('lost dispatch response is reconciled without another create, including server restart', async t => {
  let created, count=0;
  const {service,options,id} = fixture(t, {
    listDispatch: async () => created ? [created] : [],
    createDispatch: async (_room,metadata) => {count++; created={id:'accepted',agentName:'client-call-agent',metadata:JSON.stringify(metadata)};throw new Error('lost response');},
  });
  await assert.rejects(service.start(id,browserToken),{status:503});
  const restarted = createCallService(options);
  t.after(()=>restarted.close());
  assert.equal((await restarted.start(id,browserToken)).callId,id);
  assert.equal(count,1);
});

test('inspection errors and ambiguous absent dispatch never trigger a blind create', async t => {
  let mode='auth', creates=0;
  const {service,id} = fixture(t, {
    listDispatch:async()=>{if(mode==='auth')throw {code:'unauthenticated'};return [];},
    createDispatch:async()=>{creates++;throw new Error('unknown');},
  });
  await assert.rejects(service.start(id,browserToken),{status:503});
  assert.equal(creates,0);
  mode='absent';
  await assert.rejects(service.start(id,browserToken),{status:503});
  await assert.rejects(service.start(id,browserToken),{status:503});
  assert.equal(creates,1);
});

test('cancel before start or during dispatch prevents late connection and deletes its room', async t => {
  let finish, deleted=0;
  const {service,id} = fixture(t, {
    createDispatch:async()=>new Promise(resolve=>{finish=resolve;}),
    deleteRoom:async()=>{deleted++;},
  });
  const cancelledId=randomUUID();
  await service.end(cancelledId,browserToken);
  await assert.rejects(service.start(cancelledId,browserToken),{status:409});
  const start=service.start(id,browserToken);
  await new Promise(resolve=>setImmediate(resolve));
  await service.end(id,browserToken);
  finish({id:'late',agentName:'client-call-agent'});
  await assert.rejects(start,{status:409});
  assert.ok(deleted>=2);
  assert.equal((await service.status(id,browserToken)).ended,true);
});

test('lost save response recovers original receipt after hangup and server restart, with private capabilities', async t => {
  let saved, writes=0;
  const {service,options,id,creates} = fixture(t,{backend:async(path,init)=>{
    if(init.method==='POST'){
      writes++;
      const payload=JSON.parse(init.body);
      saved={status:'created',booking_status:'requested',tentative:true,booking_id:'booking-one',submission_id:payload.submission_id};
      throw new Error('response lost after commit');
    }
    return saved ? Response.json(saved) : Response.json({}, {status:404});
  }});
  await service.start(id,browserToken);
  const m=creates[0].metadata;
  const payload={reviewed:true,submission_id:m.submission_id,client:{name:'Synthetic'}};
  await assert.rejects(service.submit(id,browserToken,payload),{status:403});
  await assert.rejects(service.submit(id,m.worker_token,payload),{status:503});
  await service.end(id,browserToken);
  const restarted=createCallService(options);t.after(()=>restarted.close());
  const status=await restarted.status(id,browserToken);
  assert.equal(status.submission.state,'saved');
  assert.equal(status.submission.receipt.booking_id,'booking-one');
  assert.equal((await restarted.submit(id,m.worker_token,payload)).booking_id,'booking-one');
  await assert.rejects(restarted.submit(id,m.worker_token,{...payload,client:{name:'Changed'}}),{status:409});
  await assert.rejects(restarted.status(id,'x'.repeat(43)),{status:403});
  await assert.rejects(restarted.end(id,m.worker_token),{status:403});
  assert.equal(writes,1);
  assert.ok(!JSON.stringify(status).includes(m.submission_token));
  await restarted.event(id,m.worker_token,'speech_error');
  assert.equal((await restarted.status(id,browserToken)).submission.state,'saved');
});

test('404 during an interrupted save stays unclear, bounded retry keeps exact intake, late receipt wins', async t => {
  const bodies=[];
  const {service,id,creates} = fixture(t,{backend:async(_path,init)=>{
    if(init.method==='GET') return Response.json({}, {status:404});
    bodies.push(init.body); return Response.json({}, {status:503});
  }});
  await service.start(id,browserToken);
  const m=creates[0].metadata,payload={submission_id:m.submission_id,reviewed:true};
  await assert.rejects(service.submit(id,m.worker_token,payload),{status:503});
  assert.equal((await service.status(id,browserToken)).submission.state,'unclear');
  await service.end(id,browserToken);
  await assert.rejects(service.submit(id,m.worker_token,payload),{status:503});
  await assert.rejects(service.submit(id,m.worker_token,payload),{status:409});
  assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
});

test('authoritatively rejected intake can be corrected, but ended calls cannot first submit', async t => {
  let responseStatus=422;
  const {service,id,creates} = fixture(t,{backend:async()=>Response.json({}, {status:responseStatus})});
  await service.start(id,browserToken);
  const m=creates[0].metadata,payload={submission_id:m.submission_id,reviewed:true,client:{name:'Before'}};
  await assert.rejects(service.submit(id,m.worker_token,payload),{status:422});
  assert.equal((await service.status(id,browserToken)).submission.state,'rejected');
  responseStatus=503;
  await assert.rejects(service.submit(id,m.worker_token,{...payload,client:{name:'Corrected'}}),{status:503});
  const second=randomUUID();await service.start(second,browserToken);
  const other=creates[1].metadata;await service.end(second,browserToken);
  await assert.rejects(service.submit(second,other.worker_token,{submission_id:other.submission_id,reviewed:true}),{status:410});
});

test('HTTP boundary keeps capabilities in headers, rejects malformed inputs and sanitizes failures', async t => {
  const {callHttp}=await import('../lib/call-http.ts');
  const {service,id}=fixture(t);
  const request=(body,token=browserToken)=>new Request('http://localhost/api/calls',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const started=await callHttp(request({callId:id}),()=>service);
  assert.equal(started.status,200);
  assert.equal(started.headers.get('cache-control'),'no-store');
  assert.equal((await callHttp(request({callId:id},'invalid'),()=>service)).status,400);
  const response=await callHttp(request({callId:id}),()=>{throw new Error('private-secret');});
  assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private-secret'));
});

test('worker readiness remains latched when later state events arrive', async t => {
  const {service,id,creates}=fixture(t);await service.start(id,browserToken);
  const worker=creates[0].metadata.worker_token;
  await service.event(id,worker,'ready');await service.event(id,worker,'listening');
  const status=await service.status(id,browserToken);
  assert.equal(status.ready,true);assert.equal(status.event,'listening');
});

test('a process restart turns an orphaned in-flight save into an unclear outcome', async t => {
  let saved;
  const {service,options,id,creates}=fixture(t,{backend:async()=>saved ? Response.json(saved) : Response.json({}, {status:404})});await service.start(id,browserToken);
  const submissionId=creates[0].metadata.submission_id;
  const database=new DatabaseSync(options.databasePath);
  const row=database.prepare('SELECT record FROM calls WHERE id=?').get(id);
  const record=JSON.parse(row.record);
  record.state='saving';record.attempts=1;
  record.payload=JSON.stringify({reviewed:true,submission_id:submissionId});
  database.prepare('UPDATE calls SET record=? WHERE id=?').run(JSON.stringify(record),id);
  database.close();
  const restarted=createCallService(options);t.after(()=>restarted.close());
  assert.equal((await restarted.status(id,browserToken)).submission.state,'unclear');
  saved={status:'created',booking_status:'requested',tentative:true,booking_id:'late-booking',submission_id:submissionId};
  assert.equal((await restarted.status(id,browserToken)).submission.receipt.booking_id,'late-booking');
});
