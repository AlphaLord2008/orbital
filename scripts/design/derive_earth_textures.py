"""Derive the web Earth textures from the NASA Blue Marble original (WA-6, ADR-0004 §2).

Source (downloaded from NASA, not a redistribution):
  NASA Earth Observatory, Blue Marble: Next Generation with Topography and Bathymetry,
  December 2004, 21600 x 10800 (2 km/pixel), file world.topo.bathy.200412.3x21600x10800.jpg
  https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december/world.topo.bathy.200412.3x21600x10800.jpg
  (linked from https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/,
  where https://visibleearth.nasa.gov/images/73909 now redirects)

Usage:
  python scripts/design/derive_earth_textures.py <original.jpg> web/apps/web/src/assets

Requires Pillow (development only; not a runtime or package dependency). The script refuses an
input whose SHA-256 differs from the original recorded in docs/validation/wa6/earth-texture.md,
so every shipped texture traces back to that exact NASA file.

Resampling: Lanczos in a single step from the original (no chained halvings), sRGB preserved,
no sharpening, no colour adjustment. Output is WebP (lossy), quality chosen per size so the
first texture stays within the 400 KB budget (requirements §6.2).
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from PIL import Image

ORIGINAL_SHA256 = "3006c58b1272362db0a8c2df02dc07cea4b12dfe820b7dc4a159a075caf5d4d4"
# (width, quality): 2K is the first texture (all classes), 4K for B/C, 8K for class A.
SIZES = ((2048, 82), (4096, 84), (8192, 86))

Image.MAX_IMAGE_PIXELS = 21600 * 10800


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(src: str, out_dir: str) -> None:
    src_path = Path(src)
    digest = sha256(src_path)
    if digest != ORIGINAL_SHA256:
        sys.exit(f"{src_path} has SHA-256 {digest}, not the recorded NASA original")
    img = Image.open(src_path).convert("RGB")
    if img.size != (21600, 10800):
        sys.exit(f"unexpected size {img.size}")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for width, quality in SIZES:
        small = img.resize((width, width // 2), Image.Resampling.LANCZOS)
        name = out / f"earth-{width // 1024}k.webp"
        small.save(name, "WEBP", quality=quality, method=6)
        print(f"{name}  {width}x{width // 2}  {name.stat().st_size / 1024:.0f} KB  sha256 {sha256(name)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
