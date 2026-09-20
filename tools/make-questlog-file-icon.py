"""Gera ícone de tipo de arquivo .questlog (documento + marca Questlog)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'src-tauri' / 'resources'
PREVIEW = ROOT / 'src-tauri' / 'icons' / 'questlog-file-preview.png'
APP_SRC = ROOT / 'src-tauri' / 'icons' / 'app-icon-source.png'
OUT_ICO = OUT_DIR / 'questlog-file.ico'
SIZE = 512
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_document(size: int) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Sombra suave
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    margin = int(size * 0.12)
    fold = int(size * 0.18)
    left, top = margin, int(size * 0.08)
    right, bottom = size - margin, size - int(size * 0.08)
    sd.rounded_rectangle(
        [left + size * 0.03, top + size * 0.04, right + size * 0.02, bottom + size * 0.03],
        radius=int(size * 0.06),
        fill=(0, 0, 0, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)

    # Página
    paper = (245, 242, 238, 255)
    paper_edge = (210, 205, 198, 255)
    page = [
        (left, top),
        (right - fold, top),
        (right, top + fold),
        (right, bottom),
        (left, bottom),
    ]
    d.polygon(page, fill=paper)

    # Canto dobrado
    fold_pts = [
        (right - fold, top),
        (right, top + fold),
        (right - fold, top + fold),
    ]
    d.polygon(fold_pts, fill=(228, 223, 216, 255))
    d.line([(right - fold, top), (right - fold, top + fold), (right, top + fold)], fill=paper_edge, width=max(1, size // 180))

    # Linhas de “conteúdo” (guia)
    line_x0 = left + int(size * 0.12)
    line_x1 = right - int(size * 0.14)
    y = top + int(size * 0.28)
    gap = int(size * 0.07)
    for i, w in enumerate((1.0, 0.92, 0.78, 0.88, 0.55)):
        x1 = line_x0 + int((line_x1 - line_x0) * w)
        tone = 198 - i * 6
        d.rounded_rectangle(
            [line_x0, y, x1, y + max(2, size // 48)],
            radius=size // 80,
            fill=(tone, tone - 4, tone - 8, 220),
        )
        y += gap

    # Faixa de marca (accent)
    accent = (224, 90, 56, 255)  # ~ brand
    bar_h = max(3, size // 40)
    d.rectangle([left, bottom - bar_h, right, bottom], fill=accent)

    return img


def paste_badge(doc: Image.Image, badge_src: Path) -> Image.Image:
    if not badge_src.exists():
        return doc
    badge = Image.open(badge_src).convert('RGBA')
    size = doc.size[0]
    side = int(size * 0.42)
    badge = badge.resize((side, side), Image.Resampling.LANCZOS)

    # Máscara squircle leve já vem no PNG; sombra sob o badge
    shadow = Image.new('RGBA', doc.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    bx = size - int(size * 0.14) - side
    by = size - int(size * 0.12) - side
    sd.ellipse([bx + side * 0.08, by + side * 0.12, bx + side * 0.92, by + side * 0.95], fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=size * 0.02))
    out = Image.alpha_composite(doc, shadow)
    out.alpha_composite(badge, (bx, by))
    return out


def to_ico(master: Image.Image, path: Path) -> None:
    # Pillow gera as camadas a partir do master quando sizes= é passado.
    master.save(path, format='ICO', sizes=[(s, s) for s in ICO_SIZES])


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = make_document(SIZE)
    icon = paste_badge(doc, APP_SRC)
    icon.save(PREVIEW)
    to_ico(icon, OUT_ICO)
    print(f'OK: {OUT_ICO}')
    print(f'Preview: {PREVIEW}')


if __name__ == '__main__':
    main()
