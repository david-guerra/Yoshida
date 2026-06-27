import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const tokenRouteSource = readFileSync(
  new URL("../app/api/token/route.ts", import.meta.url),
  "utf8",
);
const dispatchRouteSource = readFileSync(
  new URL("../app/api/dispatch/route.ts", import.meta.url),
  "utf8",
);
const dispatchHelperSource = readFileSync(
  new URL("../lib/livekit-dispatch.ts", import.meta.url),
  "utf8",
);
const serviceWorkerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("caller page joins demo-call as the caller with audio-only LiveKit media", () => {
  assert.match(pageSource, /const ROOM_NAME = "demo-call"/);
  assert.match(pageSource, /const CALLER_IDENTITY = "caller"/);
  assert.doesNotMatch(pageSource, /Math\.random/);
  assert.match(pageSource, /<LiveKitRoom[\s\S]*audio[\s\S]*video=\{false\}/);
  assert.match(pageSource, /<RoomAudioRenderer \/>/);
});

test("caller page renders agent presence from room participants", () => {
  assert.match(pageSource, /useRemoteParticipants/);
  assert.match(pageSource, /agent/i);
  assert.match(pageSource, /remoteParticipants\.find/);
  assert.match(pageSource, /remoteParticipants\.length === 1/);
});

test("caller page shows speaking indicators for caller and agent audio", () => {
  assert.match(pageSource, /useIsSpeaking/);
  assert.match(pageSource, /<SpeakingIndicator[\s\S]*participant=\{localParticipant\}/);
  assert.match(pageSource, /activeClassName="bg-emerald-500/);
  assert.match(pageSource, /activeClassName="bg-sky-500/);
});

test("caller page does not dispatch the agent again after the room connects", () => {
  assert.doesNotMatch(pageSource, /dispatchAgentAfterConnect/);
  assert.doesNotMatch(pageSource, /fetch\("\/api\/dispatch"/);
  assert.match(pageSource, /onConnected=\{handleConnected\}/);
});

test("caller page handles microphone permission before connecting the LiveKit room", () => {
  assert.match(pageSource, /navigator\.mediaDevices\.getUserMedia\(\{\s*audio:\s*true/);
  assert.match(pageSource, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.ok(
    pageSource.indexOf("ensureMicrophonePermission()") < pageSource.indexOf("fetch("),
    "microphone permission should be checked before requesting a token",
  );
  assert.match(pageSource, /onMediaDeviceFailure/);
  assert.match(pageSource, /Microphone permission is blocked/);
});

test("token route mints a scoped room token that can publish mic audio and subscribe", () => {
  assert.match(tokenRouteSource, /new AccessToken/);
  assert.match(tokenRouteSource, /roomJoin:\s*true/);
  assert.match(tokenRouteSource, /canPublish:\s*true/);
  assert.match(tokenRouteSource, /canSubscribe:\s*true/);
  assert.match(tokenRouteSource, /LIVEKIT_API_KEY/);
  assert.match(tokenRouteSource, /LIVEKIT_API_SECRET/);
});

test("token route explicitly dispatches the named voice agent into the demo room", () => {
  assert.match(
    tokenRouteSource,
    /dispatchAgent\(\{\s*room,\s*liveKitUrl,\s*apiKey,\s*apiSecret,\s*callerPhone/s,
  );
});

test("token route and dispatch metadata include the simulated caller phone", () => {
  assert.match(tokenRouteSource, /SIMULATED_CALLER_PHONE/);
  assert.match(tokenRouteSource, /const callerPhone/);
  assert.match(tokenRouteSource, /metadata:\s*JSON\.stringify\(\{[\s\S]*caller_phone:\s*callerPhone/);
  assert.match(tokenRouteSource, /"caller.phone":\s*callerPhone/);
  assert.match(dispatchHelperSource, /callerPhone:\s*string/);
  assert.match(dispatchHelperSource, /caller_phone:\s*callerPhone/);
});

test("dispatch helper explicitly dispatches the named voice agent into the demo room", () => {
  assert.match(dispatchHelperSource, /const AGENT_NAME = "client-call-agent"/);
  assert.match(dispatchHelperSource, /createDispatch\(room,\s*AGENT_NAME/);
  assert.match(dispatchHelperSource, /liveKitHttpUrl/);
});

test("dispatch helper does not reuse or delete stale dispatch records", () => {
  assert.doesNotMatch(dispatchHelperSource, /listDispatch/);
  assert.doesNotMatch(dispatchHelperSource, /deleteDispatch/);
  assert.doesNotMatch(dispatchHelperSource, /dispatchHasActiveJob/);
});

test("dispatch route dispatches the agent server-side without exposing secrets", () => {
  assert.match(dispatchRouteSource, /POST/);
  assert.match(dispatchRouteSource, /dispatchAgent/);
  assert.match(dispatchRouteSource, /LIVEKIT_API_KEY/);
  assert.match(dispatchRouteSource, /LIVEKIT_API_SECRET/);
  assert.doesNotMatch(pageSource, /LIVEKIT_API_SECRET/);
});

test("stale localhost service workers unregister instead of reloading Firefox forever", () => {
  assert.match(serviceWorkerSource, /registration\.unregister\(\)/);
  assert.match(serviceWorkerSource, /client\.navigate\(client\.url\)/);
});
