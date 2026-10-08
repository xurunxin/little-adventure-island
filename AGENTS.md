# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Accepted app decisions

- Use selected visual design 2 (`design/selected-home.png`): warm layered storybook island, picture task cards, fox/rabbit/bear partners, landscape Android tablet. Target Snapdragon 680 / Android 15 / 1920×1200; child age 4.5, limited Chinese reading.
- Offline single-child task/reward transactions, parent approval and six-digit PIN. AI features are optional online additions; the child conversation cannot grant points or change task state.
- Generate bundled Mandarin audio with mmx CLI / MiniMax TTS. Use direct MiniMax HTTP APIs inside the app for voice_design, returned voice_id → TTS, ASR, LLM and custom task image generation/cropping. Support reusing existing designed voice IDs.
- Read development credentials only from MINIMAX_CN_API_KEY. Never embed plaintext keys in web resources or APKs. Android stores keys encrypted with Android Keystore; backups exclude credentials for MiniMax.
- Keep an explicit decoded-image preload screen with progress/retry before exposing the island UI.
