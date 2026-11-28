# WA-6 — Earth texture provenance

Closes the WA-3+4 carry-over "NASA texture provenance" (roadmap WA-6). Retrieved 2026-11-27.

## Source

| Item | Value |
|---|---|
| Product | Blue Marble: Next Generation with Topography and Bathymetry, December 2004 |
| Publisher | NASA Earth Observatory (Reto Stöckli, NASA Goddard Space Flight Center) |
| Page | https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/ (https://visibleearth.nasa.gov/images/73909 now redirects here) |
| File | `world.topo.bathy.200412.3x21600x10800.jpg`, 21600 × 10800 (2 km/pixel), equirectangular, JPEG |
| URL | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december/world.topo.bathy.200412.3x21600x10800.jpg |
| Size, SHA-256 | 29,868,040 bytes, `3006c58b1272362db0a8c2df02dc07cea4b12dfe820b7dc4a159a075caf5d4d4` |
| Server `Last-Modified` | Tue, 16 Dec 2025 17:59:33 GMT |

The old host `eoimages.gsfc.nasa.gov` did not answer from this environment (connection timeout); NASA now serves the same files from `assets.science.nasa.gov`.

**Usage terms.** NASA imagery is generally not subject to copyright in the United States (NASA Images and Media Usage Guidelines). Conditions observed: credit NASA (the app and the methodology page credit "NASA Earth Observatory, Blue Marble Next Generation"); no NASA insignia or logo is used; nothing implies NASA endorsement.

## Derived textures

`scripts/design/derive_earth_textures.py` checks the SHA-256 above, resamples once from the original with Lanczos (no chained halvings, no sharpening, no colour change) and writes WebP:

| File | Size | Bytes | Quality | SHA-256 | Loaded when |
|---|---|---|---|---|---|
| `earth-2k.webp` | 2048 × 1024 | 232,028 | 82 | `1dffbe22…c21afffd4` | always, first (budget ≤ 400 KB) |
| `earth-4k.webp` | 4096 × 2048 | 853,206 | 84 | `e3f659f8…3ffec68ca` | disc > 651 device px, classes A–C |
| `earth-8k.webp` | 8192 × 4096 | 3,245,486 | 86 | `aef224d3…bcf69f41` | disc > 1303 device px, class A only |

An equirectangular texture W pixels wide puts W/π texels across the disc at its centre, so a texture is loaded only when the one in use would be magnified (`neededTier` in `earth.ts`). A replaced texture is disposed at once: the GPU holds one Earth texture (RGBA8 with mips: 10.7 / 42.7 / 170.7 MB; budgets ≤ 64 MB on C/D, ≤ 192 MB on A).

## What it replaced

The WA-3 textures (`earth-2k.jpg`, `earth-4k.jpg`) were the three-globe redistribution of Blue Marble. Compared with the NASA original they were a different month (no December snow over Anatolia and the Caucasus, unlike the approved D1 render) and sat about 30 rows lower at 4K (≈ 2.6° of latitude). The NASA original fixes both and is 28 % smaller at 2K.

## Lighting

The WA-0 renders shade in linear light as `colour × (0.42 + 0.58·(n·v)^0.55) × 1.18` (`scripts/design/render.py`, `render_earth`; ADR-0004 §2). WA-3 had implemented `colour × shade^2.2`, which darkens the limb to 15 % instead of 50 % and the centre by a further 18 %. WA-6 restores the approved model and its rim colour (0.55, 0.68, 0.82). No terminator, no Sun, nothing drawn outside the disc.
