# Integrate Client Videos

## Objective

Replace the catalog demo footage with the three supplied client videos and replace the existing «La perspectiva» scroll-scrub image sequence with 45 frames generated from `5 Baner Final.mp4`. Preserve the current scroll-driven interaction and its responsive/reduced-motion fallback behavior.

## Problem and Why

The catalog currently uses demo footage, while «La perspectiva» is a 45-image canvas sequence sourced from unrelated footage. The supplied videos are the intended client content. Integrating browser-friendly derivatives avoids shipping local HEVC/AAC source files directly, and replacing (rather than layering onto) the existing sequence keeps the intended perspective interaction intact.

## Authorized Scope

- Catalog videos, in this order: `2 JAC Veracruz WEB.mp4`, `4 Hyper Vsa- WEB.mp4`, `3 Day to night.mp4`.
- «La perspectiva»: use `5 Baner Final.mp4` as the source of a new 45-frame sequence; remove the old `coast-01.jpg` through `coast-45.jpg` assets after the replacement is generated and wired.
- Relevant catalog and perspective metadata, accessible labels, fallback/poster media, and copy/credits that currently identify the footage as Mixkit/demo content.
- Tests and implementation files directly supporting the above behavior.

No other page, unrelated media, remote service, or feature is authorized. Do not modify, stage, or remove the existing untracked `.codegraph/` state or unrelated user changes.

## Constraints and Decisions

- The «La perspectiva» experience remains a scroll-scrubbed sequence, not a standalone video player.
- Generate 45 ordered frames from `5 Baner Final.mp4`; keep the existing canvas/scroll integration and its poster behavior for mobile, reduced motion, and save-data conditions.
- Create optimized, browser-friendly derivatives from all four local HEVC/AAC sources. Do not copy or serve the original source files blindly. Preserve supplied originals outside the repository.
- Remove stale Mixkit/demo wording, but do not invent a creator, license, or rights attribution. Use accurate neutral copy unless verified attribution is available in project content.
- Keep generated media out of authored-line estimates. The old perspective frames must not remain as unused assets after the replacement is verified.
- TDD is enabled by `AGENTS.md`; use strict RED → GREEN → REFACTOR for behavior changes. Required project commands: `npm test`, `npm run typecheck`, and `npm run lint` as applicable to each work unit; report exact observed results and any unavailable/failing command honestly.
- Current branch is `jblancoh/rockling` (not the default branch). Do not create a branch solely for this task.
- Delivery strategy: `ask-on-risk` (ODD default). Forecast is approximately 250–400 authored changed lines excluding generated media; revise from actual authored diff before delivery planning if it exceeds about 400.

## Tasks

### VID-1 — Replace catalog demo footage with client videos

- [x] Add regression coverage first for the catalog's three supplied videos, their order, and accessible video presentation/fallback behavior.
- [x] Observe RED, then wire optimized browser-friendly derivatives for JAC Veracruz, Hyper Vsa, and Day to night into catalog content and UI.
- [x] Remove or replace copy/credits that inaccurately imply Mixkit/demo footage without fabricating attribution.
- [x] Refactor while preserving responsive layout and existing catalog behavior.
- [x] Run focused catalog tests, `npm run typecheck`, and `npm run lint`; record exact outcomes.
- [x] Commit this work unit with a Conventional Commit message and record its commit identity here.

**Route:** delegated direct (writer), because reading in preparation for the multi-file implementation and tests spans `lib/site-content.ts`, `components/catalog.tsx`, and `tests/catalog.test.tsx`; the exploration handoff already mapped these files. Keep tests and behavior in the same work-unit commit.

**Acceptance:** all three correct client videos appear in the requested order using browser-compatible derivatives; accessible controls/labels and fallback behavior are covered; no stale demo attribution remains in the affected content; existing catalog tests and applicable checks pass.

