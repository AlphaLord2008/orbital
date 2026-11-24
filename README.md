# ORBITAL

A physics-based orbital mechanics simulator, built from first principles and validated against analytical results.

The long-term goal is an interactive environment for learning orbital mechanics: simulation, visualization, and explanations grounded in validated calculations.

## Status

**ORBITAL 0.1 "First Orbit" is in development.** The two-body propagator works and its accuracy is validated against the analytical circular orbit; see the [validation report](docs/validation/v0.1-circular-orbit.md). The v0.1.0 release is still to come.

This repository currently contains the accepted requirements and architecture decisions, the WGS 84 constants, gravitational acceleration, the circular-orbit initial state, and a fixed-step semi-implicit Euler propagator with endpoint and impact handling, all tested. It propagates an orbit, measures its radius, speed, energy, angular momentum and period, and passes acceptance tests T3–T8 against the exact circular-orbit solution.

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
| 4 | Semi-implicit Euler step | Done |
| 5 | Propagation loop, endpoint and impact policies | Done |
| 6 | Diagnostics (energy, angular momentum, period) | Done |
| 7 | Circular-orbit validation tests | Done |
| 8 | Trajectory plot | Done |
| 9 | Validation report | Done |
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
- [`docs/validation/v0.1-circular-orbit.md`](docs/validation/v0.1-circular-orbit.md): validation report — measured results of acceptance tests T3–T8.

## Development setup

Requires Python 3.12 (3.11 minimum) on macOS or Linux.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
pytest
```

## Run the reference case

```bash
source .venv/bin/activate
python scripts/first_orbit.py
```

This propagates a 400 km circular orbit for 10 orbital periods, prints the acceptance metrics (T3–T8) with the versions and commit needed to reproduce them, and saves `output/first_orbit.png`.

## Repository layout

```
src/orbital/   physics engine package (NumPy only; no I/O or plotting)
scripts/       reference-case script: metrics report and plot (Matplotlib)
tests/         pytest test suite
docs/          requirements, decisions, reference values
```

## License

Copyright © 2026 Harshith Vaibhav. All rights reserved.

The source is published for viewing. No license is granted to copy, modify or distribute it.
