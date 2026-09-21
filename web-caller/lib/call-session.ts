export type CallReference = {callId: string; token: string};
export type SubmissionView = {state: 'not_sent'|'saving'|'unclear'|'saved'|'rejected'; receipt?: {booking_id:string;submission_id:string;tentative:true;booking_status:'requested';status:'created'}};
export type CallView = {
  call: 'ready'|'permission'|'connecting'|'starting'|'conversation'|'reconnecting'|'ended';
  submission: SubmissionView; ended: boolean; audioBlocked: boolean; error: string; canStart: boolean; checking: boolean;
};
export type CallEvent = {type:'ready'|'participant_ready'|'audio'|'blocked'|'reconnecting'|'reconnected'|'participant_lost'|'disconnected'|'thinking'|'speaking'|'listening'|'lookup'|'speech_error'};
export type Microphone = {stop:()=>void; stream?: MediaStream};
export type Connection = {callId:string;token:string;serverUrl:string};
type Media = {stop:()=>void;enableAudio:()=>Promise<void>};
type Status = {callId:string;ended:boolean;ready?:boolean;event?:string;submission:SubmissionView};
type Ports = {
  acquire:()=>Promise<Microphone>; reference:()=>CallReference;
  read:()=>CallReference|null; write:(reference:CallReference)=>void;
  request:(path:string,body:unknown,reference:CallReference)=>Promise<unknown>;
  connect:(connection:Connection,microphone:Microphone,event:(event:CallEvent)=>void,signal:AbortSignal)=>Promise<Media>;
  schedule:(callback:()=>void,delay:number)=>()=>void;
};
export const CALL_COPY = {
  microphone:'Bitte erlauben Sie den Mikrofonzugriff für diese Website.',
  assistant:'Der Assistent ist gerade nicht erreichbar. Bitte starten Sie einen neuen Anruf.',
  speech:'Die Sprachverbindung funktioniert gerade nicht. Bitte starten Sie einen neuen Anruf.',
  unclear:'Wir können noch nicht bestätigen, ob Ihre Anfrage gespeichert wurde.',
};

