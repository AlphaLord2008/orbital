# WA-6 — Visual excellence, performance and release hardening

Branch `wa6/visual-perf-hardening`, from `main` at 9001f56. Work done 2026-11-27/28. Evidence in this folder; screenshots in `screens/before` (main at 9001f56) and `screens/after` (this branch), same URLs, viewports and hardware-rendered Chromium.

The physics engine, tolerances, registered results, evidence-tier rules and conformance checks are unchanged. No test, gate or accessibility scan was removed or loosened.

## 1. What changed

### Earth
| Change | Why | Evidence |
|---|---|---|
| Textures derived from the **NASA original** (BMNG topography–bathymetry, December 2004, 21600 × 10800, SHA-256 recorded) | Closes the provenance carry-over. The old three-globe copy was a different month and about 2.6° off in latitude | `earth-texture.md`, `scripts/design/derive_earth_textures.py` |
| Shading restored to the **approved WA-0 model** (`colour × shade × 1.18` in linear light) | WA-3 used `shade^2.2`, which made the limb 15 % bright instead of 50 % and the globe dull compared with the approved D1 render | `earth.ts`, `scripts/design/render.py` |
| 2K → 4K → 8K **chosen by need**: a sharper texture loads only when the drawn disc would magnify the current one, after the view settles, capped by device class | Requirements §6.1 asks for 8K on class A; nothing is downloaded that the screen cannot show | `earth.test.ts` |
| Old texture **disposed** on replacement; ImageBitmap decode off the main thread | The 2K used to stay resident after 4K arrived; uploads stalled the main thread | §2 |
| Trilinear filtering, anisotropy ≤ 8 (unchanged limit) | No shimmer when zoomed out | — |

### Orbit view and camera
- **Framing into the free region.** The projection centre follows the area no panel covers (`data-occludes`), with easing, so a mode switch or collapsed panel glides rather than jumps. Fit uses an **exact perspective fit** over the computed points (`fitDistanceForPoints`); the old bounding sphere let a one-day escape leave a 375 px phone. The maximum camera distance is 4 × 10⁶ km (was 9 × 10⁵) so narrow screens can frame X1; the minimum is still 1,000 km above the surface.
- **Oblique** now looks from the side the spacecraft flies toward first (scene −Z), so a new run starts in front of the Earth with Africa and Eurasia facing, as in the approved D1 render. Before, the default view usually opened with the spacecraft behind the Earth.
- **Impact** runs open framed on the impact point, so the numerical-impact cross, the analytical-crossing diamond and the Impact detail inset are visible at once. Before, both marks were behind the Earth.
- **Preset flights** turn along a great circle (never through the Earth), change distance geometrically, and stop on any drag, pinch, wheel or key. Reduced motion jumps instantly, as before.
- **Labels.** Background-coloured halos on everything drawn over the scene; axis labels yield to the spacecraft label; labels stay inside the free region; quieter axes.
- **WebGL context loss** shows a status message and redraws on restore (WA-E5).

Not changed: the coordinate mapping, decimation (ε = 100 m), the Hermite marker, revolution splitting, the past/future rule, occlusion, the exact path and ghost, impact detection or the dash patterns. No numerical artefact is smoothed.

### Diagnostics
- **Drift plots** (WA-F8): the **running maximum** (the headline value) is a step line that ends at the dot, so the dot can no longer appear disconnected from the curve. The **drift at each sample** is a separate band, drawn only for fully played buckets, so it never shows a sample beyond the playhead. There is now a y-axis with round ticks and a factored power of ten, a whole-run x-axis with a playhead, and a key. Text and the dot are HTML, so they are not distorted by the stretched SVG. Tested in `DriftPlot.test.ts`.
- **Evidence table**: numbers no longer wrap ("1.03 ×" / "10⁻¹⁵" read as two values).

### Methodology (WA-F13)
- The lede and the header tagline said nothing is drawn from a formula, which was **wrong for the exact path and ghost**: they are closed form. Both are corrected, and a new subsection explains that the exact solution is a reference, never integrated, and that the gap to the ghost is the run's own position error.
- Typeset, numbered equations; an editorial key-results row instead of four boxed cards; a table of contents that tracks the section being read; small-caps table headers; full NASA credit. Every measured value is still read from the registered results, as before.
- Known limits now state what WA-6 verified and what it did not.

