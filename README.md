# ORBITAL

A physics-based orbital mechanics simulator, built from first principles and validated against analytical results.

The long-term goal is an interactive environment for learning orbital mechanics: simulation, visualization, and explanations grounded in validated calculations.

## Status

**ORBITAL 0.1 "First Orbit" is in development. The simulator does not exist yet.**

This repository currently contains the accepted requirements and architecture decisions, the WGS 84 constants, and a tested gravitational-acceleration function. It cannot propagate an orbit yet; that arrives in Tasks 4–5.

| Milestone | Status |
| --- | --- |
| 0.0 Planning: requirements, architecture decisions | Complete |
| 0.1 First Orbit: validated 2D two-body propagator | In progress |

### 0.1 progress

| # | Task | Status |
| --- | --- | --- |
| 1 | Physics reference calculations | Done |
| 2 | Repository, environment, first passing test | Done |
| 3 | Constants and gravitational acceleration | Done |
| 4 | Semi-implicit Euler step | Not started |
| 5 | Propagation loop, endpoint and impact policies | Not started |
| 6 | Diagnostics (energy, angular momentum, period) | Not started |
| 7 | Circular-orbit validation tests | Not started |
| 8 | Trajectory plot | Not started |
| 9 | Validation report | Not started |
| 10 | Review and tag v0.1.0 | Not started |

## What 0.1 will do (planned)

- Propagate one spacecraft around a point-mass Earth in a 2D Earth-centred inertial frame, in SI units and float64.
- Integrate with fixed-step semi-implicit (symplectic) Euler.
- Plot the trajectory to scale.
- Prove the numerical accuracy against the exact circular-orbit solution with 12 quantitative acceptance tests: angular-momentum conservation, bounded radius and energy error, orbital period, position error, first-order convergence, input validation and more.

0.1 deliberately excludes 3D motion, perturbations, maneuvers, interactive visualization and any AI features. See [`BACKLOG.md`](BACKLOG.md).

## Documentation

- [`docs/requirements-0.1.md`](docs/requirements-0.1.md): what 0.1 must do, and its acceptance tests.
- [`docs/decisions/`](docs/decisions/): architecture decision records (ADRs).
- [`docs/reference-values.md`](docs/reference-values.md): hand-checkable reference values for a 400 km circular orbit.

## Development setup

Requires Python 3.12 (3.11 minimum) on macOS or Linux.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
pytest
```

## Repository layout

```
src/orbital/   physics engine package (NumPy only; no I/O or plotting)
tests/         pytest test suite
docs/          requirements, decisions, reference values
```

## License

Copyright © 2026 Harshith Vaibhav. All rights reserved.

The source is published for viewing. No license is granted to copy, modify or distribute it.
