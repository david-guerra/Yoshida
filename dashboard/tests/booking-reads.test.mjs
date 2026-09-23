import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapBooking, formatAppointment } from '../src/lib/orderMapper.ts';

test('unknown schedules and lifecycle stay unknown, while past requests still need review', () => {
  const unknown = mapBooking({ id: 'unknown', status: 'unconfirmed' });
  assert.equal(unknown.start, null);
  assert.equal(unknown.end, null);
  assert.equal(unknown.status, 'Unknown status');
  assert.equal(formatAppointment(unknown), 'Unknown');
  assert.equal(unknown.calendarEligible, false);
  const past = mapBooking({ id: 'past', status: 'requested', start_time: '2000-01-01T10:00:00Z', end_time: '2000-01-01T12:00:00Z' });
  assert.equal(past.needsReview, true);
  assert.equal(past.canConfirm, false);
  assert.equal(past.canDecline, true);
  assert.equal(mapBooking({ id: 'declined', status: 'declined' }).calendarEligible, false);
});

// Transport is the external seam; exercise actual mapping and pagination together.
test('reads all pages for totals and notes, and looks up details directly', async () => {
  const { createBookingReader } = await import('../src/lib/orders.ts');
  const bookings = Array.from({length: 31}, (_, i) => ({id: `booking${i}`, cleaner: 'owner', client: 'client1', expand: {client: {id:'client1'}}, status: 'requested'}));
  const notes = Array.from({length: 31}, (_, i) => ({id: `note${i}`, note: `Review note ${i}`}));
  const transport = async (url) => {
    url = new URL(url);
    if (url.pathname.endsWith('auth-refresh')) return Response.json({record: {id: 'user1'}});
    if (url.pathname.includes('/cleaners/')) return Response.json({items: [{id: 'owner'}], page:1, totalPages:1, totalItems:1});
    if (url.pathname.endsWith('/bookings/records/booking30')) return Response.json(bookings[30]);
    const items = url.pathname.includes('/booking_notes/') ? notes : url.pathname.includes('/bookings/') ? bookings : [];
    const page = Number(url.searchParams.get('page') || 1);
    return Response.json({items: items.slice((page-1)*30, page*30), page, totalPages: Math.ceil(items.length/30), totalItems:items.length});
  };
  const reader = createBookingReader({baseUrl:'http://example.test', token:'owner-token', cleanerId:'owner', fetch:transport});
  assert.equal((await reader.list({kind:'home'})).orders.length, 31);
  const second = await reader.list({kind:'orders', page:2});
  assert.equal(second.total, 31);
  assert.equal(second.orders[0].orderId, 'booking30');
  const detail = await reader.detail('booking30');
  assert.equal(detail.order.orderId, 'booking30');
  assert.equal(detail.notes.length, 31);
  assert.deepEqual(detail.failedSections, []);
});

test('current view rejects old results and clears revoked session data', async () => {
  const {createBookingView} = await import('../src/lib/bookingView.ts');
  const states = [], pending = [];
  const view = createBookingView(signal => new Promise(resolve => pending.push({resolve,signal})), state => states.push(state));
  const old = view.refresh();
  const latest = view.refresh();
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve('current'); await latest;
  pending[0].resolve('old'); await old;
  assert.equal(states.at(-1).data, 'current');
  const late = view.refresh();
  view.invalidateSession();
  pending[2].resolve('private'); await late;
  assert.equal(states.at(-1).data, undefined);
  assert.equal(states.at(-1).error.kind, 'auth');
  assert.equal(await view.refresh(), false);
  view.dispose();
});

test('initial failure is an error; failed refresh retains labelled data until recovery', async () => {
  const {createBookingView} = await import('../src/lib/bookingView.ts');
  let fail = true;
  const states=[];
  const view=createBookingView(async () => {if(fail) throw Error(); return ['saved'];}, s=>states.push(s));
  await assert.rejects(view.refresh());
  assert.equal(states.at(-1).data, undefined);
  assert.equal(states.at(-1).error.kind, 'unavailable');
  fail=false; await view.refresh();
  const updatedAt=states.at(-1).updatedAt;
  fail=true; await assert.rejects(view.refresh());
  assert.deepEqual(states.at(-1).data, ['saved']);
  assert.equal(states.at(-1).updatedAt, updatedAt);
  fail=false; await view.refresh();
  assert.equal(states.at(-1).error, undefined);
  view.dispose();
});

