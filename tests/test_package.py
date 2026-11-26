"""Package-level checks: the package installs and imports, with the released version.

The acceptance tests (T1-T12 in docs/requirements-0.1.md) live in the other test files.
"""

import sys

import orbital


def test_package_imports_with_version():
    # The one v0.1.0 test changed for v0.1.1: it pins the release version string, and
    # requirements-0.1.1 PR-6 requires 0.1.1. See docs/releases/v0.1.1.md.
    assert orbital.__version__ == "0.1.1"


def test_python_meets_minimum_version():
    # ADR-0001: Python 3.12 is the baseline, 3.11 the minimum.
    assert sys.version_info >= (3, 11)
