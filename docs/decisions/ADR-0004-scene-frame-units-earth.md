# ORBITAL ADR-0004: Scene frame, units and Earth rendering

| | |
| --- | --- |
| **Status** | Accepted (2026-11-23), decisions D4 and D5 |
| **Date** | 2026-11-23 |
| **Decider** | Harshith Vaibhav |
| **Advisors** | Claude; ChatGPT (review) |
| **Scope** | Web Alpha 3D view. The physics frame stays ADR-0002's. |

**Decision:** map the engine's idealised ECI frame into the Three.js scene with one proper rotation and one unit scale, both in a single module (`frame.ts`). Draw the Earth at true scale from `R_EARTH`, rotating at the WGS 84 rate from a disclosed arbitrary orientation, lit only by a camera-attached light.

## 1. Mapping

```
[X, Y, Z]_scene,km = (1/1000) · [[1, 0, 0], [0, 0, 1], [0, −1, 0]] · [x, y, z]_engine,m    (z = 0)
```

- Determinant +1, so this is a rotation, not a reflection. X × (−Z) = +Y: right-handedness is preserved.
- A counter-clockwise engine orbit (h > 0) appears counter-clockwise seen from scene +Y (north).
- 1 scene unit = 1 km. Physics and the worker stay in SI metres (ADR-0002). Conversion happens only in `frame.ts`.

## 2. Earth

| Aspect | Decision | Reason |
| --- | --- | --- |
| Radius | `R_EARTH / 1000` from the shared constants module, never typed | The drawn surface must equal the impact boundary |
| Texture | NASA Blue Marble Next Generation, downloaded from NASA, credited "NASA Earth Observatory". Class A gets 8K; B and C 4K; D 2K (KTX2 if profiling demands) | Public imagery; memory budgets (requirements §6) |
| Rotation | θ(t) = θ₀ + ω_E·t, ω_E = 7.292115 × 10⁻⁵ rad/s (WGS 84), θ₀ = 0 | In an inertial frame the Earth does rotate; a static globe would be less truthful |
| Orientation | Arbitrary: no epoch, so no longitude is meaningful. Stated on the methodology page | Avoids implying a real date or ground track |
| Lighting | Camera-attached (headlight): shade = 0.42 + 0.58·(n·v)^0.55 in the WA-0 renders. No terminator, no Sun direction | No Sun is modelled (WA-D6) |
| Limb | A 1.6 px inner rim at 25% opacity; nothing outside the disc | Makes the true-scale edge legible without a decorative glow |
| Stars | None | A random starfield implies a sky the model does not contain |

## 3. Precision and depth

- GPU positions are float32 (relative spacing 6 × 10⁻⁸): 0.4 m at LEO and 2.5 m at GEO, against about 600 m per pixel at the closest camera (1,000 km). No relative-to-eye rendering is needed for Web Alpha.
- Depth range: near 10 km, far 10⁶ km, with a logarithmic depth buffer. WA-3 must show a LEO line 400 km above the surface never wrongly occluded.
- Orbit lines are hidden where the Earth occludes them. This is a depth test in production; the WA-0 renders use a ray–sphere test.

## 4. Camera

Presets: Top-down north (looking along −Y), Oblique (elevation 25–35°), Fit orbit (frames the run's extent). Minimum distance 1,000 km from the target. Orbit-drag and zoom; no pan away from the Earth in Web Alpha.

## 5. Tests (WA-3)

Determinant and handedness; round trip engine → scene → engine within 1 ulp relative; CCW orbit gives +Y angular velocity; scene radius equals `R_EARTH / 1000` exactly; Earth angle after 2π/ω_E is 2π within 10⁻¹² rad; occlusion test scene.

## 6. Evidence from WA-0

The design renders (`docs/design/renders/`) use this mapping, `R_EARTH`, the WGS 84 rotation rate, headlight shading and true-scale engine trajectories. The occlusion behaves as specified, with the orbit's far side hidden behind the Earth.

## 7. Revision history

| Rev | Date | Change |
| --- | --- | --- |
| 1 | 2026-11-23 | Accepted. |
