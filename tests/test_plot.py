"""Acceptance test T11 and checks on scripts/first_orbit.py (Requirements F9, F10).

The script is loaded from its file path because scripts/ is not a package:
plotting deliberately lives outside the ``orbital`` package (Requirement I1).
"""

import importlib.util
from pathlib import Path

import numpy as np
import pytest

from orbital import R_EARTH, circular_initial_state, propagate

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "first_orbit.py"


@pytest.fixture(scope="module")
def first_orbit():
    spec = importlib.util.spec_from_file_location("first_orbit", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def short_trajectory():
    r0, v0 = circular_initial_state(400_000.0)
    return propagate(r0, v0, 1.0, 600)


def test_t11_plotted_line_is_exactly_the_trajectory_in_km(first_orbit, short_trajectory):
    _, line = first_orbit.plot_trajectory(short_trajectory)
    x, y = line.get_data()
    np.testing.assert_array_equal(x, short_trajectory.r[:, 0] / 1000)
    np.testing.assert_array_equal(y, short_trajectory.r[:, 1] / 1000)


def test_f9_earth_to_scale_equal_aspect_and_labelled_axes(first_orbit, short_trajectory):
    fig, _ = first_orbit.plot_trajectory(short_trajectory)
    ax = fig.axes[0]
    earth = ax.patches[0]
    assert earth.get_radius() == R_EARTH / 1000
    assert ax.get_aspect() == 1.0  # "equal"
    assert "[km]" in ax.get_xlabel() and "[km]" in ax.get_ylabel()


def test_f9_annotation_states_initial_conditions_integrator_and_end_time(first_orbit, short_trajectory):
    fig, _ = first_orbit.plot_trajectory(short_trajectory)
    text = " ".join(t.get_text() for t in fig.axes[0].texts)
    for expected in ["r0 =", "v0 =", "semi-implicit Euler", "dt = 1 s", "t_end = 600 s"]:
        assert expected in text


def test_f10_script_runs_end_to_end(first_orbit, tmp_path, capsys):
    exit_code = first_orbit.main(output_dir=tmp_path)
    out = capsys.readouterr().out
    assert exit_code == 0
    assert "All acceptance metrics pass." in out
    for label in ["T3", "T4", "T5", "T6", "T7", "T8", "Python", "commit"]:
        assert label in out
    png = tmp_path / "first_orbit.png"
    assert png.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"  # a real PNG file