**Verification:** RED — `npm test -- tests/catalog.test.tsx` failed on the stale concert/wedding/coast entries. GREEN — `npm test -- tests/catalog.test.tsx`: 4 passed; `npm test`: 11 files and 159 tests passed; `npm run typecheck`: passed; changed-file `npx oxlint app/page.tsx components/catalog.tsx lib/site-content.ts tests/catalog.test.tsx`: passed. `npm run lint` ran but reported four existing `react-compiler` errors in unchanged `components/hero-video.tsx` lines 23 and 44. `ffprobe` confirmed H.264/yuv420p outputs: 1280×720 JAC Veracruz (59 MB), 1280×720 Hyper Vsa (37 MB), and 720×1280 Day to night (8.3 MB); all have matching JPEG posters. The source MP4s remain outside the repository.

**Commit:** `b9c51d3` — `feat(catalog): replace demo footage with client videos`.

### VID-2 — Replace «La perspectiva» frame sequence

- [x] Add/update regression coverage first for the 45-frame sequence mapping and the existing poster fallback conditions.
- [x] Observe RED, then generate 45 ordered optimized browser-friendly frames from `5 Baner Final.mp4` and update the perspective sequence to use them.
- [x] Update the poster if the current poster depicts the removed footage; verify the replacement is suitable for poster fallback.
- [x] Remove the old `public/media/frames/coast-01.jpg` through `coast-45.jpg` assets only after the new sequence is integrated and verified.
- [x] Preserve canvas scroll scrubbing and mobile, reduced-motion, and save-data poster behavior; remove inaccurate demo/Mixkit copy where applicable.
- [x] Refactor and run focused frame-loading tests, `npm run typecheck`, and `npm run lint`; record exact outcomes.
- [x] Commit this work unit with a Conventional Commit message and record its commit identity here.

**Route:** delegated direct (writer), because preparation and implementation span `components/scroll-story.tsx`, `lib/scroll.ts`, frame assets, poster media, and `tests/frame-loading.test.tsx`. Keep tests and implementation together; generated frame assets are delivery media and excluded from the authored-line estimate.

**Acceptance:** the scroll sequence contains exactly 45 ordered frames derived from `5 Baner Final.mp4`; the previous coast frame assets are removed; scroll-scrubbing remains functional; poster fallback still applies on mobile, reduced motion, and save-data; relevant tests and applicable checks pass.

**Verification:** RED — `npm test -- tests/frame-loading.test.tsx` failed: `frameSrc` was missing and the rendered poster still pointed at `/media/coast-poster.jpg` (the new fallback expectations failed); the initial run also exposed shared mock-state leakage, which was reset in test setup. GREEN — `npm test -- tests/frame-loading.test.tsx tests/motion.test.tsx`: 2 files, 25 tests passed; `npm run typecheck`: passed; `npm run lint`: failed only with 4 existing `react-compiler` errors in unchanged `components/hero-video.tsx` at lines 23 and 44. Generated 45 960×540 JPEG frames sampled at 4.5 fps from the 3840×2160 source (45 files; 912 KB total) and a 1280×720 poster; inspected poster visually. Removed all 45 coast frames and the obsolete coast poster after the new sequence and poster tests passed. Runtime harness: N/A — static scroll/canvas component; focused jsdom tests exercise frame scheduling and poster gating.

**Commit:** `05b9249` — `feat(scroll-story): replace coast frames with Baner sequence`.

### VID-3 — Make portrait catalog playback immersive on mobile

- [x] Add regression coverage first for portrait-only immersive dialog/video styling, while asserting horizontal playback remains unmarked.
- [x] Observe RED, then update the existing accessible catalog dialog/portal and mobile styles so portrait items fill the mobile viewport without using the browser Fullscreen API.
- [x] Preserve the video’s native portrait shape, native controls, Escape/close behavior, and focus restoration; leave desktop and horizontal playback unchanged.
- [x] Run offline dependency setup first; package fetching is prohibited except for the explicitly user-authorized single package from the exact registry recorded below.
- [x] Run focused catalog tests and `npm run typecheck`; record exact outcomes.
- [x] Run `npm run lint`; record the observed unchanged-file error.
- [x] Commit this work unit with a Conventional Commit message and record its commit identity here.

**Authorized scope:** `components/catalog.tsx`, `app/globals.css`, `tests/catalog.test.tsx`, and this task document / its Engram mirror. Apply immersive playback only to catalog items with `aspect: 'portrait'`; no public API changes, Fullscreen API, or unrelated edits. The user separately authorized only `@testing-library/dom@10.4.2` from `https://registry.npmjs.org`, without additional credentials and without changing package manifests/lockfile; no other remote operation is authorized.

