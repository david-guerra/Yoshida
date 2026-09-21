import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { createCallService } from './call-service';

let service: ReturnType<typeof createCallService> | undefined;

/** One configured server owns tokens, dispatch, and scoped receipt recovery. */
export function callService() {
  if (service) return service;
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const serverUrl = (process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL)?.trim();
  if (!apiKey || !apiSecret || !serverUrl) throw new Error('Missing LiveKit configuration');
  const endpoint = new URL(serverUrl);
  if (!['wss:','ws:'].includes(endpoint.protocol)) throw new Error('Invalid LiveKit endpoint');
  endpoint.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:';
  const callServerUrl = process.env.CALL_SERVER_URL?.trim() || 'http://127.0.0.1:3000';
  const local = new URL(callServerUrl);
  if (local.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(local.hostname)) throw new Error('Call server must be loopback');
  const dispatch = new AgentDispatchClient(endpoint.toString(),apiKey,apiSecret,{requestTimeout:8});
  const rooms = new RoomServiceClient(endpoint.toString(),apiKey,apiSecret,{requestTimeout:8});
  const backendUrl = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/,'');
  service = createCallService({
    databasePath:process.env.CALL_DATABASE_PATH?.trim() || '.call-data/calls.sqlite',
    serverUrl,callServerUrl,callerPhone:process.env.SIMULATED_CALLER_PHONE?.trim() || '+12025550102',
    listDispatch: room => dispatch.listDispatch(room),
    createDispatch: (room,metadata) => dispatch.createDispatch(room,'client-call-agent',{metadata:JSON.stringify(metadata)}),
    deleteRoom: room => rooms.deleteRoom(room),
    mintToken: async (room,metadata) => {
      const token = new AccessToken(apiKey,apiSecret,{identity:'caller',ttl:'15m',metadata:JSON.stringify(metadata),attributes:{'caller.phone':metadata.caller_phone}});
      token.addGrant({room,roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:false,canUpdateOwnMetadata:false});
      return token.toJwt();
    },
    backend:(path,init)=>fetch(`${backendUrl}${path}`,init),
  });
  return service;
}
