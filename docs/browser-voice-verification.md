# Browser voice and durable receipt verification

Verified on 2026-09-21 with a disposable PocketBase database, Firefox on loopback, a local `client-call-agent` worker, and the configured LiveKit project. All spoken customer details were fictional.

## Verified path

1. Firefox granted microphone access before call creation.
2. The caller server created a fresh `yoshida-<uuid>` room and dispatched only `client-call-agent`.
3. The worker joined with its scoped call attributes, published German speech through `cartesia/sonic-3.5`, and the browser changed from **Assistent startet** to **Im Gespräch** only after LiveKit reported successful playback of that agent track.
4. German STT captured the synthetic cleaning request. The agent ran `suggest_cleaner`, obtained explicit caller approval, and ran `create_booking` with the server-assigned submission identity.
5. The browser showed **Anfrage gespeichert** with booking `1yiowbkdmrx29rz`.
6. The same receipt remained authoritative after hangup, a browser reload, and a real caller-server process restart using the same private call ledger.
7. An independent authenticated PocketBase read returned the same booking ID with `requested` status, `regular_cleaning`, Berlin, and the configured synthetic cleaner.

The standalone German TTS probe also returned 23 nonempty frames and 169,440 PCM bytes before the supervised call.

## Controlled failure evidence

Automated tests cover cancellation while microphone permission or dispatch is pending, concurrent starts, lost dispatch responses, late connects after hangup, missing worker/audio deadlines, autoplay blocking, reconnect deadlines, bounded lookup and speech timeouts, interrupted save responses, `404` receipt lookups that remain unclear, fixed-payload retries, private browser/worker capabilities, and receipt recovery after process restart.

The supervised run proves one local synthetic path. It does not establish production availability, transcription accuracy, public endpoint safety, real-person consent, or provider retention terms.
