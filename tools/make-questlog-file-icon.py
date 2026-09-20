"""Ícone .questlog = marca Questlog (arte do app) + leve sugestão de documento.

O Explorer mostra 16–32px: nested badge / troféu vetorial fino some.
A marca já existente lê bem nesses tamanhos.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'src-tauri' / 'resources'
ICONS = ROOT / 'src-tauri' / 'icons'
APP_SRC = ICONS / 'app-icon-source.png'
PREVIEW = ICONS / 'questlog-file-preview.png'
OUT_ICO = OUT_DIR / 'questlog-file.ico'

ACCENT = (224, 90, 56, 255)
PAPER = (236, 232, 226, 255)


def rounded_mask(size: int, radius: float) -> Image.Image:
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make_icon(size: int) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    mark = Image.open(APP_SRC).convert('RGBA')

    if size <= 24:
        # Só a marca — máxima legibilidade
        mark = mark.resize((size, size), Image.Resampling.LANCZOS)
        canvas.alpha_composite(mark)
        return canvas

    # Página atrás (sugere “arquivo/guia”)
    page = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(page)
    inset = max(1, size // 18)
    fold = max(2, size // 6)
    left, top = inset, inset // 2
    right, bottom = size - inset // 2, size - inset
    # sombra
    sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [left + 2, top + 3, right + 1, bottom + 2],
        radius=size // 12,
        fill=(0, 0, 0, 90),
    )
    page = Image.alpha_composite(page, sh.filter(ImageFilter.GaussianBlur(max(1, size // 40))))
    pd = ImageDraw.Draw(page)
    pd.polygon(
        [
            (left, top),
            (right - fold, top),
            (right, top + fold),
            (right, bottom),
            (left, bottom),
        ],
        fill=PAPER,
    )
    pd.polygon(
        [(right - fold, top), (right, top + fold), (right - fold, top + fold)],
        fill=ACCENT,
    )
    pd.rectangle([left, bottom - max(1, size // 20), right, bottom], fill=ACCENT)

    # Marca por cima, centrada, ~78% do canvas
    side = int(size * 0.78)
    mark = mark.resize((side, side), Image.Resampling.LANCZOS)
    ox = (size - side) // 2
    oy = (size - side) // 2 + size // 40
    page.alpha_composite(mark, (ox, oy))
    return page


def ico_write(path: Path, images: list[Image.Image]) -> None:
    import struct
    from io import BytesIO

    blobs: list[bytes] = []
    entries: list[tuple[int, int, int, int]] = []
    offset = 6 + 16 * len(images)
    for im in images:
        raw = im.convert('RGBA')
        buf = BytesIO()
        raw.save(buf, format='PNG')
        data = buf.getvalue()
        w, h = raw.size
        entries.append((0 if w >= 256 else w, 0 if h >= 256 else h, len(data), offset))
        blobs.append(data)
        offset += len(data)

    out = bytearray()
    out += struct.pack('<HHH', 0, 1, len(images))
    for w, h, nbytes, off in entries:
        out += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, nbytes, off)
    for b in blobs:
        out += b
    path.write_bytes(out)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sizes = (16, 24, 32, 48, 64, 128, 256)
    frames = [make_icon(s) for s in sizes]
    # preview em alta
    make_icon(512).save(PREVIEW)
    ico_write(OUT_ICO, frames)
    for s in (16, 32, 48):
        frames[sizes.index(s)].resize((s * 10, s * 10), Image.Resampling.NEAREST).save(
            ICONS / f'questlog-file-{s}.png'
        )
    print(f'OK: {OUT_ICO} ({OUT_ICO.stat().st_size} bytes)')
    print(f'Preview: {PREVIEW}')


if __name__ == '__main__':
    main()