test('read failure retries once, authentication never becomes empty, and later notes failure is partial', async () => {
  const {createBookingReader,readJson} = await import('../src/lib/orders.ts');
  let attempts=0;
  await assert.rejects(readJson('http://example.test', {}, async()=>{attempts++; return new Response('',{status:503});}), {kind:'unavailable'});
  assert.equal(attempts,2);
  attempts=0;
  await assert.rejects(readJson('http://example.test', {}, async()=>{attempts++; return new Response('',{status:401});}), {kind:'auth'});
  assert.equal(attempts,1);
  const reader=createBookingReader({baseUrl:'http://example.test',token:'token',cleanerId:'owner',fetch:async url=>{
    url=new URL(url);
    if(url.pathname.endsWith('auth-refresh')) return Response.json({record:{id:'user'}});
    if(url.pathname.includes('/cleaners/')) return Response.json({items:[{id:'owner'}],page:1,totalPages:1,totalItems:1});
    if(url.pathname.includes('/bookings/')) return Response.json({id:'b',cleaner:'owner',request_snapshot:{}});
    if(url.searchParams.get('page')==='2') return new Response('',{status:503});
    return Response.json({items:Array.from({length:30},(_,i)=>({id:String(i),note:'Note'})),page:1,totalItems:31,totalPages:2});
  }});
  const detail=await reader.detail('b');
  assert.equal(detail.order.orderId,'b');
  assert.deepEqual(detail.failedSections,['Booking notes']);
  assert.equal(detail.notes.length,30);
});

test('Berlin calendar ranges include both clock changes without host-zone assumptions', async () => {
  const {calendarWeek} = await import('../src/lib/bookingCalendar.ts');
  assert.deepEqual(calendarWeek("2026-03-29"), {from:'2026-03-28T23:00:00.000Z',to:'2026-04-04T22:00:00.000Z'});
  assert.deepEqual(calendarWeek("2026-10-25"), {from:'2026-10-24T22:00:00.000Z',to:'2026-10-31T23:00:00.000Z'});
});

test('malformed saved and reviewed dates cannot be confirmed or placed on Calendar', () => {
  const snapshot = {caller_phone:'+12025550102',client:{name:'Test'},address:{street:'Testweg 1',postal_code:'10115',city:'Berlin',country:'DE'},
    booking:{start_time:'not-a-date',timezone:'Europe/Berlin',estimated_hours:2,service_type:'regular_cleaning'}};
  assert.equal(mapBooking({id:'b',status:'requested',start_time:'2099-01-15T09:00:00Z',end_time:'2099-01-15T11:00:00Z',request_snapshot:snapshot}).canConfirm,false);
  assert.equal(mapBooking({id:'b',status:'requested',start_time:'2099-02-30T10:00:00Z',end_time:'2099-03-03T10:00:00Z'}).calendarEligible,false);
});

test('a partial snapshot cannot hide a failed displayed relation', async () => {
  const {createBookingReader}=await import('../src/lib/orders.ts');
  const reader=createBookingReader({baseUrl:'http://example.test',token:'token',cleanerId:'owner',fetch:async url=>{
    const path=new URL(url).pathname;
    if(path.endsWith('auth-refresh')) return Response.json({record:{id:'user'}});
    if(path.includes('/cleaners/')) return Response.json({items:[{id:'owner'}],page:1,totalPages:1,totalItems:1});
    if(path.includes('/bookings/')) return Response.json({id:'b',cleaner:'owner',client:'client',address:'address',status:'requested',request_snapshot:{}});
    return Response.json({items:[],page:1,totalPages:0,totalItems:0});
  }});
  assert.deepEqual((await reader.detail('b')).failedSections.sort(),['Address','Client']);
});

test('calendar civil dates and Berlin times are identical across host DST zones', async () => {
  const {execFileSync} = await import('node:child_process');
  const script = `import {calendarWeek,berlinDay} from './dashboard/src/lib/bookingCalendar.ts';
    import {formatTime} from './dashboard/src/lib/orderMapper.ts';
    const date=new Date('2026-03-08T01:30:00Z');
    console.log(JSON.stringify([berlinDay(date),formatTime(date),calendarWeek(berlinDay(date))]));`;
  const results=['Europe/Berlin','America/Los_Angeles'].map(TZ => execFileSync(process.execPath,['--input-type=module','-e',script],{
    cwd:new URL('../../',import.meta.url),env:{...process.env,TZ,NODE_NO_WARNINGS:'1'},encoding:'utf8'}));
  assert.equal(results[0],results[1]);
  assert.equal(JSON.parse(results[0])[1],'02:30');
});

