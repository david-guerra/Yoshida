# Yoshida showcase: gallery and media decision

This portfolio guide shows recruiters and hiring reviewers the synthetic local voice-agent prototype. The browser caller simulates the intended phone entry point; no telephone integration exists yet. The [integrated acceptance record](integrated-acceptance-verification.md) documents the spoken calls and persisted checks; these still images establish only what the running application rendered. All names, addresses, phone numbers, and appointments shown are fictional.

## Application gallery

The cleaner dashboard displays the requests produced by the voice agent. The browser view below is the local call simulator used to exercise that agent.

### Persisted owner decisions from the spoken calls

![Cleaner Upcoming tab showing Tom Beispiel's confirmed appointment](media/cleaner-confirmed.jpg)

![Cleaner History tab showing David Beispiel's declined request and budget warning](media/cleaner-declined.jpg)

These two records are copies of the verified fictional German calls in [#40's run](integrated-acceptance-verification.md#fresh-live-german-browser-run): `zhwevpk3x2cayoh` was confirmed and `8pgqd6bsb7rvphl` was declined by the owner. The gallery shows their persisted dashboard states after the calls, not the action being clicked live. The €21 budget was below the configured €50 minimum but did not reject the request automatically.

### English cleaner: tentative inbox and review

![Cleaner Requests inbox with one fictional booking that needs review](media/cleaner-requests.jpg)

![Cleaner review drawer with the tentative appointment, full address, unknown budget, and unknown price](media/cleaner-review.jpg)

![Lower part of the cleaner review drawer with the tentative request's Decline and Confirm controls](media/cleaner-decision-controls.jpg)

The `Mara Beispiel` request was **staged through the real manual form and backend** on a disposable copy of the acceptance database. It is a persisted tentative request, not the result of a voice call. The two review images show different scroll positions of the same drawer; no decision was taken on this staged record.

### German browser call simulator: original tentative receipt

![German Yoshida caller after hang-up, showing the original tentative receipt for a saved request](media/caller-receipt.jpg)

This current simulator UI was reconstructed on 23 September 2026 from a **copy** of [#40 call A's](integrated-acceptance-verification.md#fresh-live-german-browser-run) saved ledger and PocketBase database. Its browser capability was reissued only in the disposable copy so the actual saved receipt `zhwevpk3x2cayoh` could be displayed again. The receipt remains tentative by design even though the owner later confirmed that booking. This is not a contemporaneous recording of the spoken call. No new provider call was made for this image.

### Narrow view

![375 pixel wide Yoshida cleaner Requests inbox with a fictional tentative booking](media/cleaner-mobile.jpg)

The same staged manual request at 375×812 shows the running mobile layout. The formal accessibility observations and remaining gaps are in the [acceptance record](integrated-acceptance-verification.md#demo-acceptance-and-formal-limits).

## Media decision

| Criterion | Captioned short video | Static app gallery | Hosted synthetic demo |
| --- | --- | --- | --- |
| Clarity | Shows German speech and handoff in one minute, with cuts marked. | Shows exact saved UI states; cannot establish speech or realtime arrival. | Lets reviewers explore the flow themselves. |
| Reviewer effort | Watch 45–60 seconds and read captions. | Scan images and captions, with links to evidence. | Start a call and follow a longer interactive flow. |
| Upkeep | Rerecord and recaption after flow changes. | Recapture images after UI changes. | Operate and monitor a live service. |
| Cost | Provider use, recording, editing, and captioning. | Low one-time capture and repository storage. | Hosting, operations, and speech providers. |
| Accessibility | Requires accurate captions and transcript. | Alt text and adjacent explanations; no audio barrier. | Needs tested keyboard, screen-reader, and audio paths. |
| Privacy | Recording a participant's voice needs consent and a retention plan; staged synthetic audio could avoid real participant voice. | Fictional screenshots expose no participant voice. | Public entry needs admission controls, isolation, and data handling. |
| Provider dependence | A truthful fresh voice call uses configured inference providers. | Viewers need no provider or running server. | Interactive calls depend on external speech providers. |

**Choice for #44: publish the static gallery now.** It uses only fictional data and links each visible state to its provenance. There is no hosted demo or public caller invitation. A hosted option would first need a separate proposal and verified implementation with an owner, budget, admission model, isolation and abuse controls, data handling, and negative tests under [#32](https://github.com/david-guerra/Yoshida/issues/32). Public deployment is outside this ticket.

The original [recruiter video follow-up #45](https://github.com/david-guerra/Yoshida/issues/45) was gated on the remaining [#40 integrated demo tests](https://github.com/david-guerra/Yoshida/issues/40). Its brief called for a **captioned 45–60 second video** of a new fictional call in the real local app: the German browser simulator starting the request, an edited conversation with spoken approval, a saved *tentative* receipt, matching English cleaner review and decision, and the persisted tab after reload. It also called for backend verification of the new booking ID, captions, a transcript, and clear labels for cuts or reconstruction. Old screenshots must not appear as footage of live speech.

### Silent illustrated video

[Open or download the 58-second silent video](https://github.com/david-guerra/Yoshida/raw/refs/heads/main/docs/media/yoshida-silent-demo.mp4) · [Download timed text (WebVTT)](media/yoshida-silent-demo.vtt)

This alternate #45 deliverable uses animated subtitles and an animated cleaner dashboard instead of a participant voice or a new provider call. It can be shared while #40 remains open, as a **visual explanation of the previously verified local flow**. Most of the film shows an illustrative reconstruction of the cleaner app: a tentative booking arriving in Needs review, the review drawer opening, the cleaner confirming it, and the appointment appearing in Upcoming and Schedule. The browser simulator is mentioned only as the current source of the fictional call; it is not presented as the product's long-term calling interface. The final Upcoming screen is an actual app capture made from a disposable copy of the verified #40 fictional data. That capture is not contemporaneous footage of the call or owner click. The film has no audio track and does not claim to demonstrate speech quality, a new live call, a fresh booking, or the unfinished strict #40 checks.

The on-screen subtitles and WebVTT describe the booking's arrival and cleaner decision, using data from [#40's independently checked call A](integrated-acceptance-verification.md#fresh-live-german-browser-run), receipt `zhwevpk3x2cayoh`. They are narrative text, not a transcript of spoken words. The [browser stage](../scripts/showcase-video/index.html) and [renderer](../scripts/render_showcase_video.cjs) define the scenes and timing. To regenerate, run `npm --prefix scripts install`, `npm --prefix scripts exec -- playwright install chromium`, then `node scripts/render_showcase_video.cjs` with `ffmpeg` on the path. The renderer also accepts `--preview 11,32,51` to save sample frames in `/tmp`.

The original #45 description above still calls for a newly captured spoken call and a reload shot. This illustrative video does not satisfy those original acceptance points. Treat the video as the user-requested silent alternative; changing or closing that issue requires the ticket's criteria to be updated separately.

## Verification

The seven screenshots were taken from the current production frontend builds at 1280×720 and 375×812 against a **disposable copy** of the accepted #40 synthetic data; the manual tentative record was saved through the dashboard in that copy. The original acceptance data and environment were not edited. The temporary browser bootstrap and all loopback servers were removed or stopped after capture. Neither those images nor the later silent video contain the private ledger, passwords, tokens, logs, or call recordings.

On 23 September 2026, a separate local Git clone of source commit `064e71f` was checked with Node.js **24.19.0**, Python **3.12.13**, uv **0.11.28**, and PocketBase **0.39.4** on macOS. The documentation and gallery edits in this ticket were checked in the working tree, because the clone was made before their commit. Both `npm ci` commands succeeded using the local npm cache; `uv sync --frozen --dev --python 3.12` downloaded and installed the locked agent dependencies. The documented no-worker launcher started a new synthetic PocketBase, caller and dashboard on unused loopback ports, reported `worker_started: false`, and shut down cleanly. No speech provider was contacted.

| Fresh-clone check | Result |
| --- | --- |
| Dashboard tests, lint, webpack production build/typecheck | 52 passed; lint and build passed |
| Caller tests, lint, webpack production build/typecheck | 26 passed; lint and build passed |
| Agent pytest, Ruff lint and format | 80 passed, 3 opt-in model checks skipped; Ruff passed |
| PocketBase JavaScript and disposable HTTP suites | 9 and 13 passed |
| Python compile of setup, launcher and verifier | Passed |
| Launcher integration suite | First full run: 2 of 3 passed; one teardown hit a managed-host `killpg` permission error after its UI checks. A focused rerun of the two launcher tests passed. The process-cleanup test had passed in the full run. |

The default Turbopack production build failed in this managed shell while trying to bind an internal port (`Operation not permitted`). Both frontends then built and typechecked with the documented `--webpack` fallback. This is a host restriction, not a successful default-build result. The [#46 PR CI run](https://github.com/david-guerra/Yoshida/actions/runs/36025326740) passed all four jobs on 24 September 2026, and [main CI after the merge](https://github.com/david-guerra/Yoshida/actions/runs/36025477220) also passed. Those GitHub runs include the default frontend builds.

The previous [#40 run](integrated-acceptance-verification.md#automated-evidence) remains separate speech and persistence evidence; these fresh-clone checks did not repeat a live call.

The repository's GitHub description and topics were checked against this scope; no change was needed. The former pre-rename dashboard image was removed. The new JPEGs contain no EXIF, IPTC, or XMP metadata, and the checked-in documentation and media contain no private credentials or call recordings.
