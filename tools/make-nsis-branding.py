"""Gera BMPs de branding do instalador NSIS (sidebar + header)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'src-tauri' / 'icons'
OUT = ROOT / 'src-tauri' / 'windows'
PREVIEW = ICONS / 'questlog-file-preview.png'
SOURCE = ICONS / 'questlog-file-source.png'
APP_ICON = ICONS / 'icon.png'

# MUI2 sizes (pixels)
SIDEBAR = (164, 314)
HEADER = (150, 57)

BG = (18, 18, 20)
BG_TOP = (28, 26, 24)
COPPER = (196, 128, 72)
COPPER_DIM = (140, 92, 52)
TEXT = (235, 230, 224)
MUTED = (150, 140, 130)


def _gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    im = Image.new('RGB', size, BG)
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(BG_TOP[0] * (1 - t) + BG[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG[2] * t)
        for x in range(w):
            # vinheta lateral suave
            edge = min(x, w - 1 - x) / max(1, w / 2)
            f = 0.85 + 0.15 * edge
            px[x, y] = (int(r * f), int(g * f), int(b * f))
    return im


def _load_journal(max_side: int) -> Image.Image:
    path = PREVIEW if PREVIEW.exists() else SOURCE
    im = Image.open(path).convert('RGBA')
    # Se ainda tiver fundo branco sólido, o preview já deve estar transparente
    im.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    return im


def _load_app_mark(size: int) -> Image.Image:
    im = Image.open(APP_ICON).convert('RGBA')
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    return im


def _try_font(size: int) -> ImageFont.ImageFont:
    for name in (
        'C:/Windows/Fonts/segoeuib.ttf',
        'C:/Windows/Fonts/seguisb.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
    ):
        p = Path(name)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def make_sidebar() -> Image.Image:
    canvas = _gradient(SIDEBAR)
    draw = ImageDraw.Draw(canvas)

    # Faixa cobre no topo
    draw.rectangle([0, 0, SIDEBAR[0], 3], fill=COPPER)

    journal = _load_journal(120)
    jx = (SIDEBAR[0] - journal.width) // 2
    jy = 48
    # Sombra suave só no branding do setup (fundo já é escuro)
    shadow = Image.new('RGBA', journal.size, (0, 0, 0, 0))
    sa = journal.split()[-1]
    sh = Image.new('RGBA', journal.size, (0, 0, 0, 90))
    shadow.paste(sh, (0, 4), sa)
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    base = canvas.convert('RGBA')
    base.alpha_composite(shadow, (jx, jy + 2))
    base.alpha_composite(journal, (jx, jy))

    draw = ImageDraw.Draw(base)
    font_title = _try_font(18)
    font_sub = _try_font(11)
    title = 'Questlog'
    # Centraliza título
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    ty = jy + journal.height + 28
    draw.text(((SIDEBAR[0] - tw) // 2, ty), title, fill=TEXT, font=font_title)
    sub = 'Guias de conquistas'
    bbox = draw.textbbox((0, 0), sub, font=font_sub)
    sw = bbox[2] - bbox[0]
    draw.text(((SIDEBAR[0] - sw) // 2, ty + 26), sub, fill=MUTED, font=font_sub)

    # Linha cobre inferior
    draw.rectangle([24, SIDEBAR[1] - 28, SIDEBAR[0] - 24, SIDEBAR[1] - 26], fill=COPPER_DIM)

    return base.convert('RGB')


def make_header() -> Image.Image:
    canvas = _gradient(HEADER)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, HEADER[1] - 2, HEADER[0], HEADER[1]], fill=COPPER)

    mark = _load_app_mark(40)
    base = canvas.convert('RGBA')
    base.alpha_composite(mark, (10, (HEADER[1] - mark.height) // 2))

    draw = ImageDraw.Draw(base)
    font = _try_font(14)
    draw.text((58, 18), 'Questlog', fill=TEXT, font=font)
    return base.convert('RGB')


def save_bmp(im: Image.Image, path: Path) -> None:
    """BMP 24-bit sem compressão (exigência típica do MUI)."""
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
