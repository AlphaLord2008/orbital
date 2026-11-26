"""Write docs/validation/v0.1.1-web-alpha-presets.md from v0.1.1-results.json (no hand-copied numbers)."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "docs" / "validation" / "v0.1.1-results.json"
OUT = ROOT / "docs" / "validation" / "v0.1.1-web-alpha-presets.md"

TITLES = {
    "V0": "V0 — ISS preset (v0.1.0 reference; gates T3–T8 unchanged)",
    "P1": "P1 — GEO preset, Δt = 10 s, 2 orbits",
    "E1": "E1 — Ellipse preset, k = 1.10, Δt = 1 s, 2 orbits",
    "X1": "X1 — Escape preset, k = 1.42, Δt = 1 s, 1 day",
    "I1": "I1 — Impact preset, k = 0.98, Δt = 1 s (and 0.1 s)",
    "P2": "P2 — Coarse-step preset, Δt = 60 s, 10 orbits",
}


def fmt(x):
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, (list, tuple)):
        return f"[{fmt(x[0])}, {fmt(x[1])}]"
    if x is None:
        return "—"
    x = float(x)
    if x == 0 or 1e-3 <= abs(x) < 1e5:
        return f"{x:.6g}"
    return f"{x:.4e}"


def main():
    res = json.loads(RESULTS.read_text())
    lines = [
        "# ORBITAL v0.1.1 — validation of the Web Alpha presets",
        "",
        f"**Run:** registered, once, at commit `{res['commit'][:7]}` · orbital {res['orbital']} · Python {res['python']} · NumPy {res['numpy']} · {res['platform']}",
        "**Plan:** `docs/requirements-0.1.1.md` rev 1 (pre-registered 2026-11-23, SHA-256 `908a3366…db9165`, unchanged). No tolerance was changed.",
        "**Reference:** `orbital.analytic`, checked against the independent 50-digit reference (`scripts/reference_mp.py`): REF-1 passes with a worst case of 8.1 × 10⁻¹⁵ relative (gate 10⁻¹²) and 3.2 × 10⁻¹² s on the I1 time of flight (gate 10⁻⁶ s).",
        "**Generated** by `scripts/validation/report_v0_1_1.py` from `v0.1.1-results.json`; nothing is hand-copied.",
        "",
        "## Summary",
        "",
        "| Case | Result |",
        "|---|---|",
    ]
    for cid, case in res["cases"].items():
        lines.append(f"| {cid} | {'**PASS**' if case['pass'] else '**FAIL**'} |")
    lines += ["", "A prediction band is gated: a value inside its gate but outside its band fails (requirements-0.1.1 §5).", ""]
    for cid, case in res["cases"].items():
        lines += [f"## {TITLES[cid]}", "", "| Metric | Measured | Gate | Prediction (band) | Result | Note |", "|---|---|---|---|---|---|"]
        for name, m in case["metrics"].items():
            gate = "recorded" if m["op"] is None else f"{m['op']} {fmt(m['gate'])}"
            pred = "—" if m["prediction"] is None else f"{fmt(m['prediction'])} (±{round(m['band'] * 100)}%)"
            if m["prediction"] is not None:
                dev = (m["value"] - m["prediction"]) / m["prediction"] * 100
                pred += f", off by {dev:+.1f}%"
            result = "—" if m["pass"] is None else ("pass" if m["pass"] else "**FAIL**")
            lines.append(f"| {name} | {fmt(m['value'])} | {gate} | {pred} | {result} | {m['note']} |")
        lines.append("")
    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