**Route:** delegated direct (writer), due to multi-file component/style/test behavior and task-document preparation. Current branch for VID-3: `jblancoh/vertical-video-mobile`; preserve historical VID-1/VID-2 branch and commit evidence above.

**Acceptance:** on mobile, a portrait catalog dialog fills the viewport, keeps its video uncropped and in its native portrait shape, and places title/close affordance within safe areas. Desktop and horizontal playback remain unchanged. Existing accessible dialog/portal behavior, Escape/close, focus restoration, and native video controls are retained. No public API changes.

**Strict TDD:** source is `AGENTS.md`; add regression coverage and observe RED before implementation. Required runner/checks: `npm test`, `npm run typecheck`, `npm run lint`. Initial `npm ci --offline --legacy-peer-deps` completed successfully (659 packages added, 0 vulnerabilities), but the focused test could not collect because `@testing-library/dom` was missing. The first cache-only repair failed with `ENOTCACHED` for uncached `@base-ui/react` metadata. After explicit user authorization, `npm install --no-save --package-lock=false --legacy-peer-deps --registry=https://registry.npmjs.org --ignore-scripts @testing-library/dom@10.4.2` completed (20 added, 18 removed, 82 changed in `node_modules`; package manifests and lockfile unchanged; npm reported 10 vulnerabilities). No other network destination or credentials were used. **RED observed:** `npm test -- tests/catalog.test.tsx` ran 5 tests; 4 passed and the new portrait test failed because dialog lacked `film-dialog-portrait`. This is a valid behavior RED.

**Verification:** RED — `npm test -- tests/catalog.test.tsx`: 5 tests; 4 passed and the new portrait assertion failed because `film-dialog-portrait` was absent. GREEN — `npm test -- tests/catalog.test.tsx`: 1 file, 5 tests passed; `npm run typecheck`: passed. `npm run lint`: failed with `components/drone-scene.tsx:641:31: error typescript(no-deprecated): PCFSoftShadowMap is deprecated.` `components/drone-scene.tsx` is unchanged and outside VID-3 scope; do not modify it to clear lint. Existing task history records the earlier four `react-compiler` errors in unchanged `components/hero-video.tsx`; neither file is changed here. Package install audit output reported 10 vulnerabilities; no audit remediation was authorized.

**Commit:** `881b484` — `feat(catalog): add immersive mobile portrait playback`.

## Progress and Verification

### VID-4 — Correct clipped mobile portrait playback

- [x] Reproduce the mobile positioning failure in generated production CSS and observe a failing minifier regression before source changes.
- [x] Fix the confirmed cause while retaining uncropped portrait playback, accessible close/focus behavior, and unchanged desktop/horizontal playback.
- [x] Run focused and full tests, typecheck, lint, and rendered mobile/desktop layout checks; record baseline lint failure below.
- [ ] Commit the verified work unit locally with a Conventional Commit; record commit and native review status.

**Authorized scope:** catalog playback, its styles, directly supporting regression tests, and this document/mirror. User approved this correction on 2026-10-02. No dependency fetching, push, PR, deployment, or remote credentials are authorized. Offline dependency setup is allowed; stop if required tools cannot be made available locally.

**Route:** delegated direct, because reproducing the geometry failure and implementing regression coverage requires multi-file preparation and execution. One bounded writer owns the fix; preserve all historical VID-1/VID-2/VID-3 evidence.

**Acceptance:** at mobile portrait sizes the complete player and close affordance are visible within the viewport, video is uncropped at its native aspect ratio, and desktop/horizontal playback is unchanged. Verify rendered geometry where tools are available, not only class names.

**TDD:** strict, from the current AGENTS.md/session configuration. Runner: `npm test`; required checks: `npm test -- tests/catalog.test.tsx`, `npm test`, `npm run typecheck`, `npm run lint`, `git diff --check`. Run source-mutating normalization before final verification/review only, preserving the existing compact style and avoiding unrelated churn.

**Delivery:** existing feature identity reused. Current correction branch: `jblancoh/fix-mobile-vertical-video`; boundary before VID-4 is `5fec163`. Correction forecast: 80–200 authored changed lines; delivery strategy `ask-on-risk`. Keep this correction as one coherent local work-unit commit with tests and documentation. Rollback boundary is the VID-4 playback/test changes, not earlier video integration.

