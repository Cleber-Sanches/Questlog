"""Gera BMPs premium do instalador NSIS (visual alinhado ao app)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'src-tauri' / 'icons'
OUT = ROOT / 'src-tauri' / 'windows'
PREVIEW = ICONS / 'questlog-file-preview.png'
SOURCE = ICONS / 'questlog-file-source.png'
APP_ICON = ICONS / 'icon.png'

# MUI2 sizes
SIDEBAR = (164, 314)
HEADER = (150, 57)

# Tokens do app (tokens.css)
BG = (20, 20, 20)          # ~#141414
SURFACE = (26, 26, 26)     # #1a1a1a
BRAND = (198, 77, 46)      # #c64d2e
BRAND_BRIGHT = (224, 90, 56)
TEXT = (245, 240, 234)
MUTED = (140, 132, 124)


def _try_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = (
        ('C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/seguisb.ttf')
        if bold
        else ('C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/seguisb.ttf')
    )
    for name in names + ('C:/Windows/Fonts/arial.ttf',):
        p = Path(name)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def _canvas(size: tuple[int, int]) -> Image.Image:
    """Fundo escuro com vinheta e brilho cobre suave (sem roxo/glow artificial)."""
    w, h = size
    im = Image.new('RGB', size, BG)
    px = im.load()
    cx, cy = w * 0.5, h * 0.38
    for y in range(h):
        for x in range(w):
            # vinheta radial
            dx = (x - cx) / max(1, w * 0.55)
            dy = (y - cy) / max(1, h * 0.55)
            d = math.sqrt(dx * dx + dy * dy)
            v = max(0.0, 1.0 - d * 0.72)
            # mistura surface no centro
            r = int(BG[0] + (SURFACE[0] - BG[0]) * v * 0.9)
            g = int(BG[1] + (SURFACE[1] - BG[1]) * v * 0.9)
            b = int(BG[2] + (SURFACE[2] - BG[2]) * v * 0.9)
            # wash cobre bem sutil no alto
            wash = max(0.0, 1.0 - (y / h) * 1.6) * 0.035
            r = min(255, int(r + BRAND[0] * wash))
            g = min(255, int(g + BRAND[1] * wash))
            b = min(255, int(b + BRAND[2] * wash))
            px[x, y] = (r, g, b)
    return im


def _load_journal(max_side: int) -> Image.Image:
    path = PREVIEW if PREVIEW.exists() else SOURCE
    im = Image.open(path).convert('RGBA')
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    return im


def _load_mark(size: int) -> Image.Image:
    im = Image.open(APP_ICON).convert('RGBA')
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    return im


def make_sidebar() -> Image.Image:
    base = _canvas(SIDEBAR).convert('RGBA')
    draw = ImageDraw.Draw(base)

    # Filete brand no topo
    draw.rectangle([0, 0, SIDEBAR[0] - 1, 2], fill=BRAND)

    journal = _load_journal(128)
    jx = (SIDEBAR[0] - journal.width) // 2
    jy = 52

    # Glow discreto atrás do diário (marca, não neon)
    glow = Image.new('RGBA', (journal.width + 40, journal.height + 40), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        [8, 12, glow.width - 8, glow.height - 4],
        fill=(BRAND[0], BRAND[1], BRAND[2], 22),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(12))
    base.alpha_composite(glow, (jx - 20, jy - 10))

    shadow = Image.new('RGBA', journal.size, (0, 0, 0, 0))
    sh = Image.new('RGBA', journal.size, (0, 0, 0, 110))
    shadow.paste(sh, (0, 5), journal.split()[-1])
    shadow = shadow.filter(ImageFilter.GaussianBlur(5))
    base.alpha_composite(shadow, (jx, jy + 3))
    base.alpha_composite(journal, (jx, jy))

    draw = ImageDraw.Draw(base)
    font_title = _try_font(17, bold=True)
    font_sub = _try_font(10, bold=False)
    title = 'Questlog'
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    ty = jy + journal.height + 22
    draw.text(((SIDEBAR[0] - tw) // 2, ty), title, fill=TEXT, font=font_title)

    # Linha brand curta sob o nome
    line_w = 28
    lx = (SIDEBAR[0] - line_w) // 2
    draw.rectangle([lx, ty + 24, lx + line_w, ty + 26], fill=BRAND)

    sub = 'Conquistas Steam'
    bbox = draw.textbbox((0, 0), sub, font=font_sub)
    sw = bbox[2] - bbox[0]
    draw.text(((SIDEBAR[0] - sw) // 2, ty + 36), sub, fill=MUTED, font=font_sub)

    return base.convert('RGB')


def make_header() -> Image.Image:
    base = _canvas(HEADER).convert('RGBA')
    draw = ImageDraw.Draw(base)
    draw.rectangle([0, HEADER[1] - 2, HEADER[0], HEADER[1]], fill=BRAND)

    mark = _load_mark(36)
    mx = 12
    my = (HEADER[1] - mark.height) // 2 - 1
    base.alpha_composite(mark, (mx, my))

    draw = ImageDraw.Draw(base)
    font = _try_font(13, bold=True)
    draw.text((56, 20), 'Questlog', fill=TEXT, font=font)
    return base.convert('RGB')


def save_bmp(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert('RGB').save(path, format='BMP')
    print(f'OK: {path} ({path.stat().st_size} bytes) {im.size}')


def main() -> None:
    if not APP_ICON.exists():
        raise SystemExit(f'Ícone do app ausente: {APP_ICON}')
    save_bmp(make_sidebar(), OUT / 'nsis-sidebar.bmp')
    save_bmp(make_header(), OUT / 'nsis-header.bmp')


if __name__ == '__main__':
    main()
