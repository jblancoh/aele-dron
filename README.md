# AELE cinematic portfolio

Spanish-language, single-page event videography portfolio. Built with the Sites scaffold, React and Vinext; published as static output with no application backend or data storage.

## Run and validate

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

The export is `dist/client`. Keep `.openai/hosting.json` bound to its existing Sites project. Do not initialize another Site for this checkout.

## Before commercial launch

1. Set `site.whatsappNumber` in `lib/site-content.ts` to the real international number. Until then, the contact summary explicitly states that WhatsApp is unconfigured and offers Instagram; nothing is sent.
2. Replace the demo entries in `portfolio` with approved AELE footage and posters, and change `demo` only for real work. Keep file paths, dimensions and aspect ratios aligned.
3. Replace the hero/scroll sample if desired. The sequence has 45 JPEG frames named `coast-01.jpg` through `coast-45.jpg` under `public/media/frames`. Update both sequence settings and assets together.
4. Confirm real business claims and contact information. The private preview uses `noindex`; enable indexing only for the commercial public launch.

## Media behavior

- Hero starts muted only on desktop without reduced-motion or Save-Data preferences. Mobile begins with a 76 KB poster and an explicit play control.
- Catalog videos mount on dialog open and start only through player controls. Escape closes the dialog and restores trigger focus.
- Frames load in batches only near the scroll section. New batches stop offscreen or in hidden tabs. Small viewports, Save-Data and reduced motion use a compact still-image section.
- The pause control stops automatic hero/scroll/gimbal motion. Pointer motion does not affect touch interactions or reduced-motion users.
- Contact data remains in React memory. WhatsApp opens a prepared message for the visitor to review and send; no availability or reservation is implied.

## Verification notes

Unit/integration tests cover validation, message encoding, the unconfigured state, dialog focus/error handling, responsive motion and frame scheduling. Tests for the primary catalog/contact behavior were written and observed failing before implementation, then passed. Later review fixes include regression tests.

WebMCP `prepare_event_inquiry` is optional and prepare-only. Its mocked registry contract is tested; native browser registry validation is not yet performed. Unsupported browsers retain the normal form.

LCP ≤2.5 s and CLS ≤0.1 are targets, **not measured results**. No browser performance audit or visual viewport inspection has been performed. Source-defined responsive rules and media gating are covered separately.

The scaffold's untouched vendored UI and generated mobile hook are excluded from project lint due to baseline errors. Precompressed local images intentionally do not use a runtime image optimizer. React was patched to 19.2.8 after audit; remaining scaffold/toolchain advisories are not silently force-upgraded. Static publication excludes the server runtime.

See `MEDIA_LICENSES.md` for source and licensing details.
