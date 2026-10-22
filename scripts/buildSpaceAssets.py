# Usage: python3 scripts/buildSpaceAssets.py public/space node_modules/three-globe/example/img
# Builds the login screen's static space assets (decorative, procedurally generated except the
# Earth texture, which is NASA Blue Marble from three-globe's examples).
import sys, math, random
import numpy as np
from PIL import Image, ImageFilter
out = sys.argv[1]; src = sys.argv[2]
rng = np.random.default_rng(7)

# 1. Earth texture: 4096 -> 2048 WebP + JPEG fallback; topology bump 1024 JPEG.
e = Image.open(f'{src}/earth-blue-marble.jpg').convert('RGB').resize((2048, 1024), Image.LANCZOS)
e.save(f'{out}/earth-2k.webp', 'WEBP', quality=78, method=6)
e.save(f'{out}/earth-2k.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
Image.open(f'{src}/earth-topology.png').convert('L').resize((1024, 512), Image.LANCZOS).save(f'{out}/earth-bump-1k.jpg', 'JPEG', quality=75, optimize=True)

def fbm(n, octaves=6, seed=0):
    r = np.random.default_rng(seed); acc = np.zeros((n, n)); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(2, 2 ** (o + 2))
        g = r.random((s, s))
        acc += amp * np.array(Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC), dtype=float) / 255
        tot += amp; amp *= 0.55
    return acc / tot

def sphere_shade(n, light=(-0.55, -0.45, 0.70)):
    y, x = np.mgrid[0:n, 0:n]; cx = (n - 1) / 2
    nx = (x - cx) / cx; ny = (y - cx) / cx; rr = nx ** 2 + ny ** 2
    mask = rr <= 1.0; nz = np.sqrt(np.clip(1 - rr, 0, 1))
    L = np.array(light); L = L / np.linalg.norm(L)
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    edge = np.clip((1 - np.sqrt(rr)) * n / 3, 0, 1)  # anti-aliased rim
    return mask, lam, nz, edge, nx, ny

# 2. Moon: fbm base, darker maria, craters with bright rims, lit from the upper left.
N = 384
base = 0.55 + 0.35 * fbm(N, 7, 1)
maria = fbm(N, 3, 2); base -= np.where(maria > 0.5, (maria - 0.5) * 1.9, 0)
y, x = np.mgrid[0:N, 0:N]
for _ in range(90):
    cx, cy = rng.uniform(0, N, 2); r = rng.uniform(2, 22) * (rng.random() ** 1.6 + 0.15)
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    base -= 0.08 * np.exp(-((d / 0.85) ** 4)) ; base += 0.05 * np.exp(-((d - 1.0) ** 2) / 0.03)
base = np.clip(base, 0, 1)
mask, lam, nz, edge, _, _ = sphere_shade(N)
shade = 0.06 + 0.94 * lam ** 0.85
grey = np.clip(base * shade * 255 * 1.05, 0, 255)
rgb = np.stack([grey * 1.0, grey * 0.98, grey * 0.94], -1)
a = (edge * 255).astype(np.uint8)
Image.fromarray(np.dstack([rgb.astype(np.uint8), a])).resize((256, 256), Image.LANCZOS).save(f'{out}/moon.webp', 'WEBP', quality=82, method=6)

# 3. Distant gas giant: soft amber bands, lit from the left, with a faint atmosphere.
N = 320
mask, lam, nz, edge, nx, ny = sphere_shade(N, light=(-0.75, -0.2, 0.62))
lat = np.arcsin(np.clip(ny, -1, 1))
turb = fbm(N, 5, 3)
bands = 0.5 + 0.5 * np.sin(lat * 9 + turb * 2.2)
c1 = np.array([214, 160, 112]); c2 = np.array([140, 92, 70])
col = c1 * bands[..., None] + c2 * (1 - bands[..., None])
shade = 0.04 + 0.96 * lam ** 0.9
rgb = np.clip(col * shade[..., None], 0, 255)
Image.fromarray(np.dstack([rgb.astype(np.uint8), (edge * 255).astype(np.uint8)])).resize((200, 200), Image.LANCZOS).save(f'{out}/planet-giant.webp', 'WEBP', quality=80, method=6)

# 4. Small rocky red planet.
N = 160
mask, lam, nz, edge, nx, ny = sphere_shade(N, light=(-0.6, -0.5, 0.62))
t = fbm(N, 6, 4)
col = np.stack([150 + 70 * t, 70 + 40 * t, 50 + 25 * t], -1)
rgb = np.clip(col * (0.05 + 0.95 * lam ** 0.9)[..., None], 0, 255)
Image.fromarray(np.dstack([rgb.astype(np.uint8), (edge * 255).astype(np.uint8)])).resize((96, 96), Image.LANCZOS).save(f'{out}/planet-red.webp', 'WEBP', quality=80, method=6)
print('ok')

# 5. Static Earth: orthographic render centred on India (lat 20, lon 80), lit from the upper left,
#    with a thin blue atmosphere rim. Used when the 3D globe is off (no WebGL, software GL, Lite).
src_tex = np.asarray(Image.open(f'{src}/earth-blue-marble.jpg').convert('RGB'), dtype=float)
TH, TW = src_tex.shape[:2]
N = 900; PAD = 40; S = N + 2 * PAD
lat0, lon0 = math.radians(20), math.radians(80)
yy, xx = np.mgrid[0:S, 0:S]
x = (xx - S / 2) / (N / 2); y = -(yy - S / 2) / (N / 2)
rho = np.sqrt(x ** 2 + y ** 2); inside = rho <= 1
c = np.arcsin(np.clip(rho, 0, 1))
with np.errstate(invalid='ignore', divide='ignore'):
    lat = np.arcsin(np.clip(np.cos(c) * math.sin(lat0) + np.where(rho > 0, y * np.sin(c) * math.cos(lat0) / rho, 0), -1, 1))
    lon = lon0 + np.arctan2(x * np.sin(c), rho * np.cos(c) * math.cos(lat0) - y * np.sin(c) * math.sin(lat0))
u = ((lon + math.pi) / (2 * math.pi) % 1) * (TW - 1); v = ((math.pi / 2 - lat) / math.pi) * (TH - 1)
col = src_tex[np.clip(v.astype(int), 0, TH - 1), np.clip(u.astype(int), 0, TW - 1)]
nz = np.sqrt(np.clip(1 - rho ** 2, 0, 1))
L = np.array([-0.5, 0.45, 0.74]); L /= np.linalg.norm(L)
lam = np.clip(x * L[0] + y * L[1] + nz * L[2], 0, 1)
shade = 0.18 + 0.95 * lam ** 0.8
rgb = col * shade[..., None]
limb = np.clip(1 - nz, 0, 1) ** 2.2  # blue haze toward the limb
rgb = rgb * (1 - 0.45 * limb[..., None]) + np.array([90, 170, 255]) * (0.45 * limb[..., None])
alpha = np.where(inside, np.clip((1 - rho) * N / 2, 0, 1), 0)
# atmosphere halo just outside the disc
halo = np.where(~inside, np.clip(1 - (rho - 1) / 0.08, 0, 1) ** 3.2, 0) * 0.32
out_rgb = np.where(inside[..., None], rgb, np.array([79, 179, 255]))
out_a = np.maximum(alpha, halo)
img = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255).astype(np.uint8), (out_a * 255).astype(np.uint8)]))
img.resize((720, 720), Image.LANCZOS).save(f'{out}/earth-india-720.webp', 'WEBP', quality=82, method=6)
img.resize((720, 720), Image.LANCZOS).save(f'{out}/_preview-earth.png')
print('static earth ok')
