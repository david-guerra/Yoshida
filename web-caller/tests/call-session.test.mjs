import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCallSession } from '../lib/call-session.ts';
import { createRoomEventHandlers } from '../lib/livekit-browser.ts';
const reference={callId:'47b6df80-a529-4cbe-a155-8378b27bf950',token:'b'.repeat(43)};
function fixture(overrides={}) {
  const states=[],requests=[],timers=[];let stored=null,events,stopped=0;
  const ports={
    acquire:async()=>({stop:()=>stopped++}), reference:()=>reference,
    read:()=>stored,write:r=>{stored=r;},
    request:async(path,body)=>{requests.push({path,body});return body?.callId?{callId:reference.callId,token:'room-token',serverUrl:'wss://example.test'}:{callId:reference.callId,ended:body?.action==='end',submission:{state:'not_sent'}};},
    connect:async(_connection,_mic,onEvent)=>{events=onEvent;return {stop:()=>stopped++,enableAudio:async()=>{}};},
    schedule:(fn,delay)=>{const timer={fn,delay,cancelled:false};timers.push(timer);return ()=>{timer.cancelled=true;};},
    ...overrides,
  };
  const session=createCallSession(ports,s=>states.push(structuredClone(s)));
  return {session,states,requests,timers,events:e=>events(e),stored:()=>stored,stopped:()=>stopped};
}

test('permission cancellation releases late microphone without requesting a call', async()=>{
  let permission,stopped=0;
  const f=fixture({acquire:()=>new Promise(resolve=>{permission=resolve;})});
  const start=f.session.start();
  await f.session.end();
  permission({stop:()=>stopped++});await start;
  assert.equal(stopped,1);assert.equal(f.requests.length,0);assert.equal(f.states.at(-1).call,'ended');
});

test('room connection and readiness cannot become conversation until actual intended audio plays',async()=>{
  const f=fixture();await f.session.start();
  assert.deepEqual(f.stored(),reference);
  assert.equal(f.states.find(state=>state.call==='connecting').submission.state,'not_sent');
  assert.equal(f.states.at(-1).call,'starting');
  f.events({type:'ready'});assert.equal(f.states.at(-1).call,'starting');
  f.events({type:'blocked'});assert.equal(f.states.at(-1).audioBlocked,true);
  f.events({type:'audio'});assert.equal(f.states.at(-1).call,'conversation');
  assert.equal(f.states.at(-1).audioBlocked,false);
});

test('scoped server readiness can pair with intended agent audio and an ended status tears media down',async()=>{
  let status={callId:reference.callId,ended:false,ready:true,event:'listening',submission:{state:'not_sent'}}, stopped=0;
  const f=fixture({request:async(_path,body)=>body?.callId?{callId:reference.callId,token:'token',serverUrl:'wss://test'}:status,
    connect:async(_connection,_mic,onEvent)=>{onEvent({type:'audio'});return {stop:()=>stopped++,enableAudio:async()=>{}};}});
  await f.session.start();await f.session.refresh();
  assert.equal(f.states.at(-1).call,'conversation');
  status={...status,ended:true};await f.session.refresh();
  assert.equal(f.states.at(-1).call,'ended');assert.equal(stopped,1);
});

test('readiness and playback received while connecting are not overwritten after connect resolves',async()=>{
  const f=fixture({
    connect:async(_connection,_mic,onEvent)=>{
      onEvent({type:'ready'});onEvent({type:'audio'});
      return {stop:()=>{},enableAudio:async()=>{}};
    },
  });
  await f.session.start();
  assert.equal(f.states.at(-1).call,'conversation');
});

test('reloaded uncertain submission stays blocked on absence and becomes saved only from valid receipt',async()=>{
  let status={callId:reference.callId,ended:true,submission:{state:'unclear'}};
  const f=fixture({read:()=>reference,request:async()=>status});
  await f.session.recover();
  assert.equal(f.states.at(-1).canStart,false);
  status={...status,submission:{state:'saved',receipt:{status:'created',booking_status:'requested',tentative:true,booking_id:'persisted-1',submission_id:'submission-1'}}};
  await f.session.refresh();assert.equal(f.states.at(-1).submission.receipt.booking_id,'persisted-1');
  assert.equal(f.states.at(-1).canStart,true);
  status={...status,submission:{state:'unclear'},event:'speech_error'};
  await f.session.refresh();assert.equal(f.states.at(-1).submission.receipt.booking_id,'persisted-1');
});

