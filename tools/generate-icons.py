"""Generate raster PWA icons and a lightweight UI basketball asset."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"


def quadratic(start, control, end, steps=120):
    points = []
    for index in range(steps + 1):
        t = index / steps
        inverse = 1 - t
        points.append((
            inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
            inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
        ))
    return points


def make_icon(size, filename):
    supersample = 4
    scale = size * supersample / 512
    canvas_size = size * supersample
    image = Image.new("RGB", (canvas_size, canvas_size), "#0F0F23")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, canvas_size - 1, canvas_size - 1),
        radius=round(96 * scale),
        fill="#0F0F23",
    )
    center = 256 * scale
    radius = 170 * scale
    bounds = (center - radius, center - radius, center + radius, center + radius)
    draw.ellipse(bounds, fill="#FF6B35")

    seams = Image.new("RGBA", image.size, (0, 0, 0, 0))
    seam_draw = ImageDraw.Draw(seams)
    width = max(1, round(13 * scale))
    ink = "#0F0F23"
    seam_draw.line((center, 86 * scale, center, 426 * scale), fill=ink, width=width)
    seam_draw.line((86 * scale, center, 426 * scale, center), fill=ink, width=width)
    for control_x in (168, 344):
        points = [(x * scale, y * scale) for x, y in quadratic((256, 86), (control_x, 256), (256, 426))]
        seam_draw.line(points, fill=ink, width=width, joint="curve")

    clip = Image.new("L", image.size, 0)
    ImageDraw.Draw(clip).ellipse(bounds, fill=255)
    image.paste(seams.convert("RGB"), mask=Image.composite(seams.getchannel("A"), Image.new("L", image.size, 0), clip))
    image.resize((size, size), Image.Resampling.LANCZOS).save(ICONS / filename, optimize=True)


def load_font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def make_social_card():
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), "#05070D")
    pixels = image.load()
    start = (5, 7, 13)
    end = (18, 28, 48)
    for y in range(height):
        for x in range(width):
            blend = min(1, (x / width) * 0.7 + (y / height) * 0.3)
            pixels[x, y] = tuple(round(start[i] + (end[i] - start[i]) * blend) for i in range(3))

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((775, 55, 1250, 530), fill=(249, 115, 22, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    line = (255, 255, 255, 24)
    draw.rounded_rectangle((716, 75, 1137, 555), radius=22, outline=line, width=4)
    draw.line((716, 315, 1137, 315), fill=line, width=4)
    draw.ellipse((848, 237, 1004, 393), outline=line, width=4)
    draw.arc((630, 152, 875, 478), 270, 90, fill=line, width=4)
    draw.arc((978, 152, 1223, 478), 90, 270, fill=line, width=4)
    image = Image.alpha_composite(image, overlay)

    icon = Image.open(ICONS / "icon-512.png").convert("RGBA").resize((318, 318), Image.Resampling.LANCZOS)
    icon_shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    icon_shadow.paste(icon, (815, 160), icon)
    image = Image.alpha_composite(image, icon_shadow)

    draw = ImageDraw.Draw(image)
    brand = load_font(84, bold=True)
    strap = load_font(36, bold=True)
    body = load_font(25)
    pill = load_font(20, bold=True)
    draw.text((78, 105), "COURTCALL", font=brand, fill="#F8FAFC")
    draw.rounded_rectangle((79, 207, 546, 216), radius=5, fill="#F97316")
    draw.text((78, 250), "PICKUP BASKETBALL,", font=strap, fill="#F97316")
    draw.text((78, 296), "ORGANIZED.", font=strap, fill="#F97316")
    draw.text((80, 379), "Score live  •  Build fair teams  •  Run tournaments", font=body, fill="#CBD5E1")
    draw.rounded_rectangle((78, 455, 488, 509), radius=27, fill=(249, 115, 22, 36), outline=(249, 115, 22, 150), width=2)
    draw.text((105, 469), "WORKS OFFLINE  •  NO SIGNUP", font=pill, fill="#FDBA74")
    image.convert("RGB").save(ICONS / "social-card.png", optimize=True)


def main():
    ICONS.mkdir(exist_ok=True)
    make_icon(180, "apple-touch-icon.png")
    make_icon(192, "icon-192.png")
    make_icon(512, "icon-512.png")
    make_icon(512, "icon-maskable-512.png")
    make_social_card()

    source = Image.open(ICONS / "basketball-3d.png").convert("RGB")
    source.thumbnail((512, 512), Image.Resampling.LANCZOS)
    source.save(ICONS / "basketball-3d.webp", "WEBP", quality=84, method=6)


if __name__ == "__main__":
    main()
