# Renders the app icons from mascot.png (needs Pillow). Usage:
#   python3 assets/icon/render.py assets/images [preview_dir]
# preview_dir (optional) gets launcher / monochrome / splash previews.
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SRC = Path(__file__).with_name('mascot.png')
BG = (253, 252, 249)  # off-white of the source art; also the adaptive icon background
SPLASH_BG = (17, 19, 24)  # keep in sync with app.json splash backgroundColor
DINO_BOTTOM = 935  # source rows below this hold the "RepTile" wordmark
BG_TOLERANCE = 28  # max channel distance from white still treated as background
# Around the feet a looser tolerance drops the floor shadow; the thick dark outlines keep the feet.
SHADOW_BOX, SHADOW_TOLERANCE = (180, 800, 1080, DINO_BOTTOM), 150


def cut_dino():
    """Crops the dino (no wordmark) and makes the background reachable from the edges transparent."""
    src = Image.open(SRC).convert('RGB')
    src = src.crop((0, 0, src.width, DINO_BOTTOM))
    r, g, b = ImageOps.invert(src).split()
    dist = ImageChops.lighter(ImageChops.lighter(r, g), b)  # distance from white
    flood = dist.point(lambda v: 255 if v <= BG_TOLERANCE else 0)
    band = SHADOW_BOX
    flood.paste(dist.crop(band).point(lambda v: 255 if v <= SHADOW_TOLERANCE else 0), band[:2])
    # Flood from every border pixel so only the outer background goes; enclosed light areas (belly) stay.
    for x in range(0, flood.width, 8):
        for y in (0, flood.height - 1):
            if flood.getpixel((x, y)) == 255:
                ImageDraw.floodfill(flood, (x, y), 128)
    for y in range(0, flood.height, 8):
        for x in (0, flood.width - 1):
            if flood.getpixel((x, y)) == 255:
                ImageDraw.floodfill(flood, (x, y), 128)
    alpha = flood.point(lambda v: 0 if v == 128 else 255)
    # shrink 1px before softening so the light anti-aliased fringe doesn't halo on dark backgrounds
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    dino = src.convert('RGBA')
    dino.putalpha(alpha)
    return dino.crop(alpha.point(lambda v: 255 if v > 40 else 0).getbbox())


def place(dino, size, box, bg=None, dy=0):
    """Scales dino to fit a box x box square and centers it on a size x size canvas."""
    scale = box / max(dino.size)
    d = dino.resize((round(dino.width * scale), round(dino.height * scale)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    canvas.alpha_composite(d, ((size - d.width) // 2, (size - d.height) // 2 + dy))
    return canvas


def monochrome(fg):
    """White silhouette with the dark details (outlines, eye, barbell) cut out, as Android expects."""
    lum = fg.convert('L').point(lambda v: 255 if v > 95 else 0)
    alpha = ImageChops.multiply(fg.getchannel('A'), lum)
    mono = Image.new('RGBA', fg.size, (255, 255, 255, 0))
    mono.putalpha(alpha)
    return mono


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    img.putalpha(ImageChops.multiply(img.getchannel('A'), mask))
    return img


def main(out, preview=None):
    out = Path(out)
    dino = cut_dino()
    fg = place(dino, 1024, 640, dy=10)  # adaptive icon safe zone is the inner ~61%
    images = {
        'icon.png': place(dino, 1024, 900, BG, dy=10),
        'android-icon-foreground.png': fg,
        'android-icon-background.png': Image.new('RGBA', (1024, 1024), BG + (255,)),
        'android-icon-monochrome.png': monochrome(fg),
        'splash-icon.png': place(dino, 1024, 1024),
        'favicon.png': rounded(place(dino, 1024, 900, BG, dy=10), 220).resize((48, 48), Image.LANCZOS),
    }
    for name, img in images.items():
        img.save(out / name, optimize=True)
    if preview:
        preview = Path(preview)
        # adaptive icon masked to a circle, like the Pixel launcher (shows the middle 72/108 of the layers)
        launcher = Image.new('RGBA', (1024, 1024), BG + (255,))
        launcher.alpha_composite(fg)
        launcher = launcher.crop((170, 170, 854, 854)).resize((1024, 1024), Image.LANCZOS)
        circle = Image.new('L', (1024, 1024), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, 1023, 1023), fill=255)
        launcher.putalpha(circle)
        launcher.save(preview / 'preview.png')
        mono = Image.new('RGBA', (1024, 1024), (43, 47, 55, 255))
        tint = Image.new('RGBA', (1024, 1024), (215, 227, 255, 255))
        tint.putalpha(images['android-icon-monochrome.png'].getchannel('A'))
        mono.alpha_composite(tint)
        mono.save(preview / 'mono-preview.png')
        splash = Image.new('RGBA', (1024, 1024), SPLASH_BG + (255,))
        splash.alpha_composite(images['splash-icon.png'])
        splash.save(preview / 'splash-preview.png')
    print('rendered', len(images))


if __name__ == '__main__':
    main(*sys.argv[1:])