/** Media lifetime and durable receipt recovery deliberately have separate state. */
export function createCallSession(ports: Ports, changed:(state:CallView)=>void) {
  let reference=ports.read(), generation=0, microphone:Microphone|undefined,media:Media|undefined;
  let mediaAbort = new AbortController(), refreshing=false;
  let ready=false, played=false, acceptLatchedReady=true, disposed=false, refreshId=0, lastEvent='', activeTimer=()=>{}, speechTimer=()=>{};
  const state:CallView={call:reference?'ended':'ready',submission:{state:reference?'unclear':'not_sent'},ended:!reference,audioBlocked:false,error:'',canStart:!reference,checking:false};
  function emit() {
    state.canStart=state.ended && !['saving','unclear'].includes(state.submission.state) && ['ready','ended'].includes(state.call);
    if (!disposed) changed({...state,submission:{...state.submission}});
  }
  function stopMedia() { activeTimer();speechTimer();mediaAbort.abort();media?.stop();microphone?.stop();media=undefined;microphone=undefined; }
  function applyStatus(result:Status) {
    if (result.callId !== reference?.callId) return;
    state.ended=result.ended;
    if (result.ended && !['ready','ended'].includes(state.call)) {
      stopMedia();
      state.call='ended';
    }
    if (state.submission.state !== 'saved') {
      const saved=result.submission?.receipt;
      if (result.submission?.state === 'saved' && (!saved || !saved.booking_id || saved.status !== 'created' || saved.booking_status !== 'requested' || saved.tentative !== true)) return;
      if (result.submission) state.submission=result.submission;
    }
    if (result.event && result.event !== lastEvent) {
      lastEvent=result.event;
      if (['ready','speech_error','lookup','thinking','listening','speaking'].includes(result.event)) event({type:result.event as CallEvent['type']});
    }
    if (result.ready) event({type:'ready'});
    if (state.submission.state === 'saving') speechTimer();
    emit();
  }
  async function refresh() {
    if (!reference || refreshing) return;
    refreshing=true;
    const current=reference, requestId=++refreshId;
    state.checking=true;emit();
    try {
      const result=await ports.request(`/api/calls/${current.callId}`,undefined,current) as Status;
      if (reference === current && requestId === refreshId) applyStatus(result);
    } catch { /* Preserve the last authoritative receipt and any uncertain outcome. */ }
    finally {refreshing=false;if(reference === current && requestId === refreshId){state.checking=false;emit();}}
  }
  async function end() {
    generation++;stopMedia();state.call='ended';state.audioBlocked=false;
    const current=reference;emit();
    if (!current) {state.ended=true;emit();return;}
    try {await ports.request(`/api/calls/${current.callId}`,{action:'end'},current);} catch { /* Status still reconciles independently. */ }
    if (current===reference) await refresh();
  }
  function fail(message:string) {state.error=message;void end();}
  function startupDeadline() {activeTimer();activeTimer=ports.schedule(()=>fail(CALL_COPY.assistant),30000);}
  function conversation() {
    if (!ready || !played || state.call==='ended') return;
    activeTimer();state.call='conversation';state.audioBlocked=false;emit();
  }
  function event(value:CallEvent) {
    if (disposed || ['ended','ready','permission'].includes(state.call)) return;
    switch(value.type) {
      case 'ready':if(acceptLatchedReady)ready=true;conversation();break;
      case 'participant_ready':ready=true;acceptLatchedReady=true;conversation();break;
      case 'audio':played=true;state.audioBlocked=false;speechTimer();conversation();break;
      case 'blocked':state.audioBlocked=true;activeTimer();speechTimer();break;
      case 'lookup':case 'listening':case 'speaking':speechTimer();break;
      case 'thinking':
        speechTimer();
        if (!state.audioBlocked && !['saving','unclear'].includes(state.submission.state)) speechTimer=ports.schedule(()=>{
          speechTimer=ports.schedule(()=>fail(CALL_COPY.speech),15000);
        },15000);
        break;
      case 'reconnecting':state.call='reconnecting';activeTimer();activeTimer=ports.schedule(()=>fail(CALL_COPY.assistant),10000);break;
      case 'reconnected':state.call='starting';conversation();break;
      case 'participant_lost':ready=played=false;acceptLatchedReady=false;state.call='reconnecting';activeTimer();activeTimer=ports.schedule(()=>fail(CALL_COPY.assistant),10000);break;
      case 'disconnected':void end();break;
      case 'speech_error':fail(CALL_COPY.speech);break;
    }
    emit();
  }
  async function start(phone?:string) {
    if (!state.canStart) return;
    const currentGeneration=++generation;
    state.call='permission';state.error='';state.audioBlocked=false;emit();
    try {
      const acquired=await ports.acquire();
      if (generation!==currentGeneration) {acquired.stop();return;}
      microphone=acquired;
      const current=ports.reference();
      // Persist before any network work. A storage failure must prevent dispatch.
      ports.write(current);reference=current;refreshId++;
      state.ended=false;state.submission={state:'not_sent'};state.call='connecting';ready=played=false;acceptLatchedReady=true;lastEvent='';emit();
      let connection:Connection|undefined;
      for(let attempt=0;attempt<2;attempt++) {
        try {connection=await ports.request('/api/calls',{callId:current.callId,...(phone?{phone}:{})},current) as Connection;break;}
        catch(error) {if(generation!==currentGeneration)return;const status=(error as {status?:number}).status;if(attempt===1 || (status && status<500))throw error;}
      }
      if (generation!==currentGeneration) return;
      if (!connection || connection.callId!==current.callId || !connection.token || !connection.serverUrl) throw new Error('Invalid connection');
      mediaAbort=new AbortController();
      const connected=await ports.connect(connection,acquired,e=>{if(generation===currentGeneration)event(e);},mediaAbort.signal);
      if (generation!==currentGeneration) {connected.stop();return;}
      media=connected;state.call='starting';if(!state.audioBlocked)startupDeadline();conversation();emit();void refresh();
    } catch(error) {
      if(generation!==currentGeneration)return;
      state.error=(error as {name?:string}).name==='NotAllowedError'?CALL_COPY.microphone:CALL_COPY.assistant;
      await end();
    }
  }
  emit();
  return {
    start,end,refresh,
    recover:async()=>{if(reference)await end();},
    async enableAudio() {try{await media?.enableAudio();state.audioBlocked=false;if(state.call==='starting')startupDeadline();emit();}catch{state.audioBlocked=true;emit();}},
    dispose() {disposed=true;void end();},
  };
}
