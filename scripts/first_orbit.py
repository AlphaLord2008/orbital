"""ORBITAL 0.1 reference case: propagate, report metrics, and plot (Requirements F9, F10, N2).

Run from the repository root with the virtual environment active:

    python scripts/first_orbit.py

It propagates the reference circular orbit (400 km altitude, semi-implicit Euler,
dt = 1 s, 10 orbits), prints the acceptance metrics T3-T8 with the information
needed to reproduce them, and saves output/first_orbit.png.

This script lives outside the ``orbital`` package on purpose: the physics core
never imports Matplotlib (Requirement I1, test T12). All plotting happens here.
"""

import math
import platform
import subprocess
import sys
import time
from pathlib import Path

import matplotlib
import numpy as np
from matplotlib.figure import Figure
from matplotlib.lines import Line2D
from matplotlib.patches import Circle

import orbital
from orbital import (
    MU_EARTH,
    R_EARTH,
    Trajectory,
    angular_momentum_z,
    circular_initial_state,
    first_period,
    propagate,
    radius,
    specific_energy,
    steps_for_duration,
)

ALTITUDE = 400_000.0  # [m]
DT = 1.0  # [s]
N_ORBITS = 10
M_PER_KM = 1000.0


def analytical_period(orbit_radius: float, mu: float = MU_EARTH) -> float:
    """T = 2 pi sqrt(r^3 / mu) [s]."""
    return 2 * math.pi * math.sqrt(orbit_radius**3 / mu)


def plot_trajectory(trajectory: Trajectory) -> tuple[Figure, Line2D]:
    """Plot Earth to scale and the trajectory in km (Requirement F9).

    Returns the figure and the trajectory's line, so tests can check that the
    plotted data is exactly the computed data (test T11).
    """
    fig = Figure(figsize=(7, 7))
    ax = fig.add_subplot()

    earth = Circle((0.0, 0.0), R_EARTH / M_PER_KM, color="#8fb3d9", zorder=1, label="Earth (to scale)")
    ax.add_patch(earth)

    # Unit conversion happens only here, at the output edge (Requirement N3).
    x_km = trajectory.r[:, 0] / M_PER_KM
    y_km = trajectory.r[:, 1] / M_PER_KM
    (line,) = ax.plot(x_km, y_km, color="#c0392b", linewidth=0.8, zorder=2, label="Spacecraft trajectory")
    ax.plot(x_km[0], y_km[0], "o", color="black", markersize=4, zorder=3, label="Start")

    r0, v0 = trajectory.r[0], trajectory.v[0]
    annotation = "\n".join(
        [
            f"r0 = ({r0[0] / M_PER_KM:,.3f}, {r0[1] / M_PER_KM:,.3f}) km",
            f"v0 = ({v0[0] / M_PER_KM:.6f}, {v0[1] / M_PER_KM:.6f}) km/s",
            f"Integrator: semi-implicit Euler, dt = {trajectory.dt:g} s",
            f"t_end = {trajectory.t_end:,.0f} s ({len(trajectory.t) - 1:,} steps, status: {trajectory.status})",
        ]
    )
    # Annotation and legend sit outside the axes so they never cover the orbit.
    ax.text(0.0, -0.10, annotation, transform=ax.transAxes, va="top", fontsize=8, family="monospace",
            bbox={"facecolor": "white", "edgecolor": "#999999"})

    ax.set_aspect("equal")
    ax.set_xlabel("x [km]")
    ax.set_ylabel("y [km]")
    ax.set_title("ORBITAL 0.1: two-body orbit, Earth-centred inertial frame")
    ax.legend(loc="upper left", bbox_to_anchor=(1.02, 1.0), fontsize=8)
    ax.grid(True, linewidth=0.3)
    limit = 1.15 * float(np.max(radius(trajectory.r))) / M_PER_KM
    ax.set_xlim(-limit, limit)
    ax.set_ylim(-limit, limit)
    return fig, line


