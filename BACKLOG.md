# Backlog

Ideas that are deliberately **not** part of ORBITAL 0.1. Listing something here is not a commitment to build it.

## Next milestones (candidate order, from the 0.1 proposal)

- **0.2 Numerical reliability:** explicit Euler, velocity Verlet and RK4 compared on the same orbit; convergence study; long-run conservation behaviour.
- **0.3 Orbital elements:** elliptical orbits, semi-major axis, eccentricity, periapsis/apoapsis, vis-viva.
- **0.4 Maneuvers:** impulsive burns, delta-v, Hohmann transfers.
- **0.5 Interactive exploration:** live controls and diagnostics.
- **0.6 Scientific expansion:** 3D motion, more bodies, perturbations (J2, drag, third bodies).

## Long-term (not scoped)

- Web-first, desktop-capable application. React, TypeScript, Three.js, React Three Fiber, FastAPI and Tauri are candidates only (ADR-0001 §6).
- Context-aware AI tutor that explains results computed by the validated engine.
- Voice interaction.
- Structured, interactive lesson generation.

## Small items

- Precise event detection (impact time, apsis passage) by interpolation (ADR-0002 §2.7).

## Deferred from Web Alpha (2026-11-24)

- Integrator comparison in the UI (needs ORBITAL 0.2).
- Inclined orbits by rotating the 2D solution (exact for a point-mass Earth by symmetry); needs a ground-track and epoch decision first.
- Real star catalogue fixed in the inertial frame (no random starfield).
- Light or projector theme (tokens make it cheap).
- Tablet-specific high-fidelity frames (drawer layout is specified in the design system; frames deferred).
- More tested conditions: each needs a pre-registered v0.1.1-style case.
