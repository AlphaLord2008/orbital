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
