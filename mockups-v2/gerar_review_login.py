#!/usr/bin/env python3
"""
Gera artefatos visuais de revisão do Login:
1. login-review.html — galeria autocontida com zoom
2. login-contact-sheet.png — composite
3. WCAG contrast ratios
"""
import os, base64, json, math
from PIL import Image, ImageDraw, ImageFont, ImageOps

REVIEW_DIR = "/root/wins_hub_unificado/mockups-v2/review"
SCREENSHOTS_DIR = "/root/wins_hub_unificado/mockups-v2/screenshots"
os.makedirs(REVIEW_DIR, exist_ok=True)

# ─── 1. Base64 encode ──
def img_to_b64(path, fmt="PNG"):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

screenshots = [
    ("01-login-desktop.png", "Desktop", "1920 × 1080"),
    ("01-login-laptop.png", "Laptop", "1440 × 900"),
    ("01-login-mobile.png", "Mobile", "390 × 844"),
]

b64_images = {}
for fname, label, res in screenshots:
    path = os.path.join(SCREENSHOTS_DIR, fname)
    b64_images[fname] = img_to_b64(path)

# ─── 2. WCAG contrast ratios ──
def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def relative_luminance(r, g, b):
    r, g, b = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(c1, c2):
    l1 = relative_luminance(*c1)
    l2 = relative_luminance(*c2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return round((lighter + 0.05) / (darker + 0.05), 1)

# Define colors from our design tokens
colors = {
    "bg_base": (8, 17, 31),            # #08111F
    "bg_surface": (16, 28, 45),         # #101C2D
    "bg_surface_elevated": (20, 34, 57), # #142239
    "border_default": (37, 54, 80),     # #253650
    "border_subtle": (30, 45, 66),      # #1E2D42
    "text_primary": (244, 247, 251),    # #F4F7FB
    "text_secondary": (158, 172, 196),  # #9EACC4
    "text_tertiary": (113, 128, 154),   # #71809A
    "accent_blue": (79, 124, 255),      # #4F7CFF
    "white": (255, 255, 255),           # #FFFFFF
}

# Badge bg: rgba(79, 124, 255, 0.1) over bg_surface
badge_r = round(0.9 * 16 + 0.1 * 79)
badge_g = round(0.9 * 28 + 0.1 * 124)
badge_b = round(0.9 * 45 + 0.1 * 255)
colors["badge_bg"] = (badge_r, badge_g, badge_b)

contrasts = [
    ("Título 'Acesso ao WiNS Hub'", colors["text_primary"], colors["bg_surface"]),
    ("Subtítulo 'Plataforma Unificada...'", colors["text_tertiary"], colors["bg_surface"]),
    ("Badge 'Autenticação Corporativa'", colors["accent_blue"], colors["badge_bg"]),
    ("Botão Keycloak (fundo)", colors["accent_blue"], colors["bg_surface"]),
    ("Botão Keycloak (texto)", colors["white"], colors["accent_blue"]),
    ("Ambiente 'Homologação'", colors["text_tertiary"], colors["bg_surface"]),
    ("Versão 'v2.0.0-mockup'", colors["text_tertiary"], colors["bg_surface"]),
    ("Suporte (link)", colors["text_tertiary"], colors["bg_surface"]),
]

contrast_rows = ""
for label, fg, bg in contrasts:
    ratio = contrast_ratio(fg, bg)
    aa_normal = "PASS" if ratio >= 4.5 else "FAIL"
    aa_large = "PASS" if ratio >= 3.0 else "FAIL"
    contrast_rows += f"""
    <tr>
        <td style="color: rgb{fg}">{label}</td>
        <td style="text-align:center"><code>rgb{fg}</code></td>
        <td style="text-align:center"><code>rgb{bg}</code></td>
        <td style="text-align:center;font-weight:bold">{ratio}:1</td>
        <td style="text-align:center;color:{'#22C55E' if aa_normal == 'PASS' else '#EF4444'}">{aa_normal}</td>
        <td style="text-align:center;color:{'#22C55E' if aa_large == 'PASS' else '#EF4444'}">{aa_large}</td>
    </tr>"""

# ─── 3. Generate HTML ──
html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisão — Login WiNS Hub</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    padding: 24px; transition: background 0.3s, color 0.3s;
  }}
  body.light {{ background: #f0f0f0; color: #222; }}
  body.light .card {{ background: #fff; border-color: #ccc; }}
  body.light .card-title {{ color: #111; }}
  body.light .card-desc {{ color: #555; }}
  body.light .badge {{ background: #ddd; color: #333; }}

  .controls {{ display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }}
  .controls button {{
    padding: 8px 18px; border-radius: 6px; border: 1px solid #444;
    background: #2a2a2a; color: #e0e0e0; cursor: pointer; font-size: 13px;
  }}
  body.light .controls button {{ background: #ddd; color: #222; border-color: #bbb; }}
  .controls button:hover {{ opacity: 0.85; }}

  h1 {{ font-size: 22px; font-weight: 700; margin-bottom: 4px; }}
  h2 {{ font-size: 16px; font-weight: 600; margin: 28px 0 12px; color: #aaa; }}
  body.light h2 {{ color: #555; }}
  .sub {{ font-size: 13px; color: #888; margin-bottom: 20px; }}
  body.light .sub {{ color: #666; }}

  .gallery {{ display: flex; flex-direction: column; gap: 32px; }}

  .card {{
    background: #222; border: 1px solid #333; border-radius: 12px;
    padding: 20px; transition: background 0.3s, border-color 0.3s;
  }}
  .card-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }}
  .card-title {{ font-size: 18px; font-weight: 600; color: #eee; }}
  .card-desc {{ font-size: 13px; color: #999; }}

  .img-wrapper {{
    display: flex; justify-content: center; align-items: center;
    background: #0a0a0a; border-radius: 8px; padding: 16px;
    min-height: 200px; cursor: zoom-in; overflow: hidden;
    transition: background 0.3s;
  }}
  body.light .img-wrapper {{ background: #e0e0e0; }}
  .img-wrapper img {{
    max-width: 100%; max-height: 75vh;
    object-fit: contain; display: block;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transition: transform 0.2s;
  }}
  .img-wrapper.zoomed {{ cursor: zoom-out; }}
  .img-wrapper.zoomed img {{
    max-width: none; max-height: none;
    width: 100%; height: auto;
  }}

  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }}
  th, td {{ border: 1px solid #333; padding: 6px 10px; text-align: left; }}
  th {{ background: #2a2a2a; font-weight: 600; }}
  body.light th {{ background: #e8e8e8; }}
  body.light td {{ border-color: #ccc; }}
  code {{ font-family: 'JetBrains Mono', monospace; font-size: 11px; }}
  .pass {{ color: #22C55E; }} .fail {{ color: #EF4444; }}

  .wcag-table {{ margin-top: 8px; }}
  .wcag-table th {{ font-size: 11px; }}

  .badge {{
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    background: #333; font-size: 11px; color: #ccc;
  }}

  @media (max-width: 768px) {{
    body {{ padding: 12px; }}
    .card {{ padding: 12px; }}
    .img-wrapper {{ padding: 8px; }}
  }}
</style>
</head>
<body>

<h1>WiNS Hub — Revisão do Mockup de Login</h1>
<p class="sub">Artefato visual para validação · Projeto isolado (sem alteração na aplicação real)</p>

<div class="controls">
  <button onclick="document.body.classList.toggle('light')">Alternar fundo claro/escuro</button>
  <span class="badge" id="zoomBadge">Clique na imagem para aplicar zoom</span>
</div>

<div class="gallery">
"""

for fname, label, res in screenshots:
    html += f"""
  <div class="card">
    <div class="card-header">
      <span class="card-title">{label}</span>
      <span class="card-desc">{res}</span>
    </div>
    <div class="img-wrapper" onclick="this.classList.toggle('zoomed')">
      <img src="data:image/png;base64,{b64_images[fname]}" alt="{label} {res}" loading="lazy">
    </div>
  </div>
"""

html += """
</div>

<h2>Contraste WCAG — Verificação de acessibilidade</h2>
<table class="wcag-table">
<tr>
  <th>Elemento</th><th>Cor do texto</th><th>Cor do fundo</th>
  <th>Razão de contraste</th><th>AA texto normal (≥ 4.5:1)</th><th>AA texto grande (≥ 3:1)</th>
</tr>
""" + contrast_rows + """
</table>

<p style="font-size:11px;color:#666;margin-top:16px">
Referência: WCAG 2.1 AA — <em>Relative Luminance</em> conforme Fórmula W3C.<br>
Texto grande = ≥18px bold ou ≥24px regular. Todos os textos do login são ≥11px.
</p>

<script>
  // Hover zoom info update
  document.querySelectorAll('.img-wrapper').forEach(w => {
    w.addEventListener('click', () => {
      const zoomed = w.classList.contains('zoomed');
      document.getElementById('zoomBadge').textContent = zoomed
        ? 'Zoom ativado (role para navegar)'
        : 'Clique na imagem para aplicar zoom';
    });
  });
</script>

</body>
</html>"""

html_path = os.path.join(REVIEW_DIR, "login-review.html")
with open(html_path, "w") as f:
    f.write(html)

# ─── 4. Contact sheet ──
def make_contact_sheet():
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if not os.path.exists(font_path):
        font_path = None

    try:
        font_title = ImageFont.truetype(font_path, 28) if font_path else ImageFont.load_default()
        font_label = ImageFont.truetype(font_path, 20) if font_path else ImageFont.load_default()
        font_res = ImageFont.truetype(font_path, 16) if font_path else ImageFont.load_default()
    except:
        font_title = ImageFont.load_default()
        font_label = ImageFont.load_default()
        font_res = ImageFont.load_default()

    # Desktop full width, laptop below, mobile side-by-side
    screens = [
        (os.path.join(SCREENSHOTS_DIR, "01-login-desktop.png"), "Desktop", "1920 × 1080", 1000),
        (os.path.join(SCREENSHOTS_DIR, "01-login-laptop.png"), "Laptop", "1440 × 900", 720),
        (os.path.join(SCREENSHOTS_DIR, "01-login-mobile.png"), "Mobile", "390 × 844", 260),
    ]

    padding = 30
    gap = 20
    label_h = 50
    title_h = 60

    # Calculate layout
    total_w = 1000 + 260 + gap + padding * 2  # desktop width + mobile + gap + padding
    desktop_h = int(1080 * (1000 / 1920))
    laptop_h = int(900 * (720 / 1440))
    mobile_h = int(844 * (260 / 390))
    row2_h = max(laptop_h, mobile_h) + label_h
    total_h = title_h + padding + desktop_h + label_h + gap + row2_h + padding

    canvas = Image.new("RGB", (total_w, total_h), (20, 20, 28))
    draw = ImageDraw.Draw(canvas)

    # Title
    draw.text((padding, 14), "WiNS Hub — Mockup de Login", fill=(244, 247, 251), font=font_title)

    y = title_h + padding

    # Row 1: Desktop
    desktop_img = Image.open(screens[0][0]).convert("RGB")
    desk_w, desk_h = screens[0][3], desktop_h
    desktop_img = desktop_img.resize((desk_w, desk_h), Image.Resampling.LANCZOS)
    canvas.paste(desktop_img, (padding, y))
    draw.text((padding, y + desk_h + 4), f"{screens[0][1]} — {screens[0][2]}", fill=(158, 172, 196), font=font_label)
    y += desk_h + label_h + gap

    # Row 2: Laptop + Mobile
    laptop_img = Image.open(screens[1][0]).convert("RGB")
    lap_w, lap_h = screens[1][3], laptop_h
    laptop_img = laptop_img.resize((lap_w, lap_h), Image.Resampling.LANCZOS)
    canvas.paste(laptop_img, (padding, y))
    draw.text((padding, y + lap_h + 4), f"{screens[1][1]} — {screens[1][2]}", fill=(158, 172, 196), font=font_label)

    mobile_x = padding + lap_w + gap
    mobile_img = Image.open(screens[2][0]).convert("RGB")
    mob_w, mob_h = screens[2][3], mobile_h
    mobile_img = mobile_img.resize((mob_w, mob_h), Image.Resampling.LANCZOS)
    canvas.paste(mobile_img, (mobile_x, y))
    draw.text((mobile_x, y + mob_h + 4), f"{screens[2][1]} — {screens[2][2]}", fill=(158, 172, 196), font=font_label)

    sheet_path = os.path.join(REVIEW_DIR, "login-contact-sheet.png")
    canvas.save(sheet_path)
    print(f"Contact sheet: {sheet_path} ({total_w}x{total_h})")
    return sheet_path

make_contact_sheet()

# ─── 5. Print WCAG summary ──
print("\n=== WCAG Contrast Ratios ===")
for label, fg, bg in contrasts:
    ratio = contrast_ratio(fg, bg)
    aa_n = "PASS" if ratio >= 4.5 else "FAIL"
    aa_l = "PASS" if ratio >= 3.0 else "FAIL"
    print(f"  {label}: {ratio}:1 (AA normal: {aa_n}, AA large: {aa_l})")

print(f"\nHTML: {html_path}")
print("ARTEFATOS VISUAIS DO LOGIN PRONTOS PARA REVISÃO")
