"""Gera ICO do arquivo .questlog a partir da arte premium (diario)."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import struct

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'src-tauri' / 'icons'
OUT_DIR = ROOT / 'src-tauri' / 'resources'
SOURCE = ICONS / 'questlog-file-source.png'
PREVIEW = ICONS / 'questlog-file-preview.png'
BOARD = ICONS / 'questlog-icon-board.png'
OUT_ICO = OUT_DIR / 'questlog-file.ico'
SIZES = (16, 24, 32, 48, 64, 128, 256)


def load_master() -> Image.Image:
    master = Image.open(SOURCE).convert('RGBA')
    bbox = master.getbbox()
    if bbox:
        master = master.crop(bbox)
    w, h = master.size
    side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(master, ((side - w) // 2, (side - h) // 2), master)
    return sq.resize((512, 512), Image.Resampling.LANCZOS)


def ico_write(path: Path, images: list[Image.Image]) -> None:
    blobs: list[bytes] = []
    entries: list[tuple[int, int, int, int]] = []
    offset = 6 + 16 * len(images)
    for im in images:
        buf = BytesIO()
        im.convert('RGBA').save(buf, format='PNG')
        data = buf.getvalue()
        w, h = im.size
        entries.append((0 if w >= 256 else w, 0 if h >= 256 else h, len(data), offset))
        blobs.append(data)
        offset += len(data)
    out = bytearray(struct.pack('<HHH', 0, 1, len(images)))
    for w, h, nbytes, off in entries:
        out += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, nbytes, off)
    for b in blobs:
        out += b
    path.write_bytes(out)


def make_board(master: Image.Image) -> Image.Image:
    W, H = 920, 540
    board = Image.new('RGBA', (W, H), (22, 22, 24, 255))
    d = ImageDraw.Draw(board)
    d.text((36, 24), 'Icone .questlog — diario premium', fill=(240, 240, 240, 255))
    board.alpha_composite(master.resize((256, 256), Image.Resampling.LANCZOS), (48, 80))
    d.text((48, 350), '256px', fill=(170, 170, 170, 255))
    x = 360
    d.text((x, 60), 'Como no Explorer', fill=(200, 200, 200, 255))
    for sz in (48, 32, 16):
        cell = Image.new('RGBA', (88, 108), (34, 34, 36, 255))
        im = master.resize((sz, sz), Image.Resampling.LANCZOS)
        cell.alpha_composite(im, ((88 - sz) // 2, 18))
        board.alpha_composite(cell, (x, 100))
        d.text((x + 32, 220), str(sz), fill=(160, 160, 160, 255))
        x += 108
    y = 290
    d.rounded_rectangle([360, y, 880, y + 58], radius=10, fill=(40, 40, 42, 255))
    board.alpha_composite(master.resize((32, 32), Image.Resampling.LANCZOS), (376, y + 13))
    d.text((424, y + 18), 'valheim-guia.questlog', fill=(235, 235, 235, 255))
    return board


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f'Arte fonte ausente: {SOURCE}')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master = load_master()
    master.save(PREVIEW)
    frames = [master.resize((s, s), Image.Resampling.LANCZOS) for s in SIZES]
    ico_write(OUT_ICO, frames)
    make_board(master).convert('RGB').save(BOARD)
    print(f'OK: {OUT_ICO} ({OUT_ICO.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
