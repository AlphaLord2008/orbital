# ORBITAL

A physics-based orbital mechanics simulator, built from first principles and validated against analytical results.

The long-term goal is an interactive environment for learning orbital mechanics: simulation, visualization, and explanations grounded in validated calculations.

## Status

**ORBITAL 0.1.0 "First Orbit" is released.** It is a two-body orbit propagator whose accuracy is validated against the exact circular-orbit solution; see the [validation report](docs/validation/v0.1-circular-orbit.md) and the [release notes](docs/releases/v0.1.0.md).

| Milestone | Status |
| --- | --- |
| 0.0 Planning: requirements, architecture decisions | Complete |
| 0.1 First Orbit: validated 2D two-body propagator | **Released (v0.1.0)** |
| Web Alpha: browser simulator (TypeScript engine in a Web Worker, validated against this Python package) | **In development:** WA-0 design complete; WA-1 scaffold, CI and hosting in progress ([roadmap](docs/roadmap-web-alpha.md)) |
| 0.2 Numerical reliability: integrator comparison | Planned, after Web Alpha |

## What 0.1 does

- Propagates one spacecraft around a point-mass Earth in a 2D Earth-centred inertial frame, in SI units and float64.
- Integrates with fixed-step semi-implicit (symplectic) Euler, with a documented endpoint policy, surface-impact detection and non-finite-state errors.
- Measures radius, speed, specific energy, angular momentum and orbital period.
- Plots the trajectory to scale.
- Passes 12 quantitative acceptance tests (166 automated tests in total), including angular-momentum conservation, bounded radius and energy error, period and position against the exact solution, and first-order convergence.

0.1 deliberately excludes 3D motion, perturbations, maneuvers, interactive visualization and any AI features. See [`BACKLOG.md`](BACKLOG.md).

## Validation summary

Reference case: 400 km circular orbit, Δt = 1 s, 10 orbits (55,536 steps, 0.57 s).

| Check | Result | Tolerance |
| --- | --- | --- |
| Angular momentum, max relative change | 8.7 × 10⁻¹⁵ | ≤ 10⁻¹⁰ |
| Radius, max relative deviation (bounded, not growing) | 5.7 × 10⁻⁴ | ≤ 10⁻³ |
| Energy, max relative deviation (bounded, not drifting) | 1.3 × 10⁻⁶ | ≤ 10⁻⁵ |
| Orbital period vs analytical | 9.1 × 10⁻⁷ | ≤ 10⁻⁵ |
| Position error after one orbit | 38.7 m | ≤ 100 m |
| Convergence order (error ratio for 10× Δt) | 10.1 | 9 to 11 |

Full method, reproducibility record, interpretation and limitations: [validation report](docs/validation/v0.1-circular-orbit.md).

## Quick start

Requires Python 3.12 (3.11 minimum) on macOS or Linux.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
pytest                          # run the test suite
python scripts/first_orbit.py   # reference case: metrics report and output/first_orbit.png
```

Using the library directly (all units SI):

```python
from orbital import circular_initial_state, first_period, propagate, specific_energy

r0, v0 = circular_initial_state(altitude=400_000.0)       # m, m/s
trajectory = propagate(r0, v0, dt=1.0, n_steps=6_000)      # s
print(first_period(trajectory))                            # ~5553.63 s
print(specific_energy(trajectory.r, trajectory.v)[-1])     # J/kg
```

## Documentation

- [`docs/requirements-0.1.md`](docs/requirements-0.1.md): what 0.1 must do, and its acceptance tests.
- [`docs/decisions/`](docs/decisions/): architecture decision records (ADRs).
- [`docs/reference-values.md`](docs/reference-values.md): reference values for a 400 km circular orbit.
- [`docs/validation/v0.1-circular-orbit.md`](docs/validation/v0.1-circular-orbit.md): validation report.
- [`docs/releases/v0.1.0.md`](docs/releases/v0.1.0.md): release notes.
- [`docs/requirements-web-alpha.md`](docs/requirements-web-alpha.md), [`docs/roadmap-web-alpha.md`](docs/roadmap-web-alpha.md), [`docs/design/`](docs/design/), [`docs/deploy.md`](docs/deploy.md): Web Alpha.

## Repository layout

```
src/orbital/   physics engine package (NumPy only; no I/O or plotting)
scripts/       reference-case script: metrics report and plot (Matplotlib)
tests/         pytest test suite
docs/          requirements, decisions, reference values, validation, releases, design
web/           Web Alpha pnpm workspace: @orbital/engine and the app (Node 26, pnpm 12)
```

Web Alpha development: `cd web && pnpm install && pnpm build && pnpm test` (see [`docs/deploy.md`](docs/deploy.md) for hosting).

## License

Copyright © 2026 Harshith Vaibhav. All rights reserved.

The source is published for viewing. No license is granted to copy, modify or distribute it.