**Root cause and fix:** the source mobile rule already reset the legacy `transform` and individual `translate`, but the production Lightning CSS pipeline removed `translate:none!important` when it also saw `transform:none!important`. Tailwind's dialog utilities still emitted `translate:-50% -50%`, so the full-viewport mobile dialog was shifted by half its own width and height toward the upper-left. The regression test composes the production utility declaration and source mobile rule, runs the installed Lightning CSS optimizer, and asserts the individual translate reset survives. `npm test -- tests/catalog.test.tsx` was RED before the source edit: the minified output retained `translate:-50% -50%`. The fix uses `translate:0 0!important` and removes the redundant `transform:none!important`; the optimizer preserves the reset and the existing open/close transform animation is not disabled.

**Rendered production QA:** rebuilt with `npm run build:vercel` and served only the local `.vercel/output` in headless Chrome using an isolated temporary profile/CDP. Chrome device emulation used `mobile:true`, DPR 3, and 390×844, 375×667, and 844×390; desktop 1440×900 used `mobile:false`, DPR 1. At 390×844 the settled portrait dialog bounds are (0, 0)–(390, 844), video (18, 155.3)–(372, 784.7), and close control (328, 59.3)–(372, 103.3). At 375×667, dialog bounds are (0, 0)–(375, 667), video (53.3, 143)–(321.7, 620), and close control (313, 47)–(357, 91). At 390×700 after viewport resize, the video is (51.6, 143)–(338.4, 653) and close control (328, 47)–(372, 91). The 390×844 opening animation was inside bounds immediately and at 100/500 ms. Portrait video retained native 720×1280 dimensions, `object-fit:contain`, controls, and `playsinline`. Mobile landscape wide playback and desktop portrait playback remain centered/in-bounds; Escape closes and restores focus to the trigger. These are Chromium emulation results, not actual iPhone/WebKit validation.

**Verification:** RED — focused minifier regression failed before source changes. GREEN — `npm test -- tests/catalog.test.tsx`: 6 passed; `npm test`: 12 files / 178 tests passed; `npm run typecheck`: passed. `npm run lint`: fails on the existing unrelated `components/drone-scene.tsx:641:31` deprecated `PCFSoftShadowMap` API; file is unchanged. `git diff --check`: passed. The production build succeeded and the geometry above was measured against its generated CSS. No package manifest or lockfile changes. Parent structural readback and focused spot-check passed. Native preliminary assessment: medium risk, 37 lines, under budget; final committed assessment is pending.

**Next step:** create the authorized local work-unit commit, record its hash, then obtain the parent-owned final committed assessment. Chrome emulation verifies the production CSS fix; iOS/WebKit still requires validation on an actual iPhone if device-specific confirmation is desired.

- **TDD mode:** strict; source: `AGENTS.md`.
- **Test runner/checks:** `npm test`; `npm run typecheck`; `npm run lint` (applicable checks per work unit).
- **Current progress:** VID-1 implementation, verification, and work-unit commit are complete. VID-2 behavior, media, tests, typecheck, and work-unit commit are complete; lint remains blocked by the known errors in unchanged `components/hero-video.tsx`, so VID-2 remains partial pending resolution of that baseline check.
- **VID-3 progress:** mobile-only portrait dialog styling and regression coverage are implemented and committed as `881b484`. Focused tests (5/5) and typecheck pass; lint is blocked by an unchanged deprecated API usage in `components/drone-scene.tsx:641`. No package.json/package-lock changes. Current branch: `jblancoh/vertical-video-mobile`.
- **Verification evidence:** see VID-1 for observed RED/GREEN outcomes and check results. `npm ci` required `--legacy-peer-deps` for the existing Vite 8/Tailwind peer range; Vitest's existing setup also required the missing `@testing-library/dom` package locally (installed with `--no-save`, not added to project manifests).
- **Commits:** VID-1 `b9c51d3`; VID-2 `05b9249`.
- **Next step:** resolve the pre-existing lint errors in `components/hero-video.tsx` or have the project owner accept them as a baseline exception before closing the feature.