### Layouts
- **Presentation**: frameless 1.5× readouts, a legend for the audience, the orbit framed above the readouts, and the scale bar out of their way.
- **Portrait tablets** (≤ 900 px) use the bottom-sheet layout (the design system's drawer for tablets) instead of two side panels covering the orbit; the sheet is 640 px wide on tablets.
- **Phones**: the scale bar sits above the sheet instead of under the tier badge.
- **1024 px Analyze**: the orbit is framed in the gap between the panels, not under one; the brand line hides below 1180 px; legend items never break.

### Reliability
- A share link whose fields are each in range but cannot run together (an unbound trajectory given in orbits, or over the step budget) left the page on "Computing the first orbit…" with no message. It now says why and opens V0, like any rejected link. This is a new e2e test.
- **Render on demand**: paused with a still camera, no frames are drawn.

## 2. Measured results (engineering)

Environment: MacBook Pro, Apple M3 Pro, macOS 26 (Darwin 25.6); Playwright 1.65.1 browsers. Chromium 1255 new-headless, GPU through ANGLE Metal ("ANGLE Metal Renderer: Apple M3 Pro"); Playwright Firefox (WebGL 2, renderer reported as "Apple M1, or similar", a masked string); Playwright WebKit 27.2 ("Apple GPU"). The production build was served with the production `_headers` (`scripts/serve-dist.mjs`). This Mac is the user's class A machine type (requirements §6.1 "Your Mac"), but it is not confirmed to be *the* reference device. **No class B, C or D device was available.**

| Metric (requirements §6, A1) | Budget, class A | Measured | Notes |
|---|---|---|---|
| Frame rate, autoplay (V0, 1280 × 720) | 60 fps | **60.0 fps** (4 runs) | `perf.spec.ts`, hardware config |
| Frame pacing p95 | ≤ 25 ms | **16.7–16.8 ms**, max 16.8 ms | 0 frames over 2× budget |
| Long tasks during playback | ≤ 5 % blocking | **0** | — |
| Worst input latency (19 interactions) | INP ≤ 200 ms | **32 ms** | 216 ms when five test workers ran at once; contention, not the app (§3) |
| Input → orbit, normal size, p95 | ≤ 100 ms | **19 ms** Chromium, **14 ms** Firefox, **19 ms** WebKit | `smoke.spec.ts` rapid inputs, 12 runs each |
| Input → orbit, large (≈ 10⁶ steps) | ≤ 400 ms | **205–224 ms** in-page (Chromium); 217–246 ms cold in all three browsers | 999,000 steps |
| Long task > 50 ms from receiving or drawing a large result | none | **none** | 6 large runs in a row |
| Supersession | last input wins | 5 rapid inputs → **1** run delivered (the last) | — |
| Startup (Lighthouse, desktop preset, 3 runs) | FCP ≤ 1.8 s, LCP ≤ 2.5 s, CLS ≤ 0.1, a11y 100 | FCP **0.28–0.29 s**, LCP **0.28–0.29 s**, CLS **0.0003**, a11y **100** | Local, hardware GPU; the performance score (1.00, TBT 0–57 ms) is **not** comparable with CI's software rendering |
| First-route JS | ≤ 300 KB gzip | **250.2 KB** (was ≈ 244.5) | `size-limit` |
| CSS | ≤ 40 KB gzip | **11.0 KB** | — |
| First Earth texture | ≤ 400 KB | **232 KB** (was 321 KB) | 2K WebP |
| GPU Earth texture | ≤ 192 MB A, ≤ 64 MB C/D | one texture resident: 10.7 / 42.7 / 170.7 MB (2K/4K/8K) | computed by construction; old code kept 2K + 4K (53 MB) |
| JS heap | ≤ 250 MB at the step cap | 5.9 → 7.3 MB after 30 preset changes and 5 mode switches (plateau) | forced GC between rounds; no leak found |
| Idle GPU | — | 420 draw calls/s playing, **0** paused | 7 draw calls per frame |

### Texture upload stalls (measured, Chromium on M3 Pro)
| Upload | Before (img element) | After (ImageBitmap) |
|---|---|---|
| 4K | ~100 ms long task | 53 ms |
| 8K | ~400 ms long task | 184 ms |

The 8K upload is still a single 184 ms task. It happens once per session, 400 ms after the view settles close to the Earth, on class A only. **Known limitation**; the fix is a tiled `texSubImage2D` upload over several frames (follow-up).

## 3. Cross-browser results

`pnpm exec playwright test -c playwright.hw.config.ts` (new): the same e2e files, each browser drawing with the GPU, one worker.

| Browser | Passed | Skipped | 3D rendering |
|---|---|---|---|
| Chromium (Metal) | all | 0 | verified at DPR 1 and 2, after resize, after context loss |
| Firefox (Playwright build) | all | 2 (perf: Chromium-only APIs, by design) | **verified with WebGL 2 on a GPU**: closes the WA-3+4 carry-over for macOS |
| WebKit (Playwright build) | all | 2 (same) | verified |

Totals for the full run before the last four tests were added: 65 passed, 4 skipped, 0 failed. The new tests (context loss, unrunnable link, CSV, reduced motion) were then run in all three browsers: 12/12 passed. Software-rendered Chromium (CI's configuration): see the final run recorded in the PR description.

**Not verified:** stock Firefox and Safari as shipped (Playwright's builds are patched); Windows, Linux and Android GPUs; iOS Safari on a phone.

## 4. Accessibility

| Check | Result |
|---|---|
| axe-core, Explore, Analyze, Data view, shortcuts, phone sheets | 0 violations in Chromium, Firefox and WebKit |
| Lighthouse accessibility | 100 |
| Keyboard | Tab order checked end to end (skip link → view → mode → header → Setup → view and inspection → Diagnostics → transport); every stop has an accessible name and a visible focus ring (number fields ring their wrapper) |
| Reduced motion | Paused on load, nothing moves by itself (new e2e test); camera jumps instead of flying; projection offset applies instantly |
| Context loss | Announced with `role="status"`; readouts keep working |
| Screen readers (VoiceOver, NVDA) | **Not done.** Needs a person with the screen reader; see §7 |

Region names keep the `aria-label` workaround for the Firefox-under-axe crash (`docs/validation/wa5-firefox-axe-crash.md`).

## 5. Subjective assessment (not measurements)

- **First impression.** The Earth now reads as the approved D1 render: brighter, crisp continents, Africa and Eurasia facing, the spacecraft in front of the globe from the first frame. At minimum zoom the 8K texture shows coastlines and snow lines cleanly.
- **Scientist's view.** The drift plots are now readable at a glance. The headline value, the line and the dot agree; the scale and units are explicit; the band and the line say what they are. The methodology no longer contradicts the exact overlay.
- **Presentation.** Suitable for lectures and recordings: large numbers, no panels, the orbit framed above them.
- **Mobile.** Framing is correct in every phone and tablet viewport inspected (320 × 568 to 768 × 1024 and 844 × 390); escape stays on screen.
- **Still plain.** The Explore and Analyze panels are largely as approved at G1 and got targeted fixes rather than a redesign; the transport is unchanged. Escape runs show a small Earth with long axis lines, which is true to scale but visually sparse.

## 6. Decisions made autonomously

| Decision | Rationale |
|---|---|
| WebP textures, derived once from the NASA original by script | 28 % smaller at 2K than the old JPEG at better fidelity; reproducible, hash-checked chain |
| December 2004 composite | It is the month the approved WA-0 renders used (snow over Asia in D1) |
| Restore the 1.18 gain and linear-light shade | It is the approved ADR-0004 model; WA-3 had drifted from it |
| Oblique azimuth flipped to scene −Z | Matches the approved D1 composition and starts the spacecraft in front of the Earth; the preset is a camera choice, not physics |
| Impact runs open on Fit | Makes WA-F10's two marks visible without user action |
| Camera limit 4 × 10⁶ km, far plane 10⁷ km | Required to frame X1 on narrow screens; log depth keeps LEO occlusion correct (render tests pass) |
| Portrait ≤ 900 px uses the sheet | Two 336/360 px panels left no visible orbit on a 768 px tablet |
| `playwright.hw.config.ts` runs one worker | Parallel workers inflated worst input latency from 32 ms to 216 ms on the same build |
| 8K upload stall left at 184 ms | A tiled upload is a riskier cross-browser change; recorded as a known limitation |
| No adaptive rendering quality | On the hardware measured there is no deficit to adapt to (60 fps, p95 16.7 ms); classes B–D have not been measured |

## 7. Remaining real-device verification (for you)

Run on each reference device against the PR preview or production, with a GPU browser:

```
cd web/apps/web
ORBITAL_BASE_URL=<preview-url> pnpm exec playwright test -c playwright.hw.config.ts perf smoke render --project=chromium
```

1. **Class A** (your Mac, if not this machine type): confirm the §2 figures.
2. **Class B** (~5-year-old Windows laptop, Intel graphics): ≥ 30 fps, p95 ≤ 50 ms, normal p95 ≤ 200 ms, large ≤ 1.0 s, 4K maximum texture (check `data-earth-texture` on `#scene`).
3. **Class C** (recent mid-range phone): ≥ 30 fps playing ISS; normal ≤ 200 ms; large ≤ 1.5 s. On a phone run the site by hand (playback, scrub, Controls sheet with the keyboard open, rotate to landscape) and note frame rate from the browser's FPS meter.
4. **Class D** (4+-year-old Android, ~4 GB): ≥ 24 fps; normal ≤ 400 ms; large ≤ 3.0 s; texture should stay at 2K or 4K.
5. **Screen readers**: VoiceOver (macOS Safari, iOS Safari) and NVDA (Windows Firefox/Chrome): load V0, switch mode, change a preset, hear the run-ready announcement, open Data view, play/pause from the keyboard.
6. **Stock browsers**: Safari 18+ on macOS and iOS; stock Firefox with WebGL 2.

## 8. Known limitations

- 8K texture upload is a 184 ms main-thread task (once, class A only).
- Classes B–D unmeasured; no real-phone run; no screen-reader pass.
- Lighthouse in CI still uses software rendering; its performance score is a warning only (amendment A1).
- Escape runs at true scale make the Earth small; this is correct and not altered.
- The Explore and Analyze panel components are as approved at G1 with targeted fixes; there was no wholesale redesign.
