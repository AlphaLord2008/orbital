# ORBITAL ADR-0001: Language, toolchain and physics-core boundary

| | |
| --- | --- |
| **Status** | Accepted (2026-10-28) |
| **Date** | 2026-10-28 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude (software architecture); ChatGPT (review) |
| **Scope** | ORBITAL only. Unrelated to DELTA ADR-0001. |

**Decision:** build the ORBITAL physics engine in Python 3.12 with NumPy, validate it with pytest and Matplotlib, and keep it a frontend-agnostic library with a strict boundary, so that any future web or desktop frontend can use it without the engine depending on that frontend.

## 1. Context

ORBITAL 0.1 needs a correct, testable two-body propagator built by one part-time developer with introductory Python and foundational C/C++. Separately, ORBITAL's long-term product direction is web-first and desktop-capable (selected 2026-10-28). React, TypeScript, Three.js, React Three Fiber, FastAPI and Tauri are candidate technologies for that future; none is approved.

The tension: a browser product suggests writing physics in a browser language, while learning and validating numerics favours the Python scientific stack. This ADR resolves it for the engine and leaves the frontend open.

## 2. Requirements driving the decision

| ID | Requirement |
| --- | --- |
| R1 | The developer can read, write and debug the language now. |
| R2 | float64 numerics with mature reference tools for validation. |
| R3 | Validation plots with little effort. |
| R4 | Simple, widely used test framework. |
| R5 | The engine must not depend on any frontend, and must be callable by different future frontends. |
| R6 | Minimal dependencies. |

## 3. Options considered

| Option | Assessment |
| --- | --- |
| **A. Python + NumPy, with Matplotlib and pytest for validation** | Meets R1–R6. Slow inner loops, irrelevant at 0.1 scale. Leaves a future browser or desktop integration path to be chosen (§6). |
| B. TypeScript physics from day one | JavaScript numbers are IEEE 754 doubles, so float64 numerics are possible, and it would run in a browser or Tauri webview directly. Fails R1 (new language) and weakens R2–R3: no NumPy/SciPy-grade reference tools for validation. Premature for a frontend that is not yet scoped. |
| C. C++ (or Rust) core | Fast and embeddable in many frontends. Fails R1 for Rust, strains it for C++; build tooling and plotting cost time before any physics is validated. |
| D. Julia | Strong numerics. Fails R1; small deployment story for web or desktop. |

## 4. Decision

- **Python version:** 3.12 is the development baseline; 3.11 is the minimum supported version (`requires-python = ">=3.11"`). Code therefore uses no language or standard-library feature newer than 3.11.
- **Runtime dependency:** NumPy only.
- **Development dependencies:** pytest; Matplotlib (plots in `scripts/` only).
- **Environment and tooling:** venv, `pyproject.toml`, Git, GitHub.
- **Physics-core boundary**, specified as 0.1 Requirements **I1–I8**:
    1. The `orbital` package imports only the standard library and NumPy (I1).
    2. Public functions take and return scalars, NumPy float64 arrays and frozen dataclasses of those (I2).
    3. No I/O, printing, plotting, global mutable state, randomness or clock reads in the package; deterministic results (I3).
    4. SI units at every public interface, stated in docstrings (I4).
    5. Invalid inputs raise exceptions; physical outcomes are returned as data (I5).
    6. The public interface is what `orbital/__init__.py` exports (I6).
    7. No HTTP, serialisation, async or frontend code until a frontend milestone is scoped (I7).
    8. Every public entry point validates its inputs: state vectors of shape exactly (2,), finite, real, copied into float64 arrays; no reliance on broadcasting (I8).

Rule 7 is deliberate: clean plain-data interfaces are what make later integration easy. Building an API layer for an unscoped frontend would be speculative abstraction.

## 5. Consequences

**Positive**

- 0.1 effort goes into physics and validation, not tooling.
- The engine can be tested, profiled and reasoned about with no frontend.
- The validated Python engine and its test suite become the reference implementation, whatever frontend path is chosen.

**Negative / accepted costs**

- A browser frontend cannot import Python directly. One of the §6 integration paths will be needed, each with its own cost.
- Python is slower than compiled code. Acceptable until profiling shows otherwise.

## 6. Future integration paths (open; not decided by this ADR)

| Path | How it would work | Main cost |
| --- | --- | --- |
| Python service | A backend (FastAPI is a candidate) wraps the engine; the web frontend calls it; a desktop build could ship Python as a Tauri sidecar process | Hosting for web; bundling Python for desktop |
| Python in the browser | Run the engine client-side via a WebAssembly Python runtime such as Pyodide | Download size and start-up time; feasibility unverified for ORBITAL |
| Port the validated core | Re-implement in TypeScript or Rust, using the Python test suite and recorded results as the golden reference | Two implementations to keep consistent |

These are listed for awareness only. The choice gets its own ADR when the first frontend milestone is scoped, based on that milestone's latency, offline and deployment requirements.

## 7. Revisit when

- The first frontend milestone is scoped (decides §6).
- Profiling shows a runtime problem that algorithmic fixes cannot solve.
- A validation need appears that Matplotlib cannot meet.

## 8. Validation

- A fresh clone installs and passes `pytest` under Python 3.12.
- Before tagging v0.1.0, the test suite also passes once under Python 3.11, confirming the minimum-version claim.
- Acceptance test T12 passes: `import orbital` in a fresh process does not load Matplotlib.
- Acceptance test T9 passes, covering the I8 input checks.
- A review of `src/orbital/` finds no I/O, printing or frontend imports.

## 9. Related

- [0.1 Requirements](../requirements-0.1.md), §3 (interface requirements I1–I8) and §5 (product-direction constraint).
- [ORBITAL ADR-0002](ADR-0002-frame-units-state.md) (frame, units and state).

## 10. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-10-28 | Accepted: Python 3.12 baseline with 3.11 minimum made explicit; boundary rules mapped to Requirements I1–I8, including input validation (I8); validation adds a 3.11 run and T9 |
| 0 | 2026-10-28 | Proposed |
