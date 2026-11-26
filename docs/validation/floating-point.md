# Floating-point reproducibility

**What varies.** `np.linalg.norm` on a vector calls OpenBLAS `dnrm2`. OpenBLAS picks its kernel from the host CPU (SkylakeX, Haswell, Zen, …), and the kernels differ in the last ulp. The Python engine uses `norm` in `gravity_accel` and the diagnostics, so its output depends on the CPU at roundoff level.

**How large.**
- Measured on the conformance runs: up to 6.2 × 10⁻¹³ relative in position after 55,536 steps.
- The drift statistic of angular momentum changes by up to 43 % relative, since it is roundoff (ADR-0003 §4a).
- No scientific gate comes close. The registered v0.1.1 results pass on every kernel, and they are kept as recorded (`v0.1.1-results.json`, AVX-512 host).

**What is pinned, and where.** Only fixture generation is pinned, because fixtures are compared byte for byte:
- `scripts/generate_fixtures.py` requires `OPENBLAS_CORETYPE=Haswell` and `numpy==2.5.5` on x86-64, and records both in each fixture.
- CI regenerates under the same pin and fails on any difference.

**What is not restricted.**
- Tests, validation runs, the engine and the web app run on any platform, Apple Silicon included. NumPy uses Accelerate there, so values can differ at roundoff level; every gate still applies unchanged.
- To regenerate fixtures from a Mac, let CI do it or use an x86-64 container.

**Browser engine.** The TS engine computes |r| as `Math.sqrt(x*x + y*y)`. That expression is correctly rounded, so it is CPU-independent. Its conformance against the Python fixtures uses the ADR-0003 tolerances.