test('lost start response retries the same saved reference once, late connect after hangup is stopped',async()=>{
  let attempts=0,finish,stopped=0;
  const f=fixture({request:async(_path,body)=>{
    if(body?.callId){attempts++;if(attempts===1)throw new Error('lost');return {callId:reference.callId,token:'token',serverUrl:'wss://test'};}
    return {callId:reference.callId,ended:true,submission:{state:'not_sent'}};
  },connect:()=>new Promise(resolve=>{finish=resolve;})});
  const start=f.session.start();await new Promise(resolve=>setImmediate(resolve));
  await f.session.end();finish({stop:()=>stopped++,enableAudio:async()=>{}});await start;
  assert.equal(attempts,2);assert.equal(stopped,1);assert.equal(f.states.at(-1).call,'ended');
});

test('blocked audio waits for the user; missing worker and reconnect have bounded exits',async()=>{
  const f=fixture();await f.session.start();
  f.events({type:'blocked'});
  assert.ok(f.timers.filter(t=>t.delay===30000).every(t=>t.cancelled));
  await f.session.enableAudio();
  f.timers.findLast(t=>t.delay===30000 && !t.cancelled).fn();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.states.at(-1).call,'ended');
  const g=fixture();await g.session.start();g.events({type:'ready'});g.events({type:'audio'});g.events({type:'reconnecting'});
  g.timers.findLast(t=>t.delay===10000 && !t.cancelled).fn();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(g.states.at(-1).call,'ended');
});

test('transport reconnect preserves proven playback and completes inside the original recovery budget',async()=>{
  const f=fixture();await f.session.start();f.events({type:'ready'});f.events({type:'audio'});
  f.events({type:'reconnecting'});
  const recovery=f.timers.findLast(t=>t.delay===10000 && !t.cancelled);
  assert.equal(f.states.at(-1).call,'reconnecting');
  f.events({type:'reconnected'});
  assert.equal(f.states.at(-1).call,'conversation');
  assert.equal(recovery.cancelled,true);
  assert.equal(f.timers.filter(t=>t.delay===30000 && !t.cancelled).length,0);
});

test('an intended worker loss requires replacement readiness and playback within ten seconds',async()=>{
  const f=fixture({request:async(_path,body)=>body?.callId?{callId:reference.callId,token:'room-token',serverUrl:'wss://example.test'}:{callId:reference.callId,ended:false,ready:true,submission:{state:'not_sent'}}});
  await f.session.start();f.events({type:'ready'});f.events({type:'audio'});
  f.events({type:'participant_lost'});
  assert.equal(f.states.at(-1).call,'reconnecting');
  await f.session.refresh();
  f.events({type:'audio'});assert.equal(f.states.at(-1).call,'reconnecting');
  f.events({type:'participant_ready'});assert.equal(f.states.at(-1).call,'conversation');
  assert.ok(f.timers.filter(t=>t.delay===10000).every(t=>t.cancelled));
});

test('browser room events are scoped and never mistake an audio-context status for playback',()=>{
  const events=[];
  const intended={kind:'agent'},unrelated={kind:'standard'};
  const handlers=createRoomEventHandlers(participant=>participant===intended,event=>events.push(event.type));
  handlers.audioPlaybackStatusChanged(true);
  handlers.participantDisconnected(unrelated);
  assert.deepEqual(events,[]);
  handlers.audioPlaybackStatusChanged(false);
  handlers.activeSpeakersChanged([unrelated,intended]);
  handlers.participantDisconnected(intended);
  assert.deepEqual(events,['blocked','speaking','participant_lost']);
});

test('speech timeout never replays a submission and lookup pauses its budget',async()=>{
  const f=fixture();await f.session.start();await f.session.refresh();
  f.events({type:'thinking'});f.events({type:'lookup'});
  assert.ok(f.timers.filter(t=>t.delay===15000).every(t=>t.cancelled));
  f.events({type:'thinking'});f.timers.findLast(t=>t.delay===15000 && !t.cancelled).fn();
  f.timers.findLast(t=>t.delay===15000 && !t.cancelled).fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.states.at(-1).call,'ended');
  assert.ok(f.requests.every(r=>r.body?.action!=='submit'));
});

test('scoped speaking cancels the reply deadline without replaying a mutation',async()=>{
  const f=fixture();await f.session.start();f.events({type:'ready'});f.events({type:'audio'});
  f.events({type:'thinking'});
  assert.ok(f.timers.some(t=>t.delay===15000 && !t.cancelled));
  f.events({type:'speaking'});
  assert.ok(f.timers.filter(t=>t.delay===15000).every(t=>t.cancelled));
  assert.equal(f.states.at(-1).call,'conversation');
  assert.ok(f.requests.every(r=>r.body?.action!=='submit'));
});
