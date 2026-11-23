"""Acceptance test T12: the physics core must not depend on plotting (Requirement I1).

Runs in a fresh subprocess, because other tests may import Matplotlib into
this process and would hide the problem.
"""

import subprocess
import sys


def test_t12_importing_orbital_does_not_load_matplotlib():
    code = "import sys, orbital; print('matplotlib' in sys.modules)"
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
    assert result.stdout.strip() == "False"
