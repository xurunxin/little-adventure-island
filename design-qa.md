# Design and implementation QA — 2026-10-08

Historical snapshot. Later device fixes are documented in README.md. Evidence files remain local and are excluded from the public repository.

## Visual baseline

Selected source: `design/selected-home.png` (design 2). Same-size comparison: `evidence/design-comparison.png`, source on the left and running app on the right. Reviewed that comparison visually after implementation; the source is not used as a flattened interactive screen.

The implementation retains the large storybook on the left with three action pictures, task names, star values, a primary action and listening controls. The island, tree house, partner on the right, central star wallet, parent lock and four illustrated navigation items follow the selected composition. Background and portraits were generated as separate resources; React renders text/actions and Pixi renders the companion and effects.

Adjusted logo width, wallet proportions, book edge, task title/star sizing, speech bubble position and partner scale after comparison. Remaining differences are the regenerated artwork, idle expression, exact painted lettering and icon shapes (P3 aesthetic differences). No remaining actionable P0/P1/P2 visual issue was found in the reviewed screens.

## Responsive and interaction evidence

- Source comparison viewport: 1586×992. Tablet layout check: 1097×686 CSS pixels, derived from the target tablet's 1920×1200 / density 280. This is browser emulation, not a native tablet screenshot.
- `home-tablet-layout.png`: no horizontal overflow; principal task controls measured about 200×59 CSS pixels.
- `tasks-tablet-layout.png`, `task-detail-tablet-layout.png`, `rewards-tablet-layout.png`, `partner-tablet-layout.png`: task card/detail, scrollable reward shop, all ten growth decorations and four navigation entries inspected.
- All visible homepage images reported `complete=true` and nonzero natural dimensions.
- `preload-failure.png`: one blocked task picture kept the entire app behind the loading state at 98%; removing the block and retrying opened the island. The temporary block was removed.
- `partner-balance.png`: the reply matched the real local 18-star fixture balance.
- `partner-voice-chain.png`, `browser-voice-chain.json`: a bundled generated clip supplied a temporary synthetic microphone stream; the UI completed real ASR → LLM → TTS. The synthetic stream was removed afterward. Physical microphone recognition is still unverified.
- `task-crop.png`, `custom-task.png`, `custom-task-restored.png`: real generated illustration, crop, generated narration, save/export/restore, 640×640 image decoded successfully. `browser-custom-backup.json` confirms custom media, balance and conversation preference survived; no API key was included.

## Validation limits

31 business/security/data tests and 4 existing Sites packaging tests passed. Production TypeScript/Vite compilation passed. Android personal release and separate QA/test APK compilation passed; final rebuilt APK is audited separately in `evidence/apk-audit.json`.

Production preview ignored `?design=1` and displayed companion selection, rather than the memory fixture. Final APK: 25,916,241 bytes; APK Signature Scheme v2 verified with one 3072-bit RSA release signer. All 35 bundled audio hashes match the mmx generation manifest. No development fixture or plaintext environment API key was found in decompressed APK entries. The APK was copied to the tablet's Download folder and its SHA256 matched the PC copy (`evidence/apk-delivery.json`). Copying the package does not imply installation.

The connected tablet rejected the attempted installation with `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`. USB install permission is awaiting device-owner action. Native SQLite behavior, Android Keystore import, real microphone/audio behavior and 15-minute frame rate therefore remain unaccepted. A `.qa`-only instrumentation harness and network-restoring runner are provided; no production child data is used as a fixture.

## MiniMax evidence

Bundled voices: 35 real mmx / speech-2.8-hd outputs. ASR, LLM, TTS and image generation were tested against the actual provider. Voice design uses direct HTTP, matching the official prompt/preview_text request and voice_id/trial_audio response. Both current and prior API host addresses returned status 2061 for new designs with the current Token Plan key. Account voice lookup and TTS using an existing design were verified. The app supports direct design → TTS activation and existing voice reuse, without treating the provider limitation as a missing feature.