def acceptance_metrics(trajectory: Trajectory, coarse: Trajectory, orbit_radius: float) -> list[tuple[str, float, str, bool]]:
    """T3-T8 metrics for the reference run: (name, value, tolerance text, passed)."""
    period = analytical_period(orbit_radius)
    t = trajectory.t

    def rel_dev(values):
        return np.abs(values - values[0]) / abs(values[0])

    def max_in_orbit(dev, orbit):
        mask = (t >= (orbit - 1) * period) & (t < orbit * period)
        return float(np.max(dev[mask]))

    h_dev = rel_dev(angular_momentum_z(trajectory.r, trajectory.v))
    r_dev = rel_dev(radius(trajectory.r))
    e_dev = rel_dev(specific_energy(trajectory.r, trajectory.v))
    omega = 2 * math.pi / period

    def position_error(k):
        exact = orbit_radius * np.array([math.cos(omega * t[k]), math.sin(omega * t[k])])
        return float(np.linalg.norm(trajectory.r[k] - exact))

    k_one = steps_for_duration(period, trajectory.dt)
    coarse_dev = rel_dev(radius(coarse.r))
    t8 = float(np.max(coarse_dev) / np.max(r_dev))
    t4_growth = max_in_orbit(r_dev, N_ORBITS) / max_in_orbit(r_dev, 1)
    t5_growth = max_in_orbit(e_dev, N_ORBITS) / max_in_orbit(e_dev, 1)
    t6 = abs(first_period(trajectory) - period) / period

    return [
        ("T3 max |dh/h0|", float(np.max(h_dev)), "<= 1e-10", np.max(h_dev) <= 1e-10),
        ("T4 max |dr/r0|", float(np.max(r_dev)), "<= 1e-3", np.max(r_dev) <= 1e-3),
        ("T4 orbit 10 / orbit 1", t4_growth, "<= 1.1", t4_growth <= 1.1),
        ("T5 max |de/e0|", float(np.max(e_dev)), "<= 1e-5", np.max(e_dev) <= 1e-5),
        ("T5 orbit 10 / orbit 1", t5_growth, "<= 1.1", t5_growth <= 1.1),
        ("T6 |t* - T| / T", t6, "<= 1e-5", t6 <= 1e-5),
        (f"T7 position error, {k_one} steps [m]", position_error(k_one), "<= 100", position_error(k_one) <= 100.0),
        (f"T7 position error, {len(t) - 1} steps [m]", position_error(len(t) - 1), "recorded", True),
        ("T8 radius error ratio dt=10 / dt=1", t8, "9 to 11", 9.0 <= t8 <= 11.0),
    ]


def git_commit() -> str:
    """Current commit hash, with "+uncommitted changes" if the tree is dirty; "unknown" outside Git."""
    try:
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True).stdout.strip()
        return commit + (" +uncommitted changes" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def main(output_dir: Path = Path("output")) -> int:
    """Run the reference case, print the report, save the plot. Returns 0 if T3-T8 all pass."""
    r0, v0 = circular_initial_state(ALTITUDE)
    orbit_radius = float(r0[0])
    period = analytical_period(orbit_radius)
    duration = N_ORBITS * period
    n_steps = steps_for_duration(duration, DT)

    start = time.perf_counter()
    trajectory = propagate(r0, v0, DT, n_steps)
    runtime = time.perf_counter() - start
    coarse = propagate(r0, v0, 10.0, steps_for_duration(duration, 10.0))

    rows = acceptance_metrics(trajectory, coarse, orbit_radius)
    all_passed = all(passed for *_, passed in rows)

    print("ORBITAL 0.1 reference case")
    print("=" * 66)
    print(f"Constants        mu_E = {MU_EARTH:.9e} m^3/s^2, R_E = {R_EARTH:,.1f} m (WGS 84)")
    print(f"Initial state    r0 = ({r0[0]:,.1f}, {r0[1]:.1f}) m, v0 = ({v0[0]:.1f}, {v0[1]:.10f}) m/s")
    print(f"Integrator       semi-implicit Euler, dt = {DT:g} s")
    print(f"Duration         requested {duration:,.6f} s ({N_ORBITS} x T), t_end = {trajectory.t_end:,.1f} s, "
          f"{n_steps:,} steps, status {trajectory.status}")
    print(f"Runtime          {runtime:.2f} s (N4 limit 10 s)")
    print(f"Software         Python {platform.python_version()}, NumPy {np.__version__}, "
          f"Matplotlib {matplotlib.__version__}, orbital {orbital.__version__}, commit {git_commit()}")
    print("-" * 66)
    print(f"{'Metric':40s} {'Value':>12s}  {'Tolerance':>10s}  Result")
    for name, value, tolerance, passed in rows:
        result = "—" if tolerance == "recorded" else ("PASS" if passed else "FAIL")
        print(f"{name:40s} {value:12.4g}  {tolerance:>10s}  {result}")
    print("-" * 66)
    print("All acceptance metrics pass." if all_passed else "SOME ACCEPTANCE METRICS FAIL.")

    output_dir.mkdir(parents=True, exist_ok=True)
    plot_path = output_dir / "first_orbit.png"
    fig, _ = plot_trajectory(trajectory)
    fig.savefig(plot_path, dpi=150, bbox_inches="tight")
    print(f"Plot saved to {plot_path}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
