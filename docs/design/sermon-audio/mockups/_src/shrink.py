"""Keeps every mockup PNG under 300 KB: re-encodes the big ones to an adaptive 256-colour palette (UI mockups lose nothing visible). Run after shoot_place.js."""
import pathlib
from PIL import Image
png = pathlib.Path(__file__).resolve().parents[1] / 'png'
for p in sorted(png.glob('*.png')):
    if p.stat().st_size <= 280_000:
        continue
    im = Image.open(p).convert('RGB')
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(p, optimize=True)
    print('shrunk', p.name, p.stat().st_size)
over = [(p.name, p.stat().st_size) for p in png.glob('*.png') if p.stat().st_size > 300_000]
print('still over 300 KB:', over)
