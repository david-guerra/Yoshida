'use client';

import { useEffect, useRef, useState } from 'react';
import { createCallSession, CALL_COPY, type CallReference, type CallView } from '@/lib/call-session';
import { connectCall } from '@/lib/livekit-browser';

const STORAGE_KEY='yoshida.call.v1';
const labels:Record<CallView['call'],string>={ready:'Bereit',permission:'Mikrofon freigeben',connecting:'Verbindung wird aufgebaut',starting:'Assistent startet',conversation:'Im Gespräch',reconnecting:'Verbindung wird wiederhergestellt',ended:'Gespräch beendet'};
const initial:CallView={call:'ready',submission:{state:'not_sent'},ended:true,audioBlocked:false,error:'',canStart:false,checking:false};

export default function Home() {
  const [state,setState]=useState(initial);
  const session=useRef<ReturnType<typeof createCallSession>|null>(null);
  useEffect(()=>{
    let recovery:CallReference|null=null;
    try {
      const value=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');
      if(value && typeof value.callId==='string' && typeof value.token==='string')recovery=value;
    } catch {queueMicrotask(()=>setState({...initial,error:'Der gespeicherte Anruf konnte nicht gelesen werden. Bitte prüfen Sie die Browsereinstellungen.'}));return;}
    const controller=createCallSession({
      read:()=>recovery,
      write:reference=>sessionStorage.setItem(STORAGE_KEY,JSON.stringify(reference)),
      reference:()=>({callId:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')}),
      acquire:async()=>{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
        return {stream,stop:()=>stream.getTracks().forEach(track=>track.stop())};
      },
      request:async(path,body,reference)=>{
        const response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${reference.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),cache:'no-store',keepalive:!!body});
        if(!response.ok)throw Object.assign(new Error('Call request failed'),{status:response.status});
        return response.json();
      },
      connect:connectCall,
      schedule:(callback,delay)=>{const timer=setTimeout(callback,delay);return ()=>clearTimeout(timer);},
    },setState);
    session.current=controller;void controller.recover();
    const timer=setInterval(()=>void controller.refresh(),1500);
    const unload=()=>controller.dispose();window.addEventListener('pagehide',unload);
    return ()=>{clearInterval(timer);window.removeEventListener('pagehide',unload);controller.dispose();session.current=null;};
  },[]);
  const unresolved=['saving','unclear'].includes(state.submission.state);
  const active=!['ready','ended'].includes(state.call);
  return (
    <main lang="de" className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-6 sm:p-12">
      <header><p className="mb-2 text-sm font-semibold tracking-widest">YOSHIDA</p><h1 className="text-4xl font-semibold leading-tight">Ihre Reinigung beginnt mit einem Gespräch.</h1><p className="mt-4 text-lg opacity-80">Beschreiben Sie Ihren Wunsch auf Deutsch. Die Reinigungskraft prüft Ihre Anfrage und entscheidet anschließend.</p></header>
      <section aria-label="Anruf" className="rounded-2xl border border-current/20 p-6">
        <p role="status" className="text-xl font-semibold">{labels[state.call]}</p>
        {state.call==='permission'&&<p className="mt-3">Bitte erlauben Sie den Mikrofonzugriff im Browser. Sie können jederzeit abbrechen.</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50" disabled={!state.canStart} onClick={()=>void session.current?.start()}>{state.call==='ready'?'Anruf starten':'Neuen Anruf starten'}</button>
          {(active||!state.ended)&&<button className="rounded-full border px-6 py-3 font-semibold" onClick={()=>void session.current?.end()}>{state.call==='permission'?'Abbrechen':'Auflegen'}</button>}
          {state.audioBlocked&&<button className="rounded-full bg-sky-700 px-6 py-3 font-semibold text-white" onClick={()=>void session.current?.enableAudio()}>Audio aktivieren</button>}
        </div>
        {state.error&&<p role="alert" className="mt-4 break-words">{state.error}</p>}
      </section>
      <section aria-label="Ihre Anfrage" aria-live="polite" aria-atomic="true" className="rounded-2xl border border-current/20 p-6">
        <h2 className="text-xl font-semibold">{state.submission.state==='saved'?'Anfrage gespeichert':state.submission.state==='saving'?'Anfrage wird gespeichert':unresolved?'Speicherstatus unklar':'Ihre Anfrage'}</h2>
        {state.submission.state==='saved'?<><p className="mt-3">Ihre Anfrage wurde gespeichert. Die Reinigungskraft muss sie noch bestätigen.</p><p className="mt-3 break-all font-semibold">Anfragenummer: {state.submission.receipt?.booking_id}</p></>:state.submission.state==='rejected'?<p className="mt-3">Ihre Anfrage wurde nicht gespeichert. Bitte prüfen Sie die Angaben im Gespräch.</p>:unresolved?<p className="mt-3">{CALL_COPY.unclear}</p>:<p className="mt-3">Ihre Anfrage wurde noch nicht gesendet.</p>}
        {(unresolved||!state.ended)&&<button className="mt-4 rounded-full border px-5 py-3 font-semibold disabled:opacity-50" disabled={state.checking} onClick={()=>void session.current?.refresh()}>Status prüfen</button>}
        {unresolved&&<p className="mt-3 text-sm">Bitte prüfen Sie diese Anfrage, bevor Sie einen neuen Anruf starten. Der Status bleibt auch nach dem Auflegen und Neuladen in diesem Tab verfügbar.</p>}
      </section>
      <p className="text-sm opacity-70">Lokale Demonstration mit fiktiven Kontaktdaten.</p>
    </main>
  );
}
