"""
Generates a coherent visual set for the test salon "Frizerski salon Lina".
Used only to populate MARKEC during full UI/UX testing as a real hairdresser.
No external credits, no network calls. PIL only.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math, random

OUT = Path(__file__).parent / "qa-assets" / "frizerka-lina"
OUT.mkdir(parents=True, exist_ok=True)

# ---- palette: warm rose/gold, matches MARKEC 'rose'/'burgundy' themes ----
INK      = (44, 26, 33)
ROSE     = (176, 92, 110)
ROSE_D   = (122, 56, 74)
GOLD     = (198, 160, 96)
CREAM    = (250, 244, 238)
BLUSH    = (242, 218, 214)
WHITE    = (255, 255, 255)
SAND     = (232, 214, 196)

def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/georgiab.ttf" if bold else "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def centered(d, box, text, f, fill):
    x0, y0, x1, y1 = box
    bb = d.textbbox((0, 0), text, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text((x0 + (x1 - x0 - w) / 2 - bb[0], y0 + (y1 - y0 - h) / 2 - bb[1]), text, font=f, fill=fill)

def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img

def arches(d, w, h, color, alpha=40):
    """Soft salon arch motif."""
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = ImageDraw.Draw(overlay)
    for i in range(5):
        cx = int(w * (0.12 + i * 0.19))
        aw, ah = int(w * 0.13), int(h * 0.42)
        y = int(h * 0.12)
        o.arc([cx - aw // 2, y, cx + aw // 2, y + ah], 180, 360, fill=color + (alpha,), width=max(2, w // 180))
        o.line([(cx - aw // 2, y + ah // 2), (cx - aw // 2, h)], fill=color + (alpha // 2,), width=max(2, w // 180))
        o.line([(cx + aw // 2, y + ah // 2), (cx + aw // 2, h)], fill=color + (alpha // 2,), width=max(2, w // 180))
    return Image.alpha_composite(d._image.convert("RGBA"), overlay)

# ---------------- 1. Logo ----------------
def make_logo():
    s = 512
    img = gradient(s, s, BLUSH, CREAM)
    d = ImageDraw.Draw(img)
    cx, cy = s // 2, s // 2
    # gold ring
    d.ellipse([cx - 190, cy - 190, cx + 190, cy + 190], outline=GOLD, width=10)
    d.ellipse([cx - 168, cy - 168, cx + 168, cy + 168], outline=ROSE + (110,) if False else ROSE, width=3)
    # scissors monogram
    f = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 190) if Path("C:/Windows/Fonts/segoeui.ttf").exists() else font(190)
    centered(d, (0, -10, s, s - 30), "✂", f, ROSE_D)
    img = arches(ImageDraw.Draw(img), s, s, ROSE, 22)
    d = ImageDraw.Draw(img)
    centered(d, (0, s - 105, s, s - 20), "L I N A", font(34, True), INK)
    img.save(OUT / "logo-lina.png", quality=95)

# ---------------- 2. Hero ----------------
def make_hero():
    w, h = 1600, 900
    img = gradient(w, h, (255, 247, 243), BLUSH)
    # soft glow
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w * 0.52, -180, w * 1.05, h * 0.9], fill=(198, 160, 96, 42))
    gd.ellipse([-160, h * 0.42, w * 0.42, h * 1.25], fill=(176, 92, 110, 30))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img)
    # decorative arches on right
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = ImageDraw.Draw(ov)
    for i in range(3):
        x = int(w * (0.62 + i * 0.11))
        o.arc([x, int(h * 0.08), x + 220, int(h * 0.72)], 180, 360, fill=GOLD + (70,), width=6)
        o.line([(x, int(h * 0.4)), (x, h)], fill=GOLD + (45,), width=4)
        o.line([(x + 220, int(h * 0.4)), (x + 220, h)], fill=GOLD + (45,), width=4)
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    # rule + eyebrow
    d.rounded_rectangle([100, 150, 180, 156], radius=3, fill=GOLD)
    d.text((100, 178), "FRIZERSKI SALON  ·  LJUBLJANA", font=font(26, True), fill=ROSE_D)
    d.text((96, 240), "Lasje, ki", font=font(104, True), fill=INK)
    d.text((96, 360), "pripovedujejo", font=font(104, True), fill=INK)
    d.text((96, 480), "vašo zgodbo.", font=font(104, True), fill=ROSE_D)
    d.text((100, 640), "Striženje · barvanje · styling · nega", font=font(32), fill=(90, 70, 76))
    d.rounded_rectangle([100, 715, 390, 795], radius=40, fill=ROSE_D)
    centered(d, (100, 715, 390, 795), "Rezervirajte termin", font(28, True), WHITE)
    img.save(OUT / "hero-salon.png", quality=93)

# ---------------- 3. Service cards ----------------
def service_card(name, subtitle, price, tone, seed):
    random.seed(seed)
    w, h = 900, 600
    img = gradient(w, h, tone[0], tone[1])
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = ImageDraw.Draw(ov)
    # abstract flowing hair strands
    for i in range(9):
        pts = []
        base = 120 + i * 80
        for y in range(0, h + 40, 12):
            x = base + int(46 * math.sin(y / 95 + i * 0.7))
            pts.append((x, y))
        o.line(pts, fill=(255, 255, 255, 26), width=random.choice([3, 5, 8]))
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, 210, 78], radius=19, fill=(255, 255, 255, 210) if False else WHITE)
    d.text((62, 46), "LIN A  ·  STORITEV", font=font(19, True), fill=ROSE_D)
    d.text((44, 350), name, font=font(56, True), fill=WHITE)
    d.text((48, 430), subtitle, font=font(25), fill=(255, 240, 240))
    d.rounded_rectangle([44, 495, 250, 555], radius=30, fill=WHITE)
    centered(d, (44, 495, 250, 555), price, font(30, True), ROSE_D)
    return img

make_logo()
make_hero()
services = [
    ("Striženje", " Žensko · moško · otroško", "od 28 €", (ROSE_D, ROSE), 1),
    ("Barvanje", "Balayage · ombre · toniranje", "od 65 €", (GOLD, (150, 110, 60)), 2),
    ("Styling", "Feniranje · kodranje · pletenice", "od 35 €", ((96, 62, 84), (150, 96, 118)), 3),
    ("Nega las", "Maskе · keratin · olje", "od 25 €", ((92, 110, 104), (150, 172, 162)), 4),
]
for i, (name, sub, price, tone, seed) in enumerate(services, 1):
    service_card(name, sub, price, tone, seed).save(OUT / f"storitev-{i}.png", quality=92)

# ---------------- 4. Product shots ----------------
def product(name, label, bg, accent, seed):
    random.seed(seed)
    w, h = 720, 900
    img = gradient(w, h, bg[0], bg[1])
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = ImageDraw.Draw(ov)
    # soft pedestal
    o.ellipse([w * 0.18, h * 0.72, w * 0.82, h * 0.9], fill=(0, 0, 0, 28))
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    # bottle silhouette
    bx, by, bw, bh = w // 2 - 120, h // 2 - 210, 240, 430
    d.rounded_rectangle([bx + 60, by - 60, bx + 180, by + 10], radius=14, fill=accent)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=38, fill=accent, outline=WHITE, width=4)
    d.rounded_rectangle([bx + 30, by + 110, bx + 210, by + 300], radius=12, fill=CREAM)
    centered(d, (bx + 30, by + 128, bx + 210, by + 200), "LINA", font(30, True), ROSE_D)
    centered(d, (bx + 30, by + 205, bx + 210, by + 250), label, font(19), INK)
    d.text((44, h - 130), name, font=font(38, True), fill=WHITE)
    d.text((46, h - 76), "Frizerski salon Lina · original", font=font(20), fill=(255, 235, 235))
    return img

products = [
    ("Šampon za sijočost", "SHAMPOO 250 ml", (BLUSH, SAND), ROSE_D, 11),
    ("Keratin maska", "MASK 200 ml", (SAND, (210, 186, 150)), GOLD, 12),
    ("Hranilno olje", "OIL 100 ml", ((225, 232, 226), (196, 212, 198)), (96, 124, 108), 13),
    ("Zaščitni sprej", "SPRAY 150 ml", ((232, 224, 236), (208, 194, 220)), (122, 92, 140), 14),
]
for i, (n, l, bg, ac, seed) in enumerate(products, 1):
    product(n, l, bg, ac, seed).save(OUT / f"izdelek-{i}.png", quality=92)

# ---------------- 5. Staff portrait placeholder ----------------
def portrait(name, role, seed):
    w, h = 600, 750
    img = gradient(w, h, BLUSH, CREAM)
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o = ImageDraw.Draw(ov)
    o.ellipse([w * 0.18, h * 0.12, w * 0.82, h * 0.68], fill=(176, 92, 110, 42))
    o.ellipse([w * 0.1, h * 0.55, w * 0.9, h * 1.3], fill=(122, 56, 74, 34))
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    d = ImageDraw.Draw(img)
    cx = w // 2
    # simple avatar silhouette
    d.ellipse([cx - 105, 155, cx + 105, 365], fill=ROSE)
    d.ellipse([cx - 170, 350, cx + 170, 750], fill=ROSE_D)
    d.rounded_rectangle([0, h - 120, w, h], fill=(255, 255, 255, 235) if False else WHITE)
    d.text((40, h - 96), name, font=font(34, True), fill=INK)
    d.text((42, h - 48), role, font=font(22), fill=ROSE_D)
    return img

portrait("Lina Kovač", "Lastnica · senior frizerka", 21).save(OUT / "osebje-lina.png", quality=92)
portrait("Maja Novak", "Frizerka · barvanje", 22).save(OUT / "osebje-maja.png", quality=92)

print("Generated", len(list(OUT.glob('*.png'))), "images in", OUT)
for p in sorted(OUT.glob('*.png')):
    print(" -", p.name, p.stat().st_size, "bytes")
