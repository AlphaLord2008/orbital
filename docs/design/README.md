# ORBITAL Web Alpha — Design (WA-0)

Status: **awaiting gate G1** (your written approval). No production UI is built before it.

| Deliverable | Link | Notes |
|---|---|---|
| ORBITAL Design System | https://claude.ai/artifact/EctQCVDdq7xYU1ETLfEefV | Brand book, tokens (one theme, Observatory dark), 16 components with every state, cover. A copy of the tokens is in `tokens.json` here. |
| High-fidelity designs | https://claude.ai/artifact/Cyj73JYUkiWbcAZCADMFLV | Desktop D1–D8 (1440 × 900 and the methodology page), mobile M1–M3 (390 × 844), visualization concept board |
| Renders | `renders/` | 9 stills used by the designs, plus `anchors.json` (screen positions) and `readouts.json` (engine values at each playhead) |
| Render tooling | `scripts/design/render_wa0.py` | Reproduces every still bit for bit from orbital v0.1.0 (verified 2026-11-24) |

## Screens

| ID | Screen | What it proves |
|---|---|---|
| D1 | ISS preset playing · Validated reference | The default experience; true scale; readouts with sample stamp |
| D2 | Ellipse · Tested condition E1, exact solution on | Tier 2 card with pre-registered gates; apsis labels; dotted exact orbit |
| D3 | Unvalidated run + invalid altitude | Tier 3; WA-E2 (last valid result dimmed, field error) |
| D4 | Impact · Tested condition I1 | Step-boundary impact vs the exact crossing; grazing-angle explanation |
| D5 | Large run computing | Responsiveness invariant: progress, Cancel, previous GEO run still interactive |
| D6 | Escape · Tested condition X1 | Unbound trajectory; normalised energy drift |
| D7 | Presentation mode | Classroom readability (1.5× readouts) |
| D8 | How this works | Model, integrator, tiers, v0.1.0 and v0.1.1 evidence, conformance, what is not drawn, credits |
| M1–M3 | Mobile: playing, setup sheet, diagnostics sheet | 44 px touch targets; the scene stays visible |
| Concept | Visualization concept | Layer-by-layer rules; four regimes; the ghost-marker finding; pipeline |

Tier 2 screens show the state **after** the relevant v0.1.1 case has passed. Until then the app shows Unvalidated (ADR-0008 rule 4). Every number on every screen comes from orbital v0.1.0 output or closed-form two-body formulas.

## Reproducing the renders

```
ORBITAL_EARTH_TEXTURE=/path/to/blue-marble-4096x2048.jpg python scripts/design/render_wa0.py docs/design/renders
```

**Texture provenance.** The WA-0 stills used the NASA Blue Marble topography/bathymetry composite (4096 × 2048) as redistributed in the open-source three-globe project, because NASA's site was not reachable from the design environment. Production (WA-3) downloads the original from NASA Visible Earth, checks it, and credits "NASA Earth Observatory".

## G1 review checklist

- [ ] Earth and trajectories read as a premium scientific instrument, not a dashboard
- [ ] Numbers readable at 100% zoom; units, minus signs and significant figures correct
- [ ] Every colour has one stated meaning; tiers readable without colour
- [ ] No glass, glows, decorative gradients or starfield
- [ ] Tier 1 / 2 / 3 states and wording acceptable
- [ ] Error, impact and computing states acceptable
- [ ] Mobile layout and touch targets acceptable
- [ ] Change requests recorded below

## Change requests from review

| # | Screen | Request | Resolution |
|---|---|---|---|
| | | | |
