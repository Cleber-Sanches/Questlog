"""Gera ICO do arquivo .questlog a partir da arte premium (diario)."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import struct

from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'src-tauri' / 'icons'
OUT_DIR = ROOT / 'src-tauri' / 'resources'
SOURCE = ICONS / 'questlog-file-source.png'
PREVIEW = ICONS / 'questlog-file-preview.png'
BOARD = ICONS / 'questlog-icon-board.png'
OUT_ICO = OUT_DIR / 'questlog-file.ico'
SIZES = (16, 24, 32, 48, 64, 128, 256)


def _premultiply(im: Image.Image) -> Image.Image:
    px = im.load()
    w, h = im.size
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                op[x, y] = (0, 0, 0, 0)
            elif a == 255:
                op[x, y] = (r, g, b, a)
            else:
                af = a / 255.0
                op[x, y] = (int(r * af), int(g * af), int(b * af), a)
    return out


def _unpremultiply(im: Image.Image) -> Image.Image:
    px = im.load()
    w, h = im.size
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                op[x, y] = (0, 0, 0, 0)
            elif a == 255:
                op[x, y] = (r, g, b, a)
            else:
                af = a / 255.0
                op[x, y] = (
                    min(255, int(round(r / af))),
                    min(255, int(round(g / af))),
                    min(255, int(round(b / af))),
                    a,
                )
    return out


def resize_rgba(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize com alpha premultiplicado — evita halo branco e serrilhado."""
    return _unpremultiply(
        _premultiply(im).resize(size, Image.Resampling.LANCZOS)
    )


