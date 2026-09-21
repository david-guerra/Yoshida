import { ParticipantKind, Room, RoomEvent, Track, TrackEvent, RemoteAudioTrack, type RemoteParticipant } from 'livekit-client';
import type { CallEvent, Connection, Microphone } from './call-session';

type ParticipantKindView = Pick<RemoteParticipant,'kind'>;

export function createRoomEventHandlers(intended:(participant:ParticipantKindView)=>boolean,notify:(event:CallEvent)=>void) {
  return {
    audioPlaybackStatusChanged(playing:boolean) {if(!playing)notify({type:'blocked'});},
    activeSpeakersChanged(participants:ParticipantKindView[]) {if(participants.some(intended))notify({type:'speaking'});},
    participantDisconnected(participant:ParticipantKindView) {if(intended(participant))notify({type:'participant_lost'});},
  };
}

/** Attach only the intended worker's speech and report the SDK's successful playback signal. */
export async function connectCall(connection:Connection,microphone:Microphone,event:(event:CallEvent)=>void,signal:AbortSignal) {
  const room=new Room();
  let stopped=false;
  const outputs=new Map<string,{element:HTMLMediaElement;track:RemoteAudioTrack;started:()=>void;failed:()=>void}>();
  // Every call has its own server-generated room and token. Participant kind,
  // rather than display-name heuristics, identifies the intended worker there.
  const intended=(participant:ParticipantKindView)=>participant.kind===ParticipantKind.AGENT;
  const notify=(value:CallEvent)=>{if(!stopped)event(value);};
  const handlers=createRoomEventHandlers(intended,notify);
  const stop=()=>{
    if(stopped)return;stopped=true;
    signal.removeEventListener('abort',stop);
    microphone.stop();
    for(const output of outputs.values()){
      output.track.off(TrackEvent.AudioPlaybackStarted,output.started);
      output.track.off(TrackEvent.AudioPlaybackFailed,output.failed);
      output.element.pause();output.track.detach(output.element);output.element.remove();
    }
    outputs.clear();void room.disconnect();
  };
  function inspect(participant:RemoteParticipant) {
    if(!intended(participant))return;
    if(participant.attributes['yoshida.ready']==='true')notify({type:'participant_ready'});
    if(participant.attributes['yoshida.error']==='speech_error')notify({type:'speech_error'});
    const state=participant.attributes['yoshida.state'] || participant.attributes['lk.agent.state'];
    if(state==='thinking'||state==='listening'||state==='speaking')notify({type:state});
    for(const publication of participant.audioTrackPublications.values()) {
      const track=publication.audioTrack;
      if(!(track instanceof RemoteAudioTrack) || outputs.has(publication.trackSid))continue;
      const started=()=>notify({type:'audio'});
      const failed=()=>notify({type:'blocked'});
      track.on(TrackEvent.AudioPlaybackStarted,started);
      track.on(TrackEvent.AudioPlaybackFailed,failed);
      const element=track.attach();element.hidden=true;document.body.appendChild(element);
      outputs.set(publication.trackSid,{element,track,started,failed});
    }
  }
  room.on(RoomEvent.TrackSubscribed,(_track,_publication,participant)=>inspect(participant));
  room.on(RoomEvent.ParticipantConnected,inspect);
  room.on(RoomEvent.ParticipantDisconnected,handlers.participantDisconnected);
  room.on(RoomEvent.ParticipantAttributesChanged,(_attributes,participant)=>{
    if(participant instanceof Object && participant.identity!=='caller')inspect(participant as RemoteParticipant);
  });
  room.on(RoomEvent.TrackUnsubscribed,(track,publication)=>{
    const output=outputs.get(publication.trackSid);
    if(output){
      output.track.off(TrackEvent.AudioPlaybackStarted,output.started);
      output.track.off(TrackEvent.AudioPlaybackFailed,output.failed);
      output.element.pause();track.detach(output.element);output.element.remove();outputs.delete(publication.trackSid);
    }
  });
  room.on(RoomEvent.AudioPlaybackStatusChanged,handlers.audioPlaybackStatusChanged);
  room.on(RoomEvent.ActiveSpeakersChanged,handlers.activeSpeakersChanged);
  room.on(RoomEvent.Reconnecting,()=>notify({type:'reconnecting'}));
  room.on(RoomEvent.SignalReconnecting,()=>notify({type:'reconnecting'}));
  room.on(RoomEvent.Reconnected,()=>notify({type:'reconnected'}));
  room.on(RoomEvent.Disconnected,()=>notify({type:'disconnected'}));
  signal.addEventListener('abort',stop,{once:true});
  if(signal.aborted){stop();throw new Error('Call cancelled');}
  try {
    await room.connect(connection.serverUrl,connection.token,{autoSubscribe:true,maxRetries:0});
    if(stopped)throw new Error('Call cancelled');
    const track=microphone.stream?.getAudioTracks()[0];
    if(!track)throw new Error('Microphone unavailable');
    await room.localParticipant.publishTrack(track,{source:Track.Source.Microphone});
    for(const participant of room.remoteParticipants.values())inspect(participant);
    if(stopped)throw new Error('Call cancelled');
    return {stop,enableAudio:async()=>{await room.startAudio();if(outputs.size)notify({type:'audio'});}};
  } catch(error){stop();throw error;}
}