test('each read attempt has a 10-second deadline and cancellation stops retry work', async (t) => {
  const {readJson}=await import('../src/lib/orders.ts');
  const deadlines=[];
  t.mock.method(AbortSignal,'timeout',ms=>{
    deadlines.push(ms);
    const controller=new AbortController();
    queueMicrotask(()=>controller.abort());
    return controller.signal;
  });
  const transport=async (_url,{signal})=>new Promise((_resolve,reject)=>{
    if(signal.aborted) reject(Error('timeout'));
    else signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true});
  });
  await assert.rejects(readJson('http://example.test',{},transport),{kind:'unavailable'});
  assert.deepEqual(deadlines,[10000,10000]);
  const controller=new AbortController(); controller.abort();
  await assert.rejects(readJson('http://example.test',{signal:controller.signal},transport));
  assert.equal(deadlines.length,2);
});

test('Berlin gaps, ambiguous times and conflicting offsets block Confirm', () => {
  const record = {id:'b',status:'requested',start_time:'2099-01-15T09:00:00Z',end_time:'2099-01-15T11:00:00Z',
    request_snapshot:{caller_phone:'+12025550102',client:{name:'Test'},address:{street:'Testweg 1',postal_code:'10115',city:'Berlin',country:'DE'},
      booking:{start_time:'',timezone:'Europe/Berlin',estimated_hours:2,service_type:'regular_cleaning'}}};
  for (const time of ['2027-03-28T02:30','2027-03-28T02:30+01:00','2027-10-31T02:30']) {
    record.request_snapshot.booking.start_time=time;
    assert.equal(mapBooking(record).canConfirm,false,time);
  }
});

test('inbox search reaches later pages and separates unanswered requests from history', async () => {
  const {createBookingReader} = await import('../src/lib/orders.ts');
  const bookings = Array.from({length:31},(_,i)=>({id:`b${i}`,status:'requested',created:`2026-09-${String(i%20+1).padStart(2,'0')}`,expand:{client:{name:i===30?'Later page client':`Client ${i}`}}}));
  bookings.push({id:'declined',status:'declined'}, {id:'confirmed',status:'confirmed',start_time:'2099-01-01T09:00:00Z',end_time:'2099-01-01T11:00:00Z'});
  const reader=createBookingReader({baseUrl:'http://example.test',token:'token',cleanerId:'owner',fetch:async url=>{
    const u=new URL(url);
    if(u.pathname.endsWith('auth-refresh'))return Response.json({});
    if(u.pathname.includes('/cleaners/'))return Response.json({items:[{id:'owner'}],page:1,totalPages:1,totalItems:1});
    const page=Number(u.searchParams.get('page'));
    return Response.json({items:bookings.slice((page-1)*30,page*30),page,totalPages:2,totalItems:33});
  }});
  const search=await reader.list({kind:'inbox',view:'review',search:'later PAGE',page:1});
  assert.deepEqual(search.orders.map(o=>o.orderId),['b30']);
  assert.deepEqual(search.counts,{review:31,upcoming:1,history:1});
  const history=await reader.list({kind:'inbox',view:'history',page:1});
  assert.deepEqual(history.orders.map(o=>o.orderId),['declined']);
  const last=await reader.list({kind:'inbox',view:'review',page:999});
  assert.equal(last.page,last.totalPages);
  assert.ok(last.orders.length>0);
});

test('month includes complete edge weeks and Berlin DST transitions', async () => {
  const {calendarMonth,monthDays} = await import('../src/lib/bookingCalendar.ts');
  assert.deepEqual(calendarMonth('2026-03-15'),{from:'2026-02-28T23:00:00.000Z',to:'2026-04-04T22:00:00.000Z'});
  assert.equal(monthDays('2026-03-15').length,35);
  assert.equal(monthDays('2026-08-01').length,42);
});

test('review exposes both original and translated notes without inventing a translation', async () => {
  const {createBookingReader}=await import('../src/lib/orders.ts');
  const reader=createBookingReader({baseUrl:'http://example.test',token:'token',cleanerId:'owner',fetch:async url=>{
    const path=new URL(url).pathname;
    if(path.endsWith('auth-refresh'))return Response.json({});
    if(path.includes('/cleaners/'))return Response.json({items:[{id:'owner'}],page:1,totalPages:1,totalItems:1});
    if(path.includes('/bookings/'))return Response.json({id:'b',cleaner:'owner',request_snapshot:{client:{name:'Test'},address:{street:'Test'}}});
    return Response.json({items:[{id:'n',note:'Bitte klingeln.',note_translated:'Please ring.'},{id:'original',note:'Kein Aufzug.'}],page:1,totalPages:1,totalItems:2});
  }});
  const {notes}=await reader.detail('b');
  assert.equal(notes[0].original,'Bitte klingeln.');
  assert.equal(notes[0].translation,'Please ring.');
  assert.equal(notes[1].translation,null);
});