def extract_from_white(im: Image.Image) -> Image.Image:
    """Extrai o diario do fundo branco com alpha suave e RGB descontaminado."""
    src = im.convert('RGBA')
    w, h = src.size
    sp = src.load()
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = sp[x, y]
            mn = min(r, g, b)
            mx = max(r, g, b)
            sat = mx - mn
            dist = 255 - mn

            # Cobre / fita: saturação quente
            accent = sat >= 28 and mx >= 95 and r >= g and r >= 80

            if accent:
                alpha = 255
            elif dist <= 14:
                alpha = 0
            elif dist >= 70:
                alpha = 255
            else:
                alpha = int(round((dist - 14) * (255.0 / 56.0)))

            if alpha < 8:
                continue

            af = alpha / 255.0
            if af < 0.995:
                inv = 1.0 - af
                r = int(max(0, min(255, round((r - 255.0 * inv) / af))))
                g = int(max(0, min(255, round((g - 255.0 * inv) / af))))
                b = int(max(0, min(255, round((b - 255.0 * inv) / af))))

            # Páginas claras na base → couro escuro
            if (not accent) and mn >= 130 and sat <= 28 and y > int(h * 0.70):
                r, g, b = 36, 32, 30
                alpha = min(alpha, 230)

            # Qualquer residual quase-branco (não accent) morre
            if (not accent) and min(r, g, b) >= 175 and sat <= 35:
                continue

            # Specular do cobre vira branco puro no Explorer escuro — limita o brilho
            if min(r, g, b) >= 195:
                # Achata highlight para cobre metálico legível
                r = min(r, 210)
                g = min(g, 150)
                b = min(b, 95)
                # Se ainda ficou cinza-claro, força cobre
                if max(r, g, b) - min(r, g, b) < 40:
                    r, g, b = 196, 128, 72

            # Artefato de unmatte (cyan/magenta fantasma)
            if alpha < 120 and (b > 200 or g > 220) and r < 80:
                continue

            op[x, y] = (r, g, b, alpha)

    # Suaviza em espaço premultiplicado (não reintroduz branco no RGB)
    soft = _unpremultiply(
        _premultiply(out).filter(ImageFilter.GaussianBlur(radius=0.5))
    )

    # Silhueta com AA limpo: alpha binário → blur (mata serrilhado da máscara)
    r_ch, g_ch, b_ch, a_ch = soft.split()
    solid = a_ch.point(lambda p: 255 if p >= 100 else 0)
    a_smooth = solid.filter(ImageFilter.GaussianBlur(radius=1.25))
    # Garante interior sólido
    interior = a_ch.point(lambda p: 255 if p >= 200 else 0)
    a_ch = ImageChops.lighter(a_smooth, interior)
    clean = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))

    # Na faixa de AA, RGB tem que ser escuro (senão vira halo claro)
    cp = clean.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = cp[x, y]
            if a == 0 or a >= 245:
                continue
            sat = max(r, g, b) - min(r, g, b)
            if sat >= 35 and r > 120:
                continue  # cobre / fita
            # puxa cor da borda pro couro escuro
            cp[x, y] = (32, 30, 28, a)

    # Limpeza final de halo + specular branco
    cp = clean.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = cp[x, y]
            if a == 0:
                continue
            mn = min(r, g, b)
            mx = max(r, g, b)
            sat = mx - mn

            # Franja semi-transparente clara → remove (mantém AA escuro)
            if a < 100 and mn >= 110:
                cp[x, y] = (0, 0, 0, 0)
                continue
            if a < 70 and mn >= 70:
                cp[x, y] = (28, 26, 24, a)
                continue

            # Specular estourado → cobre
            if mn >= 180:
                cp[x, y] = (196, 128, 72, a)
                continue

            accent = sat >= 28 and mx >= 95 and r >= g
            if accent:
                continue
            if mn >= 120 and sat <= 40:
                t = min(1.0, (mn - 100) / 100.0)
                cp[x, y] = (
                    int(r * (1 - 0.85 * t)),
                    int(g * (1 - 0.85 * t)),
                    int(b * (1 - 0.85 * t)),
                    int(a * (1 - 0.9 * t)),
                )
            elif a < 180 and mn > 90 and sat < 35:
                cp[x, y] = (int(r * 0.35), int(g * 0.35), int(b * 0.35), int(a * 0.5))

    # Escurece a base do livro (borda inferior clara da arte original)
    bbox = clean.getbbox()
    if bbox:
        _, _, _, y1 = bbox
        band = max(4, (y1 - bbox[1]) // 40)
        cp = clean.load()
        for y in range(max(0, y1 - band), y1 + 1):
            for x in range(w):
                r, g, b, a = cp[x, y]
                if a < 8:
                    continue
                sat = max(r, g, b) - min(r, g, b)
                if sat >= 30 and r > 130:
                    continue
                cp[x, y] = (int(r * 0.55), int(g * 0.55), int(b * 0.55), a)
    return clean


def load_master() -> Image.Image:
    master = extract_from_white(Image.open(SOURCE))
    bbox = master.getbbox()
    if not bbox:
        raise SystemExit('Falha ao extrair o diario da arte fonte')
    pad = 20
    x0, y0, x1, y1 = bbox
    master = master.crop((
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(master.width, x1 + pad),
        min(master.height, y1 + pad),
    ))
    # Sem drop-shadow: em tema escuro do Explorer vira filete cinza/branco

    w, h = master.size
    side = max(w, h)
    margin = max(12, side // 16)
    canvas = side + margin * 2
    sq = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    sq.paste(master, ((canvas - w) // 2, (canvas - h) // 2), master)
    return resize_rgba(sq, (512, 512))


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
    board.alpha_composite(resize_rgba(master, (256, 256)), (48, 80))
    d.text((48, 350), '256px', fill=(170, 170, 170, 255))
    x = 360
    d.text((x, 60), 'Como no Explorer', fill=(200, 200, 200, 255))
    for sz in (48, 32, 16):
        cell = Image.new('RGBA', (88, 108), (34, 34, 36, 255))
        im = resize_rgba(master, (sz, sz))
        cell.alpha_composite(im, ((88 - sz) // 2, 18))
        board.alpha_composite(cell, (x, 100))
        d.text((x + 32, 220), str(sz), fill=(160, 160, 160, 255))
        x += 108
    y = 290
    d.rounded_rectangle([360, y, 880, y + 58], radius=10, fill=(40, 40, 42, 255))
    board.alpha_composite(resize_rgba(master, (32, 32)), (376, y + 13))
    d.text((424, y + 18), 'valheim-guia.questlog', fill=(235, 235, 235, 255))
    return board


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f'Arte fonte ausente: {SOURCE}')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master = load_master()
    master.save(PREVIEW)
    frames = [resize_rgba(master, (s, s)) for s in SIZES]
    ico_write(OUT_ICO, frames)
    make_board(master).convert('RGB').save(BOARD)
    print(f'OK: {OUT_ICO} ({OUT_ICO.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
