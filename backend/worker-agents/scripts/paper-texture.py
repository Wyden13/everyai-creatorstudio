# Deterministic paper + grain textures for the Vox widgets. Usage: python3 scripts/paper-texture.py assets/textures  (needs numpy, pillow)
import sys, numpy as np
from PIL import Image, ImageFilter
out = sys.argv[1]; W, H = 1920, 1080; rng = np.random.default_rng(7)
def noise(scale):
    small = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((W + 2 * scale, H + 2 * scale), Image.BICUBIC)
    return np.asarray(img, np.float32)[:H, :W] / 255.0
# multi-octave fibres + blotchy stains
n = 0.45 * noise(240) + 0.25 * noise(90) + 0.15 * noise(24) + 0.15 * noise(3)
grain = rng.normal(0, 1, (H, W)).astype(np.float32)
grain = np.asarray(Image.fromarray(((grain * 18) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255 - 0.5
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
vig = ((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2
light = 1.0 - 0.10 * vig - 0.06 * (n - 0.5) * 2 + 0.05 * grain
base = np.array([0xED, 0xE0, 0xC8], np.float32) / 255
paper = (base[None, None, :] * light[..., None]).clip(0, 1)
# warm stains: darken + yellow in a few low-frequency blobs
stain = np.clip((noise(320) - 0.62) * 4, 0, 1)[..., None]
paper = paper * (1 - 0.07 * stain * np.array([0.9, 1.0, 1.35]))
Image.fromarray((paper * 255).astype(np.uint8)).save(f"{out}/paper-1920.jpg", quality=88)
# neutral multiply grain for fills (near-white, mean ~0.93)
g = (0.93 + 0.05 * (n - 0.5) * 2 + 0.07 * grain).clip(0, 1)
Image.fromarray((g * 255).astype(np.uint8), 'L').save(f"{out}/grain-1920.jpg", quality=85)
