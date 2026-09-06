# Third-party notices and service dependencies

Yoshida team code is licensed under the root MIT license. Preserve the separately scoped notices below. This inventory distinguishes source licenses from hosted-service and model terms; it does not grant rights to provider voices or model weights.

| Component | Provenance / terms | Scope and review |
| --- | --- | --- |
| Python agent scaffold | [LiveKit agent-starter-python MIT license](https://github.com/livekit-examples/agent-starter-python/blob/main/LICENSE), copyright 2025 LiveKit, Inc. | The full notice is retained in `licenses/livekit-agent-starter-MIT.txt`. Yoshida modifies the scaffold's agent and prompt. |
| Next.js frontends | [Next.js MIT license](https://github.com/vercel/next.js/blob/canary/license.md) | Created from Next.js scaffolds. Dependency notices stay with their packages; unused starter SVGs are removed. |
| LiveKit SDKs | [LiveKit Agents](https://github.com/livekit/agents) and installed package notices | SDK code licenses do not extend to all models, voices, or cloud services. |
| PocketBase runtime | [PocketBase MIT license](https://github.com/pocketbase/pocketbase/blob/master/LICENSE.md) | Binary and local data are excluded. Setup was exercised with version 0.39.4. Download it from the official project and retain its bundled notice. |
| LiveKit Cloud / Inference | [LiveKit terms](https://livekit.com/legal/terms-of-service) | Use your own authorized account. Third-party services and models remain subject to their terms. No subscription, usage credit, or permission for real caller data is supplied by this repository. |
| Speech and language models | Deepgram Nova-3, configurable LLM (currently DeepSeek), ElevenLabs Flash v2.5, LiveKit turn detection | Refer to the configured provider/account terms and model availability before live use. An optional voice ID must be a voice you are authorized to use. No model weights or recordings are redistributed here. |
| ai-coustics enhancement | [ai-coustics SDK documentation](https://docs.ai-coustics.com/) and the installed plugin's terms | Native enhancement/model licensing is separate from this project's MIT license. Confirm the applicable LiveKit integration entitlement for the pinned plugin before running a live call. |
| Design mockup | Team-approved fictional hackathon references | Publication and fictional data confirmed by David on 2026-09-05. These are concepts, not application screenshots; no product affiliation or trademark rights are implied. |

The upstream starter's MIT notice was retrieved and verified on 2026-09-05 (Git blob `a5acd058b0b077e649504931b695eb759f0f7550`). npm lockfiles include dependency license metadata; Python package notices ship in the installed distributions. A complete binary redistribution review has not been performed because no runtime binary, model, or dependency tree is distributed in this repository.

Example phone identities use [NANPA's reserved fictional 555-0100–0199 block](https://nanpa.com/numbering/555-line-numbers); `example.test` email addresses are synthetic. They must not be used to contact a person.
