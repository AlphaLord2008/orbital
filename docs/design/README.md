# ORBITAL Web Alpha — Design (WA-0)

Status: **revision 2, awaiting gate G1** (your written approval). No production UI is built before it. PR #1 stays open until then.

| Deliverable | Link | Notes |
|---|---|---|
| ORBITAL Design System | https://claude.ai/artifact/EctQCVDdq7xYU1ETLfEefV | v2: brand book, tokens (one theme, Observatory dark), 22 components with every state, cover. A copy of the tokens is in `tokens.json` here. |
| High-fidelity designs | https://claude.ai/artifact/Cyj73JYUkiWbcAZCADMFLV | Revision 2: desktop D1–D9, mobile M1–M5, visualization concept |
| Renders | `renders/rev2/` | 13 stills used by revision 2, plus `anchors.json` (screen positions) and `readouts.json` (engine values at each playhead, with osculating elements for reference only). `renders/` holds the rev-1 stills. |
| Render tooling | `scripts/design/render_wa0_r2.py` | Reproduces every rev-2 still and both JSON files bit for bit from orbital v0.1.0 (verified 2026-11-24) |

## Screens (revision 2)

| ID | Mode | Screen | What it proves |
|---|---|---|---|
| D1 | Explore | ISS · Validated reference | First-visit experience: scenario card, three primary readouts at 28 px, ringed spacecraft with a not-to-scale label, slim transport |
| D2 | Analyze | The same ISS run at the same sample | Mode switch keeps run, time and camera; all controls; primary, secondary (exact) and Advanced diagnostics; V0 evidence marked Completed |
| D3 | Analyze | Ellipse · Unvalidated, E1 pending | Pending evidence card (limits, em-dash values, Pending · WA-2); exact solution and velocity arrow on |
| D4 | Analyze | Unvalidated run + invalid altitude | Tier 3; WA-E2 (last valid result dimmed, field error) |
| D5 | Analyze | Impact · I1 pending | Numerical impact cross vs analytical crossing diamond; Impact detail inset |
| D6 | Explore | Large run computing | Responsiveness invariant: progress, Cancel, previous GEO run still interactive |
| D7 | Explore | Escape · X1 pending | Unbound trajectory; "no period" handled in the primary readouts |
| D8 | — | Presentation mode | Classroom readability (40 px readouts) |
| D9 | — | How this works | Editorial methodology: hero with key results, table of contents, numbered sections, Completed and Pending chips, new sections on reading the numbers and on impact |
| M1 | Explore | Main simulation, sheet collapsed | Primary readouts and transport on a phone; scene stays visible |
| M2 | Explore | Controls sheet | Essential controls at touch size; route to all controls in Analyze |
| M3 | Analyze | Diagnostics · E1 pending | Primary, secondary (exact), Advanced collapsed |
| M4 | Explore | Playback | Scrub bubble, rate picker, step and revolution skip, loop; marker hidden behind the Earth with a hint |
| M5 | Analyze | Advanced and evidence | ε, h, drift plot, run values, V0 evidence Completed |
| Concept | — | Visualization concept | Layer rules incl. ring and velocity arrow; four regimes; impact marks; ghost marker; exact elements; pipeline |

Every number on every screen comes from orbital v0.1.0 output or closed-form two-body formulas. Presets whose v0.1.1 case has not run show **Unvalidated · ID pending**, which is today's real state.

## Change requests from review

| # | Request (review of the 10-page PDF, 2026-11-24) | Resolution |
|---|---|---|
| 1 | Explore and Analyze modes sharing one simulation and state | WA-F18; ADR-0005 R11; ModeSwitch component; D1/D2, M1–M5. Switching changes panel density only. |
| 2 | Typography: readability, hierarchy, no tiny text | Type scale raised: labels 14, values 15, captions 13, floor 12 px; primary readouts 28 (Explore) / 22 (Analyze); WA-A11; DS v2 |
| 3 | Spacecraft easier to identify; keep "not to scale"; optional velocity indicator | 12 px disc + 26 px selection ring, permanent label with leader; hidden-behind-Earth hint; velocity arrow from sample k (WA-F19, R12–R13). Also fixed a renderer bug that drew strokes and the marker at half their intended CSS size. |
| 4 | Diagnostics hierarchy: primary / secondary / advanced | WA-F7/F8; PrimaryReadouts, KeyValue, Disclosure components. Secondary values are exact closed-form elements (see finding below). |
| 5 | Methodology editorial layout, all science kept | D9 rebuilt: hero, key-number callouts, TOC, numbered sections, pull quote; all rev-1 content kept, plus "Reading the numbers" and "Impact" sections |
| 6 | Distinguish pending v0.1.1 measurements from completed results | ResultStatus chips (Completed solid/check/date vs Pending dashed/clock/milestone); em-dash pending values; pending TierBadge; WA-F9 |
| 7 | Numerical impact detection vs analytical surface crossing | Red cross vs open cyan diamond, labelled; Impact detail inset when under 24 px apart; WA-F10, R14 |
| 8 | Dedicated mobile designs: main, controls, diagnostics, playback | M1–M5 |

**Finding made during the revision.** Orbital elements computed from the integrator's stored state are wrong by about ω·Δt because semi-implicit Euler's r and v are half a step apart: on the circular ISS preset they give e = 0.00098 and apsides at 393.4 and 406.7 km. Secondary diagnostics therefore show exact elements, tagged *exact*; run values are under Advanced (ADR-0005 R15, §2b). The same effect makes the ISS altitude readout oscillate between 396.2 and 403.8 km without growing; the methodology page explains it.

## Reproducing the renders

```
ORBITAL_EARTH_TEXTURE=/path/to/blue-marble-4096x2048.jpg python scripts/design/render_wa0_r2.py docs/design/renders/rev2
```

The rev-1 stills in `renders/` were made by `render_wa0.py` with `render.py` at commit fe8dd4a. The rev-2 `render.py` sizes strokes and markers in CSS pixels, so `render_wa0.py` no longer reproduces those files bit for bit.

**Texture provenance.** The WA-0 stills used the NASA Blue Marble topography/bathymetry composite (4096 × 2048) as redistributed in the open-source three-globe project, because NASA's site was not reachable from the design environment. Production (WA-3) downloads the original from NASA Visible Earth, checks it, and credits "NASA Earth Observatory".

## G1 review checklist (revision 2)

- [ ] Explore feels uncluttered for a first-time student; Analyze has everything an engineer needs
- [ ] Mode switch keeps the same run, time and camera
- [ ] All panel text readable at 100% zoom; nothing below 12 px
- [ ] Spacecraft findable at a glance on every screen, including mobile
- [ ] Diagnostics hierarchy and "exact" tagging acceptable
- [ ] Completed vs Pending is unmistakable
- [ ] Numerical impact vs analytical crossing is unmistakable
- [ ] Methodology reads as an editorial page with all science intact
- [ ] Mobile main, controls, diagnostics and playback acceptable
