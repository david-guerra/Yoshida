'use client';

import Link from 'next/link';
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
    <>
      <a className="skip-link" href="#call">Zum Anruf</a>
      <header className="caller-header"><Link className="caller-brand" href="/" aria-label="Yoshida Startseite"><span aria-hidden="true">y</span>yoshida</Link><p>Deutsch · Browseranruf mit KI-Assistent</p></header>
      <main className="caller-layout">
        <section className="caller-intro"><h1>Eine Reinigung.<br />Ein Gespräch.</h1><p>Teilen Sie uns mit, wann und wo Sie Unterstützung brauchen. Die Reinigungskraft prüft anschließend Ihre Anfrage.</p><p className="muted">Bitte halten Sie Adresse, Termin und gewünschte Dauer bereit.</p></section>
        <div>
          <section id="call" tabIndex={-1} aria-label="Anruf" className="call-panel">
            <div className={`voice-mark ${active ? 'active' : ''}`} aria-hidden="true">{active ? '≋' : '◌'}</div>
            <h2 role="status">{labels[state.call]}</h2>
            {state.call==='ready'&&<p>Starten Sie einen Anruf und erzählen Sie uns von Ihrem Reinigungswunsch.</p>}
            {state.call==='permission'&&<p>Bitte erlauben Sie den Mikrofonzugriff im Browser. Sie können jederzeit abbrechen.</p>}
            {['connecting','starting'].includes(state.call)&&<p>Wir bereiten das Gespräch vor. Bitte warten Sie einen Moment.</p>}
            {state.call==='conversation'&&<p>Der Assistent hört Ihnen zu. Prüfen Sie Ihre Angaben im Gespräch, bevor die Anfrage gesendet wird.</p>}
            {state.call==='reconnecting'&&<p>Die Verbindung ist unterbrochen. Wir versuchen, sie wiederherzustellen.</p>}
            {state.call==='ended'&&<p>Das Gespräch ist beendet. Den Speicherstatus Ihrer Anfrage sehen Sie unten.</p>}
            <div className="call-actions">
              <button className="primary" disabled={!state.canStart} onClick={()=>void session.current?.start()}>{state.call==='ready'?'Anruf starten':'Neuen Anruf starten'}</button>
              {(active||!state.ended)&&<button className="danger" onClick={()=>void session.current?.end()}>{state.call==='permission'?'Abbrechen':'Auflegen'}</button>}
              {state.audioBlocked&&<button className="primary" onClick={()=>void session.current?.enableAudio()}>Audio aktivieren</button>}
            </div>
            {state.error&&<p role="alert" className="call-error">{state.error}</p>}
            <section aria-label="Ihre Anfrage" aria-live="polite" aria-atomic="true" className={`call-receipt ${state.submission.state==='saved'?'saved':unresolved?'unclear':''}`}>
              <h3>{state.submission.state==='saved'?'Anfrage gespeichert':state.submission.state==='saving'?'Anfrage wird gespeichert':unresolved?'Speicherstatus unklar':'Ihre Anfrage'}</h3>
              {state.submission.state==='saved'?<><p>Ihre Anfrage wurde gespeichert. Die Reinigungskraft muss sie noch bestätigen.</p><p><strong>Anfragenummer: {state.submission.receipt?.booking_id}</strong></p></>:state.submission.state==='rejected'?<p>Ihre Anfrage wurde nicht gespeichert. Bitte prüfen Sie die Angaben im Gespräch.</p>:unresolved?<p>{CALL_COPY.unclear}</p>:<p>Ihre Anfrage wurde noch nicht gesendet.</p>}
              {(unresolved||!state.ended)&&<button disabled={state.checking} onClick={()=>void session.current?.refresh()}>Status prüfen</button>}
              {unresolved&&<p>Bitte prüfen Sie diese Anfrage, bevor Sie einen neuen Anruf starten. Der Status bleibt auch nach dem Auflegen und Neuladen in diesem Tab verfügbar.</p>}
            </section>
          </section>
        </div>
      </main>
      <footer className="caller-footer">Lokale Demonstration mit fiktiven Kontaktdaten. Yoshida von David Guerra, lishiiChan und younaorg.</footer>
    </>
  );
}
