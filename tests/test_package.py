"""Task 2 placeholder test: proves the package installs and imports.

The real acceptance tests (T1-T12 in docs/requirements-0.1.md) arrive from
Task 3 onward, alongside the code they test.
"""

import sys

import orbital


def test_package_imports_with_version():
    assert orbital.__version__ == "0.1.0.dev0"


def test_python_meets_minimum_version():
    # ADR-0001: Python 3.12 is the baseline, 3.11 the minimum.
    assert sys.version_info >= (3, 11)
